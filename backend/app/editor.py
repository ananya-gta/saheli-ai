"""Edit a live website by voice/text, and summarise enquiries for the owner.

"Aam ke achaar ka price 280 kar do" -> Claude returns only the changed fields (validated)
-> we merge them into the saved content, keep the right photos, and re-render the site.
"""
import json

from . import claude, config, design, images, sitegen, sitestore, storefront

MAX_PRICE_INR = 10_00_000
MAX_TEXT = 1200

EDITABLE = {
    "tagline_en": {"type": "string"}, "hero_subtitle": {"type": "string"}, "intro_en": {"type": "string"},
    "story_quote": {"type": "string"}, "story_en": {"type": "string"}, "area_text": {"type": "string"},
    "timings_text": {"type": "string"}, "cta_text_en": {"type": "string"},
    "palette": {"type": "string", "description": "Only if she asks to change colours"},
    "products": {"type": "array", "description": "The COMPLETE updated product list (only if products changed). Keep unchanged items exactly as they are.",
                 "items": {"type": "object", "properties": {
                     "name": {"type": "string"}, "price_inr": {"type": "number"}, "unit": {"type": "string"},
                     "description": {"type": "string"}, "category": {"type": "string"}, "badge": {"type": "string"},
                     "duration": {"type": "string"}, "schedule": {"type": "string"}, "image_query": {"type": "string"},
                     "photo_id": {"type": "string"}}, "required": ["name", "description"]}},
    "faqs": {"type": "array", "items": {"type": "object", "properties": {"q": {"type": "string"}, "a": {"type": "string"}}, "required": ["q", "a"]}},
}

# her contact/payment details live in the profile, not the website text
PROFILE_FIELDS = {
    "whatsapp": {"type": "string", "description": "Her WhatsApp number, only if she gave it"},
    "upi_id": {"type": "string", "description": "Her UPI ID (e.g. name@okaxis), only if she gave it"},
    "delivery_area": {"type": "string", "description": "Where she delivers, only if she said"},
    "testimonial": {"type": "object", "description": "ONLY real words a customer said to her, as she reported them",
                    "properties": {"quote": {"type": "string"}, "name": {"type": "string"}}, "required": ["quote", "name"]},
}

EDIT_TOOL = {
    "name": "update_site",
    "description": "Apply the owner's requested change. Include ONLY fields that change.",
    "input_schema": {"type": "object", "properties": {
        **EDITABLE, **PROFILE_FIELDS,
        "summary": {"type": "string", "description": "What you changed, one short friendly sentence in the SAME language the owner wrote in (English, or Hinglish in Roman script)"},
        "not_possible": {"type": "string", "description": "If the request can't be done by editing text/prices/products, explain briefly in the same language the owner wrote in"},
    }, "required": ["summary"]},
}


def _save_and_render(slug: str, data: dict) -> None:
    html = sitegen.render_site(data["content"], data["profile"], slug, data["images"])
    sitestore.save(slug, data)
    sitestore.write_public(slug, "index.html", html)
    storefront.write_files(slug)


def _validated(upd: dict, content: dict) -> dict:
    """Claude proposes the change; deterministic rules decide what is allowed to reach the live site."""
    out = {}
    known_photos = {p.get("photo_id") for p in content.get("products") or [] if p.get("photo_id")}
    palettes = design.ARCHETYPES[content["archetype"]]["palettes"]
    for k, v in upd.items():
        if k not in EDITABLE or v in (None, ""):
            continue
        if k == "palette":
            if v in palettes:
                out[k] = v
        elif EDITABLE[k]["type"] == "string":
            if isinstance(v, str):
                out[k] = v.strip()[:MAX_TEXT]
        elif k == "products" and isinstance(v, list) and v:
            items = []
            for p in v[:60]:
                if not isinstance(p, dict) or not str(p.get("name") or "").strip():
                    continue
                p = {f: p[f] for f in EDITABLE["products"]["items"]["properties"] if f in p}
                if "price_inr" in p:
                    try:
                        price = float(p["price_inr"])
                    except (TypeError, ValueError):
                        price = -1
                    if not 0 < price <= MAX_PRICE_INR:
                        p.pop("price_inr")
                    else:
                        p["price_inr"] = price
                if p.get("photo_id") not in known_photos:  # the AI may only keep photos she already uploaded
                    p.pop("photo_id", None)
                items.append(p)
            if items:
                out[k] = items
        elif k == "faqs" and isinstance(v, list):
            out[k] = [{"q": str(f["q"])[:300], "a": str(f["a"])[:MAX_TEXT]} for f in v[:20]
                      if isinstance(f, dict) and f.get("q") and f.get("a")]
    return out


def _validated_profile(upd: dict) -> dict:
    out = {}
    phone = "".join(ch for ch in str(upd.get("whatsapp") or "") if ch.isdigit())
    if 10 <= len(phone) <= 13:
        out["whatsapp"] = phone
    upi = str(upd.get("upi_id") or "").strip()
    if upi and sitegen.UPI_RE.match(upi):
        out["upi_id"] = upi
        out["payment_methods"] = None  # filled in below so UPI shows on the site
    area = str(upd.get("delivery_area") or "").strip()
    if area:
        out["delivery_area"] = area[:200]
    t = upd.get("testimonial")
    if isinstance(t, dict) and str(t.get("quote") or "").strip() and str(t.get("name") or "").strip():
        out["testimonial"] = {"quote": str(t["quote"]).strip()[:300], "name": str(t["name"]).strip()[:60]}
    return out


def edit(slug: str, instruction: str) -> dict:
    with sitestore.locked(slug):  # one edit at a time per website; verify/assist can't overwrite it midway
        return _edit(slug, instruction)


def _edit(slug: str, instruction: str) -> dict:
    data = sitestore.load(slug)
    content = data["content"]
    current = {k: content.get(k) for k in EDITABLE if k in content}
    resp = claude.client().messages.create(
        model=config.CLAUDE_MODEL, max_tokens=4000, tools=[EDIT_TOOL],
        tool_choice={"type": "tool", "name": "update_site"},
        messages=[{"role": "user", "content": (
            "You maintain the website of a small Indian business. The owner asked (Hindi/Hinglish/English):\n"
            f"\"{instruction}\"\n\nCurrent editable content (JSON):\n{json.dumps(current, ensure_ascii=False)}\n\n"
            "Apply exactly what she asked. Website text stays in English. Never invent prices, awards or reviews. "
            f"Valid palettes: {', '.join(design.ARCHETYPES[content['archetype']]['palettes'])}.")}])
    upd = next((b.input for b in resp.content if b.type == "tool_use"), {}) or {}
    if upd.get("not_possible") and not any(k in upd for k in (*EDITABLE, *PROFILE_FIELDS)):
        return {"ok": False, "summary": upd["not_possible"]}

    summary = upd.get("summary")
    prof = _validated_profile(upd)
    upd = _validated(upd, content)
    changed = list(upd) + [k for k in prof if k != "payment_methods"]
    if not changed:
        return {"ok": False, "summary": summary or "Kuch badalne layak nahi mila. Thoda aur saaf batayengi?"}

    old_products = content.get("products") or []
    for k in changed:
        content[k] = upd[k]

    if "products" in changed:
        _sync_product_images(slug, data, old_products)
    if prof:
        profile = data.setdefault("profile", {})
        if "payment_methods" in prof:
            prof["payment_methods"] = sorted(set(profile.get("payment_methods") or []) | {"upi"})
        if "testimonial" in prof:
            profile["testimonials"] = ([*(profile.get("testimonials") or []), prof.pop("testimonial")])[-6:]
        profile.update(prof)

    _save_and_render(slug, data)
    return {"ok": True, "summary": summary, "changed": changed, "url": config.site_url(slug)}


def _sync_product_images(slug: str, data: dict, old_products: list, fresh: frozenset = frozenset()) -> None:
    """After the product list changed: keep each product's photo (matched by name, then by position) and
    fetch one for new items. Products named in `fresh` got a new photo of hers, so their old image is dropped."""
    content = data["content"]
    # keep each product's photo: match by name, then by position; fetch a photo for new items
    imgs = data.get("images") or {}
    by_name = {str(p.get("name", "")).lower(): (p, imgs.get(f"p{i}")) for i, p in enumerate(old_products)}
    new_imgs = {}
    for i, p in enumerate(content["products"]):
        old, img = by_name.get(str(p.get("name", "")).lower(), (None, None))
        if old is None and i < len(old_products) and len(content["products"]) == len(old_products):
            old, img = old_products[i], imgs.get(f"p{i}")  # renamed in place
        if old and not p.get("photo_id") and old.get("photo_id"):
            p["photo_id"] = old["photo_id"]
        if img and str(p.get("name", "")).lower() not in fresh:
            new_imgs[f"p{i}"] = img
    for k in [k for k in imgs if k.startswith("p") and k[1:].isdigit()]:
        imgs.pop(k)
    imgs.update(new_imgs)
    missing = [i for i, _ in enumerate(content["products"]) if f"p{i}" not in imgs]
    if missing:
        arch = design.ARCHETYPES[content["archetype"]]
        orient = sitegen.PRODUCT_ORIENTATION.get(arch["layout"], "square")
        folder = sitestore.folder(slug) / "img"
        for i in missing:
            p = content["products"][i]
            ph = images.owner_photo(p["photo_id"], folder, f"own-p{i}-{p['photo_id'][:8]}", orient) if p.get("photo_id") else None
            if not ph:
                found = images.fill_slot(f"p{i}-edit", [p.get("image_query") or p["name"], p["name"]], 1, orient, folder, set(), 700)
                ph = found[0] if found else None
            if ph:
                imgs[f"p{i}"] = [ph]
    data["images"] = imgs
    # keep the profile in sync so future rebuilds use the new prices
    data["profile"]["products"] = [{k: p.get(k) for k in ("name", "price_inr", "unit", "photo_id") if p.get(k)}
                                   for p in content["products"]]


MAX_NEW_PHOTOS = 8


def add_photos(slug: str, items: list[dict]) -> dict:
    """Her own product photos for a live website: a photo of a listed product replaces its stock image,
    a new product is added with its photo. Names/prices come from her (checked in the review card)."""
    with sitestore.locked(slug):
        data = sitestore.load(slug)
        content = data["content"]
        old_products = [dict(p) for p in content.get("products") or []]
        products = content.setdefault("products", [])
        by_name = {str(p.get("name", "")).lower(): p for p in products}
        fresh, added = set(), 0
        for it in items[:MAX_NEW_PHOTOS]:
            name = str(it.get("name") or "").strip()[:120]
            if not name or not it.get("photo_id"):
                continue
            price = it.get("price_inr")
            price = float(price) if isinstance(price, (int, float)) and 0 < price <= MAX_PRICE_INR else None
            p = by_name.get(name.lower())
            if p is None:
                p = {"name": name, "description": str(it.get("description") or name)[:MAX_TEXT]}
                products.append(p)
                by_name[name.lower()] = p
                added += 1
            p["photo_id"] = it["photo_id"]
            if price:
                p["price_inr"] = price
            if it.get("unit"):
                p["unit"] = str(it["unit"])[:40]
            fresh.add(name.lower())
        if not fresh:
            return {"ok": False, "summary": "Koi photo nahi mili."}
        _sync_product_images(slug, data, old_products, frozenset(fresh))
        _save_and_render(slug, data)
    return {"ok": True, "summary": f"{len(fresh)} photo website par lag gayi" + (f", {added} naya product juda" if added else "") + ".",
            "url": config.site_url(slug)}


SUMMARY_TOOL = {
    "name": "enquiry_summary",
    "description": "Summarise enquiries for the business owner.",
    "input_schema": {"type": "object", "properties": {
        "text": {"type": "string", "description": "2-3 short sentences in friendly Hinglish (Roman script) with counts and what people want"},
        "speech": {"type": "string", "description": "The same summary in simple Hindi, Devanagari script, for text-to-speech"},
        "next_action": {"type": "string", "description": "One concrete suggestion in Hinglish, e.g. who to call back first"}},
        "required": ["text", "speech", "next_action"]},
}


def summary(slug: str, rows: list[dict]) -> dict:
    if not rows:
        return {"text": "Abhi tak koi enquiry nahi aayi. Website ka link WhatsApp status par lagaiye!",
                "speech": "अभी तक कोई पूछताछ नहीं आई। वेबसाइट का लिंक व्हाट्सऐप स्टेटस पर लगाइए।", "next_action": "", "count": 0}
    slim = [{k: r.get(k) for k in ("name", "interest", "message", "date", "channel", "received_at")} for r in rows[:30]]
    model = config.CLAUDE_FAST_MODEL or config.CLAUDE_MODEL
    try:
        resp = claude.client().messages.create(
            model=model, max_tokens=800, tools=[SUMMARY_TOOL], tool_choice={"type": "tool", "name": "enquiry_summary"},
            messages=[{"role": "user", "content": "Enquiries (newest first):\n" + json.dumps(slim, ensure_ascii=False)}])
    except Exception:
        if model == config.CLAUDE_MODEL:
            raise
        resp = claude.client().messages.create(  # fast model unavailable on this account -> main model
            model=config.CLAUDE_MODEL, max_tokens=800, tools=[SUMMARY_TOOL], tool_choice={"type": "tool", "name": "enquiry_summary"},
            messages=[{"role": "user", "content": "Enquiries (newest first):\n" + json.dumps(slim, ensure_ascii=False)}])
    out = next((b.input for b in resp.content if b.type == "tool_use"), None) or {}
    return {**out, "count": len(rows)}
