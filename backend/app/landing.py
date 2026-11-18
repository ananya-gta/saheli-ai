"""Data for the public landing page — all of it real, none of it invented.

* Category photos: bundled in the frontend; any missing one is downloaded once from Pexels/Openverse (licences that
  need no visible credit only), verified, cropped and cached on disk. Served through /api/landing/photo/<file>.
* Example domain price: a live GoDaddy availability check, cached for a few hours.
* Demo sites: built automatically in the background if they don't exist yet, so the showcase is never empty.
"""
import json
import threading
import logging
import time
from pathlib import Path

from . import config, godaddy, images

log = logging.getLogger("saheli")

# Home food, bakery, mehendi and tuition photos ship with the frontend (frontend/public/women/).
# Only categories without a bundled photo are downloaded — and only licences that need no visible credit.
CATEGORIES = {
    "boutique": ["indian woman tailor sewing", "woman sewing machine fabric", "indian woman embroidery", "handloom weaving woman"],
}
EXAMPLE_DOMAIN = "anayabakehouse.com"
PRICE_TTL = 6 * 3600

_lock = threading.Lock()
_price_cache: dict = {}


def folder() -> Path:
    return config.DATA_DIR / "landing"


def _manifest() -> dict:
    try:
        return json.loads((folder() / "photos.json").read_text(encoding="utf-8"))
    except Exception:
        return {}


def photos() -> dict:
    """Category -> {src, src_small, alt, credit...} for whatever has been fetched so far."""
    out = {}
    for key, item in _manifest().items():
        if item and (folder() / Path(item["src"]).name).exists():
            out[key] = {
                "src": "/api/landing/photo/" + Path(item["src"]).name,
                "src_small": "/api/landing/photo/" + Path(item.get("src_small") or item["src"]).name,
                "alt": item.get("alt", ""), "photographer": item.get("photographer"), "page_url": item.get("page_url"),
                "source": item.get("source"), "license": item.get("license"), "license_url": item.get("license_url"),
            }
    return out


def fetch_photos() -> None:
    """Download any missing category photos (needs internet). Safe to call repeatedly."""
    with _lock:
        man = _manifest()
        missing = [k for k in CATEGORIES if not man.get(k)]
        if not missing:
            return
        target = folder()
        target.mkdir(parents=True, exist_ok=True)
        used: set = set()
        for key in missing:
            try:
                got = images.fill_slot(key, CATEGORIES[key], 1, "landscape", target, used, min_width=900, no_attribution=True)
            except Exception:
                log.exception("landing warm-up step failed")
                got = []
            if got:
                item = got[0]
                # _save returns paths relative to a site ("img/x.jpg"); keep only the file names here
                item["src"] = Path(item["src"]).name
                item["src_small"] = Path(item.get("src_small") or item["src"]).name
                man[key] = item
        (target / "photos.json").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("Landing photos: %s", ", ".join(f"{k}={'ok' if man.get(k) else 'missing'}" for k in CATEGORIES))


def photo_file(name: str) -> Path | None:
    p = (folder() / Path(name).name)
    return p if p.suffix.lower() in (".jpg", ".jpeg", ".webp", ".png") and p.exists() else None


def example_price() -> dict:
    """Live GoDaddy availability + first-year price for one example domain (cached)."""
    now = time.time()
    if _price_cache and now - _price_cache.get("at", 0) < PRICE_TTL:
        return _price_cache["data"]
    if not config.GODADDY_PAT:
        data = {"domain": EXAMPLE_DOMAIN, "live": False, "reason": "GoDaddy API not configured on this server"}
    else:
        try:
            res = godaddy.check_availability(EXAMPLE_DOMAIN)
            if res.get("error"):
                data = {"domain": EXAMPLE_DOMAIN, "live": False, "reason": "GoDaddy check failed"}
            else:
                data = {"domain": res["domain"], "live": True, "available": res["available"], "price": res.get("price"),
                        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        except Exception:
            log.exception("landing warm-up step failed")
            data = {"domain": EXAMPLE_DOMAIN, "live": False, "reason": "GoDaddy could not be reached"}
    _price_cache.update(at=now, data=data)
    return data


def ensure_demo_sites() -> None:
    """Build the five demo websites if any is missing (photos need internet; no Claude credits used)."""
    missing = [k for k in ("bakery", "homefood", "boutique", "beauty", "education")
               if not (config.SITES_DIR / f"demo-{k}" / "index.html").exists()]
    if not missing:
        return
    try:
        from . import demo_sites
        demo_sites.main(None, only=missing)
    except Exception:
        log.exception("landing warm-up step failed")


def warm_up_in_background() -> None:
    def run():
        ensure_demo_sites()
        fetch_photos()
    threading.Thread(target=run, name="landing-warmup", daemon=True).start()
