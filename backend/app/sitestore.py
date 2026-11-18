"""The one place that reads and writes a website's files and saved data.

  * Public files (index.html, img/, llms.txt, .well-known/) live in SITES_DIR/<slug>/, which the web server publishes.
  * The saved data (site.json: owner profile, email, UPI ID, marketing drafts) lives in PRIVATE_DIR/<slug>/,
    which is never published.
  * Writes are atomic (temp file + rename): a crash mid-write never leaves a half-written file.
  * update()/locked() hold a per-website lock across read -> change -> write, so two requests (an edit and a
    verification, say) can't silently overwrite each other's changes.
  * creating() builds a new site in a staging folder and publishes it with one rename, so a failed build
    leaves nothing behind (the name isn't burnt by a broken half-site).
"""
import json
import os
import shutil
import tempfile
import threading
from collections import defaultdict
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterator

from . import config

_locks: defaultdict[str, threading.RLock] = defaultdict(threading.RLock)
_locks_guard = threading.Lock()


class SiteNotFound(FileNotFoundError):
    pass


def folder(slug: str) -> Path:
    """Public files of the website."""
    return config.SITES_DIR / slug


def _data_path(slug: str) -> Path:
    return config.PRIVATE_DIR / slug / "site.json"


def _lock(slug: str) -> threading.RLock:
    with _locks_guard:
        return _locks[slug]


def _move_legacy(slug: str) -> None:
    """Older versions kept site.json inside the public folder. Move it to the private folder once."""
    legacy = folder(slug) / "site.json"
    if legacy.exists():
        with _lock(slug):
            if legacy.exists():
                target = _data_path(slug)
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    legacy.unlink()
                else:
                    os.replace(legacy, target)


def exists(slug: str) -> bool:
    _move_legacy(slug)
    return _data_path(slug).exists()


def slugs() -> list[str]:
    """Every website with saved data."""
    if config.SITES_DIR.exists():
        for d in config.SITES_DIR.iterdir():
            if d.is_dir() and not d.name.startswith("."):
                _move_legacy(d.name)
    if not config.PRIVATE_DIR.exists():
        return []
    return sorted(d.name for d in config.PRIVATE_DIR.iterdir() if (d / "site.json").exists())


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def load(slug: str) -> dict:
    _move_legacy(slug)
    try:
        return json.loads(_data_path(slug).read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SiteNotFound(slug) from exc


def save(slug: str, data: dict) -> None:
    with _lock(slug):
        write_atomic(_data_path(slug), json.dumps(data, ensure_ascii=False, indent=2))


def update(slug: str, change: Callable[[dict], None]) -> dict:
    """Load, apply `change` (mutates in place), save — all under the website's lock."""
    with _lock(slug):
        data = load(slug)
        change(data)
        save(slug, data)
        return data


@contextmanager
def locked(slug: str) -> Iterator[None]:
    """Hold the website's lock for a longer read-modify-write (e.g. an AI edit + re-render)."""
    with _lock(slug):
        yield


class Draft:
    """A website being built: write public files into .folder and set .data; publish happens on success."""

    def __init__(self, staging: Path):
        self.folder = staging
        self.data: dict | None = None


@contextmanager
def creating(slug: str, replace: bool = False) -> Iterator[Draft]:
    """Build a new website in a staging folder; publish it only if the block finished without an error.

    Raises FileExistsError if the slug is already taken (unless replace=True, used for the demo sites).
    """
    config.SITES_DIR.mkdir(parents=True, exist_ok=True)
    draft = Draft(Path(tempfile.mkdtemp(dir=config.SITES_DIR, prefix=f".build-{slug}-")))
    try:
        yield draft
        if draft.data is None:
            raise RuntimeError("website build produced no data")
        with _lock(slug):
            if replace:
                shutil.rmtree(folder(slug), ignore_errors=True)
                _data_path(slug).unlink(missing_ok=True)
            elif folder(slug).exists() or _data_path(slug).exists():
                raise FileExistsError(slug)
            save(slug, draft.data)
            try:
                os.chmod(draft.folder, 0o755)  # mkdtemp creates 0700; the web server must be able to read it
                os.rename(draft.folder, folder(slug))
            except BaseException:
                _data_path(slug).unlink(missing_ok=True)
                raise
    except BaseException:
        shutil.rmtree(draft.folder, ignore_errors=True)
        raise


def remove(slug: str) -> None:
    """Take a website offline and erase its data (account deletion)."""
    with _lock(slug):
        shutil.rmtree(folder(slug), ignore_errors=True)
        shutil.rmtree(config.PRIVATE_DIR / slug, ignore_errors=True)


def write_public(slug: str, name: str, text: str) -> None:
    write_atomic(folder(slug) / name, text)


def field(slug: str, *path: str, default=None):
    """Read one nested value, e.g. field(slug, 'content', 'business_name'); default if missing."""
    try:
        cur = load(slug)
        for key in path:
            cur = cur[key]
        return cur if cur is not None else default
    except (SiteNotFound, KeyError, TypeError, ValueError):
        return default
