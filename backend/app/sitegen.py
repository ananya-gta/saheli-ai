"""Website generator (v3).

1. Claude writes validated, structured CONTENT and picks an ARCHETYPE + palette
   (forced tool call) - it never writes HTML.
2. images.py fetches real, licensed stock photos for Claude's search queries.
3. A category-specific Jinja2 layout (autoescaped) renders the final site.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from . import claude, config, design, images, sitestore

try:  # optional: UPI QR code
    import segno
except ImportError:  # pragma: no cover
    segno = None

SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$")
UPI_RE = re.compile(r"^[\w.\-]{2,64}@[a-zA-Z]{2,64}$")
ICON_KEYS = [k for k in design.ICONS if k not in {"plus", "x", "arrow", "menu"}]

_env = Environment(
    loader=FileSystemLoader(str(Path(__file__).parent / "templates")),
    autoescape=select_autoescape(["html"]),
)

_item3 = {"type": "object", "properties": {
    "icon": {"type": "string", "enum": ICON_KEYS}, "title": {"type": "string", "description": "2-5 words"},
    "text": {"type": "string", "description": "max 18 words"}}, "required": ["icon", "title", "text"]}

CONTENT_TOOL = {
    "name": "write_site_content",
    "description": "Write the content and choose the design for a professional, bilingual small-business website.",
    "input_schema": {
        "type": "object",
        "properties": {
            "archetype": {"type": "string", "enum": list(design.ARCHETYPES),
                          "description": " | ".join(f"{k}: {v['for']}" for k, v in design.ARCHETYPES.items())},
            "palette": {"type": "string", "description": "Palette for the archetype: "
                        + " | ".join(f"{k}: {', '.join(v['palettes'])}" for k, v in design.ARCHETYPES.items())},
            "business_name": {"type": "string"},
            "tagline_en": {"type": "string", "description": "Hero headline in English, 3-8 words, like a real premium brand (not cheesy)"},
            "hero_subtitle": {"type": "string", "description": "One supporting English line under the headline, max 18 words"},
            "intro_en": {"type": "string", "description": "2 sentences describing what she offers and why it is special"},
            "seo_description": {"type": "string", "description": "150-160 character meta description with city + offering"},
            "area_text": {"type": "string", "description": "e.g. 'Home delivery across Jaipur'"},
            "area_short": {"type": "string", "description": "City or locality, e.g. 'Jaipur'"},
            "timings_text": {"type": "string", "description": "Opening hours / class timings if known, else ''"},
            "story_title": {"type": "string", "description": "Short heading for the story section"},
            "story_quote": {"type": "string", "description": "A short first-person pull quote in English (max 20 words), based only on what she said"},
            "story_en": {"type": "string", "description": "2-4 sentences in English telling her story, ONLY facts she shared"},
            "marquee_words": {"type": "array", "minItems": 4, "maxItems": 7, "items": {"type": "string"},
                              "description": "2-3 word brand phrases for a scrolling band"},
            "highlights": {"type": "array", "minItems": 3, "maxItems": 4, "items": _item3},
            "products": {
                "type": "array", "minItems": 1, "maxItems": 12,
                "items": {"type": "object", "properties": {
                    "name": {"type": "string"},
                    "price_inr": {"type": "number", "description": "ONLY if the owner gave this price"},
                    "unit": {"type": "string", "description": "e.g. '500 g', 'per kg', 'per month', 'both hands'"},
                    "description": {"type": "string", "description": "max 16 words, sensory and specific"},
                    "long_description": {"type": "string", "description": "2 sentences, used if featured"},
                    "category": {"type": "string", "description": "group for filters, e.g. 'Pickles', 'Bridal', 'Class 9-10'"},
                    "badge": {"type": "string", "description": "Only if true from profile: 'Bestseller', 'New', 'Eggless', 'Seasonal'"},
                    "duration": {"type": "string", "description": "beauty only, if known, e.g. '2-3 hrs'"},
                    "schedule": {"type": "string", "description": "education only, if known, e.g. 'Mon-Fri · 5-6 pm'"},
                    "image_query": {"type": "string", "description": "2-4 word photo search for THIS item, e.g. 'mango pickle jar', 'chocolate cake'"},
                    "photo_id": {"type": "string", "description": "Copy EXACTLY from the matching profile product if it has one (her own photo)"}},
                    "required": ["name", "description", "image_query"]},
            },
            "packages": {"type": "array", "maxItems": 3, "description": "beauty only, ONLY if she described packages",
                         "items": {"type": "object", "properties": {"name": {"type": "string"}, "price_inr": {"type": "number"},
                                   "includes": {"type": "array", "items": {"type": "string"}}}, "required": ["name", "includes"]}},
            "schedule_rows": {"type": "array", "maxItems": 6, "description": "education only, ONLY real batches she shared",
                              "items": {"type": "object", "properties": {"batch": {"type": "string"}, "days": {"type": "string"},
                                        "time": {"type": "string"}}, "required": ["batch", "days", "time"]}},
            "faculty_bio_en": {"type": "string", "description": "education only: her teaching background, only facts"},
            "process_steps": {"type": "array", "minItems": 3, "maxItems": 3, "items": _item3,
                              "description": "How a customer orders/books/joins, matching her real methods"},
            "faqs": {"type": "array", "minItems": 3, "maxItems": 5,
                     "items": {"type": "object", "properties": {"q": {"type": "string"}, "a": {"type": "string"}}, "required": ["q", "a"]},
                     "description": "Answered ONLY with facts from the profile"},
            "cta_text_en": {"type": "string", "description": "1 sentence inviting enquiries"},
            "gallery_title": {"type": "string"},
            "image_queries": {
                "type": "object",
                "properties": {
                    "hero": {"type": "string", "description": "Atmospheric hero photo search, e.g. 'artisan bakery croissants warm light'"},
                    "story": {"type": "string", "description": "Hands-at-work / workspace photo, avoid faces, e.g. 'hands kneading dough flour'"},
                    "gallery": {"type": "string", "description": "Search for 6 gallery photos in the same mood"}},
                "required": ["hero", "story", "gallery"],
                "description": "Short, concrete English photo searches (2-4 words work best, e.g. 'bridal mehndi hands', 'chocolate cake slice'). Indian context where natural.",
            },
        },
        "required": ["archetype", "palette", "business_name", "tagline_en", "hero_subtitle", "intro_en", "seo_description",
                     "area_text", "story_quote", "story_en", "marquee_words", "highlights", "products",
                     "process_steps", "faqs", "cta_text_en", "image_queries"],
    },
}


# ---------------------------------------------------------------- helpers
def validate_slug(slug: str) -> str | None:
    if not SLUG_RE.match(slug or ""):
        return "Use 3-40 lowercase letters, numbers or hyphens (e.g. sonali-achaar)."
    if (config.SITES_DIR / slug).exists() or sitestore.exists(slug):
        return "This name is already taken on Saheli. Try another."
    return None


def _clean_phone(raw):
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = "91" + digits
    return digits if 11 <= len(digits) <= 13 else None


def _clean_upi(raw):
    raw = (raw or "").strip()
    return raw if UPI_RE.match(raw) else None


def _upi_qr(upi_id, name):
    if not segno:
        return None
    try:
        return segno.make(f"upi://pay?pa={upi_id}&pn={name}&cu=INR", error="m").svg_data_uri(scale=5, border=2)
    except Exception:
        return None


def generate_content(profile: dict) -> dict:
    response = claude.client().messages.create(
        model=config.CLAUDE_MODEL,
        max_tokens=6000,
        tools=[CONTENT_TOOL],
        tool_choice={"type": "tool", "name": "write_site_content"},
        messages=[{"role": "user", "content": (
            "You are the creative director of a premium Indian web design agency. Create the website content "
            "for this woman-owned small business so it reads like a real, established brand - confident, warm, "
            "specific, never generic or cheesy. Choose the archetype and palette that fit HER business.\n"
            "LANGUAGE: write the whole website in clear, polished English (Indian English is fine). Do not use Hindi.\n"
            "STRICT: use only facts from the profile. Never invent prices, awards, years, certifications, "
            "customer numbers, reviews or testimonials.\n"
            "Image queries must describe realistic, professional stock photography (no illustrations).\n\n"
            "Profile:\n" + json.dumps(profile, ensure_ascii=False))}],
    )
    for block in response.content:
        if block.type == "tool_use":
            return block.input
    raise RuntimeError("Claude did not return site content")


PRODUCT_ORIENTATION = {"food.html": "square", "homefood.html": "square", "fashion.html": "tall", "education.html": "landscape"}


def fetch_images(content: dict, arch_key: str, folder: Path) -> dict:
    layout = design.ARCHETYPES[arch_key]["layout"]
    return images.collect_for_site(arch_key, content, folder, PRODUCT_ORIENTATION.get(layout))


def _facts(content, profile, pay):
    facts = []
    if profile.get("delivery") or "deliver" in (content.get("area_text") or "").lower():
        facts.append({"icon": "truck", "label": "Delivery", "text": (profile.get("delivery") or content["area_text"])[:42]})
    if content.get("timings_text"):
        facts.append({"icon": "clock", "label": "Hours", "text": content["timings_text"][:42]})
    if pay["upi"]:
        facts.append({"icon": "phone", "label": "Payments", "text": "UPI accepted"})
    elif pay["cod"]:
        facts.append({"icon": "cash", "label": "Payments", "text": "Cash on delivery"})
    if profile.get("years_running"):
        facts.append({"icon": "award", "label": "Experience", "text": str(profile["years_running"])[:30]})
    if not facts:
        facts.append({"icon": "pin", "label": "Location", "text": content.get("area_short") or profile.get("city", "")})
    return facts[:4]


def render_site(content: dict, profile: dict, slug: str, found: dict | None = None) -> str:
    arch_key = content.get("archetype")
    if arch_key not in design.ARCHETYPES:
        arch_key = design.CATEGORY_ARCHETYPE.get(profile.get("category", "other"), "boutique")
    arch = design.ARCHETYPES[arch_key]
    pal_key = content.get("palette") if content.get("palette") in arch["palettes"] else next(iter(arch["palettes"]))
    found = found or {}

    # sanitise icons Claude chose
    for group in ("highlights", "process_steps"):
        for item in content.get(group) or []:
            if item.get("icon") not in design.ICONS:
                item["icon"] = "sparkle"

    products = content.get("products") or []
    whatsapp = _clean_phone(profile.get("whatsapp"))
    upi = _clean_upi(profile.get("upi_id"))
    methods = [str(m).lower() for m in (profile.get("payment_methods") or [])]
    pay = {"upi": upi, "cod": any(m in methods for m in ("cod", "cash")) or not upi}
    shop_enabled = arch["layout"] in ("food.html", "homefood.html", "fashion.html") and bool(whatsapp) and any(p.get("price_inr") for p in products)

    product_imgs = [(found.get(f"p{i}") or [None])[0] for i in range(len(products))]
    gallery = found.get("gallery") or []
    # if a product photo is missing, borrow an unused gallery photo so the grid never looks broken
    spare = iter(gallery[4:])
    product_imgs = [im or next(spare, None) for im in product_imgs]

    categories = []
    for p in products:
        cat = (p.get("category") or "").strip()
        if cat and cat not in categories:
            categories.append(cat)
    grouped = [(cat, [(i, p) for i, p in enumerate(products) if (p.get("category") or "") == cat])
               for cat in (categories or [""])]
    if not categories:
        grouped = [("", list(enumerate(products)))]

    pay_labels = ([{"icon": "phone", "text": "UPI — GPay, PhonePe, Paytm"}] if upi else []) + \
                 ([{"icon": "cash", "text": "Cash"}] if pay["cod"] else []) + \
                 ([{"icon": "message", "text": "WhatsApp orders"}] if whatsapp else [])

    credits, seen = [], set()
    for lst in found.values():
        for ph in lst or []:
            if ph and ph.get("photographer") and (ph["photographer"], ph.get("source")) not in seen:
                seen.add((ph["photographer"], ph.get("source")))
                credits.append({"name": ph["photographer"], "url": ph.get("page_url") or ph.get("photographer_url"),
                                "source": ph.get("source"), "license": ph.get("license"), "license_url": ph.get("license_url")})

    url = config.site_url(slug)
    jsonld = {"@context": "https://schema.org", "@type": "LocalBusiness", "name": content.get("business_name"),
              "description": content.get("seo_description") or content.get("intro_en"), "url": url,
              "areaServed": content.get("area_short") or profile.get("city")}
    if whatsapp:
        jsonld["telephone"] = "+" + whatsapp
    if found.get("hero"):
        jsonld["image"] = found["hero"][0]["src"]

    testimonials = [t for t in (profile.get("testimonials") or []) if isinstance(t, dict) and t.get("quote") and t.get("name")]

    return _env.get_template(arch["layout"]).render(
        c=content, variant=arch["variant"], pal=arch["palettes"][pal_key], font=arch["font"], fonts_url=arch["fonts"],
        labels=arch["labels"], icons=design.ICONS, img=found, product_imgs=product_imgs, facts=_facts(content, profile, pay),
        categories=categories, grouped=grouped, testimonials=testimonials[:3], shop_enabled=shop_enabled,
        pay=pay, pay_labels=pay_labels, upi_qr=_upi_qr(upi, content.get("business_name", "")) if (upi and shop_enabled) else None,
        whatsapp=whatsapp, owner=profile.get("owner_name"), city=profile.get("city", ""),
        owner_photos=any(ph.get("owner") for ph in found.get("gallery") or []),
        agent_card_url=".well-known/agent-card.json", mcp_url=config.mcp_url(slug),
        cart_products=[{"name": p.get("name", ""), "price": float(p.get("price_inr") or 0), "unit": p.get("unit") or "",
                        "img": (product_imgs[i] or {}).get("src_small")} for i, p in enumerate(products)],
        dark_hero=arch["variant"] in ("bakery", "beauty") and bool(found.get("hero")),
        photo_credits=credits, canonical=url if url.startswith("https://") else None, jsonld=jsonld,
        api_base=config.PUBLIC_API_URL, slug=slug, year=datetime.now(timezone.utc).year,
        base_href=url if url.endswith("/") else url + "/",
        photo_sources=sorted({c["source"] for c in credits if c.get("source")}),
    )


def build_site(slug: str, profile: dict) -> dict:
    error = validate_slug(slug)
    if error:
        raise ValueError(error)
    content = generate_content(profile)
    arch_key = content.get("archetype") if content.get("archetype") in design.ARCHETYPES else \
        design.CATEGORY_ARCHETYPE.get(profile.get("category", "other"), "boutique")
    content["archetype"] = arch_key

    try:
        with sitestore.creating(slug) as draft:  # nothing is published unless every step below succeeds
            found = fetch_images(content, arch_key, draft.folder)
            (draft.folder / "index.html").write_text(render_site(content, profile, slug, found), encoding="utf-8")
            draft.data = {"content": content, "profile": profile, "images": found}
    except FileExistsError as exc:
        raise ValueError("This name is already taken on Saheli. Try another.") from exc
    photo_count = len({p["src"] for v in found.values() for p in v})
    return {"slug": slug, "url": config.site_url(slug), "content": content,
            "design": {"archetype": arch_key, "palette": content.get("palette")},
            "photos": {"count": photo_count, "sources": images.provider_names()},
            "integrations": {**config.integrations(), "photos": photo_count > 0}}


def owner_email(slug: str) -> str | None:
    return sitestore.field(slug, "profile", "email")


def business_name(slug: str) -> str:
    return sitestore.field(slug, "content", "business_name", default=slug)
