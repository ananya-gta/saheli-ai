"""Real photography for generated websites.

Pipeline (runs at build time, on the server):
  1. SEARCH  - Pexels (if PEXELS_API_KEY is set, best quality) then Openverse
               (no key needed; Creative Commons, commercial-use licences only).
  2. VERIFY  - download each candidate, check it is a real image of usable size.
  3. PROCESS - centre-crop to the slot's aspect ratio, resize to 1600px + 800px JPEGs.
  4. STORE   - save inside the site folder (sites/<slug>/img/...), so images are
               self-hosted, load fast and can never break because of hotlinking.

Every slot tries Claude's specific search first, then curated industry searches,
then re-uses another verified photo from the same site. A designed fallback frame
is only used if no photo could be fetched at all (e.g. the server is offline),
and the build reports that clearly.
"""
from __future__ import annotations

import io
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
from PIL import Image, ImageOps

from . import config, resilience

UA = {"User-Agent": "SaheliAI/1.0 (website builder; contact: hello@saheliai.com)"}
RATIOS = {"landscape": 3 / 2, "wide": 16 / 9, "portrait": 4 / 5, "tall": 3 / 4, "square": 1.0}
log = logging.getLogger("saheli")
_search_cache: dict[tuple, list] = {}

# Curated, industry-specific searches used when Claude's query finds too little.
BANK = {
    "bakery": {
        "hero": ["artisan bakery pastries display", "fresh bread bakery", "cakes bakery counter"],
        "story": ["baker hands kneading dough", "baking flour hands"],
        "gallery": ["croissants bakery", "chocolate cake slice", "cupcakes frosting", "cookies baking tray", "macarons pastel", "bread loaves bakery"],
        "product": "bakery",
    },
    "homefood": {
        "hero": ["indian pickle jars", "indian spices bowls", "mango pickle jar"],
        "story": ["indian kitchen cooking hands", "woman cooking indian food"],
        "gallery": ["indian spices", "red chillies drying sun", "indian food thali", "lemon pickle", "turmeric spices market", "mustard seeds oil"],
        "product": "indian food",
    },
    "boutique": {
        "hero": ["indian woman saree fashion", "indian ethnic wear fashion model", "kurta fashion woman"],
        "story": ["block printing textile india", "tailor sewing machine hands"],
        "gallery": ["indian textile fabric", "block print fabric", "saree silk", "boutique clothing rack", "handloom weaving", "indian jewellery"],
        "product": "indian fashion",
    },
    "beauty": {
        "hero": ["bridal mehndi hands", "indian bride henna", "henna hands wedding"],
        "story": ["henna artist applying mehndi", "mehndi application"],
        "gallery": ["mehndi design hands", "indian wedding bride", "henna art", "bridal makeup india", "indian wedding jewellery", "mehndi feet bridal"],
        "product": "mehndi",
    },
    "education": {
        "hero": ["students classroom learning", "teacher teaching students", "students studying india"],
        "story": ["teacher helping student", "tutor explaining student"],
        "gallery": ["students studying books", "classroom whiteboard", "child writing notebook", "students group study", "school books desk", "mathematics notebook"],
        "product": "study",
    },
}


def provider_names() -> list[str]:
    return (["Pexels"] if config.PEXELS_API_KEY else []) + ["Openverse"]


# ---------------------------------------------------------------- search providers
def _pexels(query: str, orientation: str) -> list[dict]:
    if not config.PEXELS_API_KEY:
        return []
    orient = {"wide": "landscape", "tall": "portrait"}.get(orientation, orientation)
    r = httpx.get("https://api.pexels.com/v1/search", timeout=12,
                  params={"query": query, "per_page": 15, "orientation": orient},
                  headers={"Authorization": config.PEXELS_API_KEY, **UA})
    r.raise_for_status()
    out = []
    for p in r.json().get("photos", []):
        src = p.get("src") or {}
        if src.get("original"):
            out.append({"url": src.get("large2x") or src["original"], "alt": p.get("alt") or query,
                        "credit": p.get("photographer") or "Pexels", "credit_url": p.get("photographer_url") or p.get("url"),
                        "page_url": p.get("url"), "source": "Pexels", "license": "Pexels License",
                        "license_url": "https://www.pexels.com/license/"})
    return out


def _openverse(query: str, orientation: str) -> list[dict]:
    aspect = {"landscape": "wide", "wide": "wide", "portrait": "tall", "tall": "tall", "square": "square"}[orientation]
    r = httpx.get("https://api.openverse.org/v1/images/", timeout=15, headers=UA, params={
        "q": query, "license_type": "commercial", "aspect_ratio": aspect, "size": "large",
        "mature": "false", "page_size": 20, "extension": "jpg"})
    r.raise_for_status()
    out = []
    for p in r.json().get("results", []):
        if not p.get("url"):
            continue
        lic = (p.get("license") or "").upper()
        out.append({"url": p["url"], "alt": p.get("title") or query,
                    "credit": p.get("creator") or "Openverse", "credit_url": p.get("creator_url") or p.get("foreign_landing_url"),
                    "page_url": p.get("foreign_landing_url"), "source": "Openverse",
                    "license": f"CC {lic} {p.get('license_version') or ''}".strip() if lic not in ("CC0", "PDM") else lic,
                    "license_url": p.get("license_url")})
    return out


def search(query: str, orientation: str) -> list[dict]:
    """Candidates from all providers (best first). Cached per query."""
    key = (query.lower().strip(), orientation)
    if not query.strip():
        return []
    if key in _search_cache:
        return _search_cache[key]
    results: list[dict] = []
    for fn in (_pexels, _openverse):
        breaker = resilience.BREAKERS.setdefault(f"photos{fn.__name__}", resilience.CircuitBreaker(f"photos{fn.__name__}", fail_max=4, reset_after=60))
        try:  # a provider that keeps failing is skipped for a minute instead of slowing every build
            results += breaker.call(lambda: fn(query, orientation))
        except Exception as exc:  # noqa: BLE001 - photos are best-effort; the site still builds
            log.warning("photo provider %s failed for %r: %s", fn.__name__, query, exc)
    _search_cache[key] = results
    return results


# ---------------------------------------------------------------- download + verify + process
def _process(raw: bytes, ratio: float, min_width: int) -> Image.Image | None:
    try:
        im = Image.open(io.BytesIO(raw))
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
    except Exception:
        return None
    w, h = im.size
    if w < min_width * 0.75 or h < 400:
        return None  # too small -> would look pixelated
    # centre crop to the slot ratio (slightly favour the upper part, where subjects usually are)
    if w / h > ratio:
        nw = int(h * ratio)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / ratio)
        top = max(0, int((h - nh) * 0.4))
        im = im.crop((0, top, w, top + nh))
    return im


def _download(url: str) -> bytes | None:
    try:
        with httpx.Client(timeout=20, follow_redirects=True, headers=UA) as client:
            r = client.get(url)
        ctype = r.headers.get("content-type", "")
        if r.status_code != 200 or not ctype.startswith("image/") or len(r.content) < 15_000:
            return None
        return r.content
    except Exception:
        return None


def _save(im: Image.Image, folder: Path, name: str) -> dict:
    folder.mkdir(parents=True, exist_ok=True)
    files = {}
    for width in (1600, 800):
        copy = im.copy()
        if copy.width > width:
            copy = copy.resize((width, round(copy.height * width / copy.width)), Image.LANCZOS)
        fname = f"{name}-{width}.jpg"
        copy.save(folder / fname, "JPEG", quality=82, optimize=True, progressive=True)
        files[width] = (fname, copy.width)
    avg = im.resize((1, 1)).getpixel((0, 0))
    return {"src": f"img/{files[1600][0]}", "src_small": f"img/{files[800][0]}",
            "srcset": f"img/{files[800][0]} {files[800][1]}w, img/{files[1600][0]} {files[1600][1]}w",
            "color": "#%02x%02x%02x" % avg}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "photo"


NO_ATTRIBUTION = {"CC0", "PDM", "Pexels License"}


def fill_slot(name: str, queries: list[str], count: int, orientation: str, folder: Path,
              used: set, min_width: int = 900, no_attribution: bool = False) -> list[dict]:
    """Find `count` verified photos for one slot, trying each query in order.
    no_attribution=True keeps only licences that don't require a visible credit (CC0, public domain, Pexels)."""
    ratio = RATIOS[orientation]
    found: list[dict] = []
    for q in queries:
        for cand in search(q, orientation):
            if len(found) >= count:
                return found
            if cand["url"] in used or (no_attribution and cand.get("license") not in NO_ATTRIBUTION):
                continue
            used.add(cand["url"])
            raw = _download(cand["url"])
            if not raw:
                continue
            im = _process(raw, ratio, min_width)
            if im is None:
                continue
            files = _save(im, folder, f"{name}-{len(found) + 1}-{_slug(q)}")
            found.append({**files, "alt": cand["alt"][:120], "photographer": cand["credit"],
                          "photographer_url": cand["credit_url"], "page_url": cand["page_url"],
                          "source": cand["source"], "license": cand["license"], "license_url": cand["license_url"]})
        if len(found) >= count:
            break
    return found


def owner_photo(photo_id: str, folder: Path, name: str, orientation: str) -> dict | None:
    """Process one of the owner's own uploaded photos into the site (no download needed)."""
    from . import catalog  # local import avoids a cycle
    path = catalog.photo_path(photo_id)
    if not path:
        return None
    im = _process(path.read_bytes(), RATIOS[orientation], min_width=500)
    if im is None:
        return None
    files = _save(im, folder, name)
    return {**files, "alt": name, "photographer": None, "source": "Owner", "owner": True}


def collect_for_site(archetype: str, content: dict, folder: Path, product_orientation: str | None) -> dict:
    """Fetch every photo a site needs. Returns {slot: [photo, ...]}.

    The owner's own photos always win: products she photographed use her photo,
    and her photos lead the gallery. Stock photography fills the rest."""
    bank = BANK.get(archetype, BANK["boutique"])
    q = content.get("image_queries") or {}
    hero_orient = "portrait" if archetype in ("homefood", "boutique") else "wide"
    gallery_orient = "portrait" if archetype in ("boutique", "beauty") else "square"
    img_dir = folder / "img"
    used: set = set()

    slots = {
        "hero": ([q.get("hero", "")] + bank["hero"], 1, hero_orient, 1400),
        "story": ([q.get("story", "")] + bank["story"], 1, "portrait", 800),
        "gallery": ([q.get("gallery", "")] + bank["gallery"], 8, gallery_orient, 800),
    }
    owner: dict[str, list] = {}
    gallery_owner = []
    for i, p in enumerate(content.get("products") or []):
        name = p.get("name", "")
        ph = owner_photo(p["photo_id"], img_dir, f"own-p{i}-{_slug(name)}", product_orientation or "square") \
            if p.get("photo_id") else None
        if ph:
            owner[f"p{i}"] = [ph]
            g = owner_photo(p["photo_id"], img_dir, f"own-g{i}-{_slug(name)}", gallery_orient)
            if g:
                gallery_owner.append(g)
        elif product_orientation:
            slots[f"p{i}"] = ([p.get("image_query", ""), f"{name} {bank['product']}", name], 1, product_orientation, 700)

    # hero first (most important), then the rest in parallel
    hq, hn, ho, hmw = slots.pop("hero")
    out = {"hero": fill_slot("hero", hq, hn, ho, img_dir, used, hmw)}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {k: pool.submit(fill_slot, k, qs, n, o, img_dir, used, mw) for k, (qs, n, o, mw) in slots.items()}
        out.update({k: f.result() for k, f in futures.items()})

    out.update(owner)
    if gallery_owner:
        out["gallery"] = (gallery_owner + out.get("gallery", []))[:8]

    # never leave a slot empty if we have any verified photo: borrow from the gallery pool
    pool_imgs = [p for k in ("gallery", "story", "hero") for p in out.get(k, [])]
    for k, v in out.items():
        if not v and pool_imgs:
            out[k] = [pool_imgs[hash(k) % len(pool_imgs)]]
    return out
