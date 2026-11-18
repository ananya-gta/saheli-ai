"""Photo -> product catalog.

The owner photographs her products on her phone. The app compresses each photo in
the browser and uploads it; Claude (vision) identifies every product and writes a
name, description and category. She only adds the price. Her real photos are then
used on her website instead of stock photography.
"""
import base64
import io
import json
import re
import uuid

from PIL import Image, ImageOps

from . import claude, config

MAX_PHOTOS = 8
MAX_BYTES = 8 * 1024 * 1024
ID_RE = re.compile(r"^[a-f0-9]{16}$")

CATALOG_TOOL = {
    "name": "catalog_items",
    "description": "Describe the products visible in the owner's photos for her online catalogue.",
    "input_schema": {
        "type": "object",
        "properties": {
            "business_guess": {"type": "string", "enum": ["food", "bakery", "beauty", "tutoring", "boutique", "handicraft", "services", "other"]},
            "items": {
                "type": "array",
                "items": {"type": "object", "properties": {
                    "photo_index": {"type": "integer", "description": "0-based index of the photo"},
                    "name": {"type": "string", "description": "Short product name in English as an Indian shopper would say it, e.g. 'Raw mango pickle'"},
                    "name_hi": {"type": "string", "description": "Same name in simple Hinglish (Roman script), e.g. 'Aam ka achaar'"},
                    "description": {"type": "string", "description": "Max 16 words, appetising, only what is visible / obvious"},
                    "category": {"type": "string", "description": "Short group, e.g. 'Pickles', 'Cakes', 'Kurtas'"},
                    "unit_guess": {"type": "string", "description": "Likely selling unit, e.g. '500 g jar', 'per piece', or ''"},
                    "photo_ok": {"type": "boolean", "description": "False if blurry/dark/not a product"},
                    "photo_tip": {"type": "string", "description": "If photo_ok is false: one friendly Hinglish tip to retake it"}},
                    "required": ["photo_index", "name", "name_hi", "description", "category", "photo_ok"]},
            },
        },
        "required": ["business_guess", "items"],
    },
}


def _decode(data_url: str) -> bytes:
    if "," in data_url[:100]:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url, validate=False)
    if len(raw) > MAX_BYTES:
        raise ValueError("Photo is too large (max 8 MB)")
    return raw


def save_photo(data_url: str) -> str:
    """Validate, normalise (rotation, RGB, max 2000px) and store one photo. Returns its id."""
    try:
        im = Image.open(io.BytesIO(_decode(data_url)))
        im = ImageOps.exif_transpose(im).convert("RGB")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("That file is not a photo we can read") from exc
    if min(im.size) < 300:
        raise ValueError("Photo is too small - please use a clearer photo")
    im.thumbnail((2000, 2000))
    config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    photo_id = uuid.uuid4().hex[:16]
    im.save(config.UPLOADS_DIR / f"{photo_id}.jpg", "JPEG", quality=88)
    return photo_id


def photo_path(photo_id: str):
    if not ID_RE.match(photo_id or ""):
        return None
    path = config.UPLOADS_DIR / f"{photo_id}.jpg"
    return path if path.exists() else None


def _as_block(photo_id: str) -> dict:
    im = Image.open(photo_path(photo_id))
    im.thumbnail((1024, 1024))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                         "data": base64.b64encode(buf.getvalue()).decode()}}


def analyze(photo_ids: list[str], context: str = "") -> dict:
    ids = [p for p in photo_ids if photo_path(p)][:MAX_PHOTOS]
    if not ids:
        raise ValueError("No valid photos found")
    content: list = []
    for i, pid in enumerate(ids):
        content += [{"type": "text", "text": f"Photo {i}:"}, _as_block(pid)]
    content.append({"type": "text", "text": (
        "These are product photos from a small Indian home business run by a woman entrepreneur. "
        "Identify the product in each photo for her online catalogue. One item per photo (if a photo "
        "clearly shows several different products, you may list each). Never guess prices. "
        "Context from the owner: " + (context or "none"))})
    resp = claude.client().messages.create(
        model=config.CLAUDE_MODEL, max_tokens=2000, tools=[CATALOG_TOOL],
        tool_choice={"type": "tool", "name": "catalog_items"},
        messages=[{"role": "user", "content": content}])
    data = next((b.input for b in resp.content if b.type == "tool_use"), None)
    if not data:
        raise RuntimeError("Could not read the photos")
    items = []
    for it in data.get("items", []):
        idx = it.get("photo_index", 0)
        if isinstance(idx, int) and 0 <= idx < len(ids):
            items.append({**it, "photo_id": ids[idx]})
    return {"business_guess": data.get("business_guess"), "items": items}


def summary_for_chat(items: list[dict]) -> str:
    """The message the app sends to Saheli after the owner confirms prices."""
    parts = []
    for it in items:
        price = f" - ₹{int(it['price_inr'])}" if it.get("price_inr") else ""
        unit = f" ({it['unit']})" if it.get("unit") else ""
        parts.append(f"{it['name']}{unit}{price}")
    return "Maine photos se ye products add kiye hain: " + "; ".join(parts) + "."


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)
