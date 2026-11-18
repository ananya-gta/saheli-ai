"""Launch verification, readiness score and the post-launch business assistant.

* verify(url)      - Saheli opens the published website herself and checks it really works.
* readiness(slug)  - a score computed ONLY from things that are actually done (no AI-invented numbers).
* assist(slug, ..) - marketing / customer-message help, saved so the owner can reuse it.
"""
import json
import time
from datetime import datetime, timezone

import httpx

from . import claude, config, mailer, orders, sitestore


# ---------------------------------------------------------------- deployment check
def verify(url: str) -> dict:
    """Fetch the live site like a visitor would and report what we found."""
    started = time.time()
    try:
        r = httpx.get(url, timeout=15, follow_redirects=True, headers={"User-Agent": "SaheliAI-verifier/1.0"})
        ms = int((time.time() - started) * 1000)
        body = r.text
        ok = r.status_code == 200 and "<html" in body.lower()
        checks = {
            "page_loads": ok,
            "https": str(r.url).startswith("https://"),
            "has_title": "<title>" in body,
            "mobile_ready": 'name="viewport"' in body,
            "enquiry_form": "form" in body and "enq" in body,
        }
        return {"ok": ok, "status": r.status_code, "ms": ms, "url": str(r.url), "checks": checks,
                "checked_at": datetime.now(timezone.utc).isoformat()}
    except Exception as exc:
        return {"ok": False, "status": None, "error": str(exc)[:200], "url": url,
                "checked_at": datetime.now(timezone.utc).isoformat()}


def record_verification(slug: str, result: dict) -> None:
    sitestore.update(slug, lambda data: data.__setitem__("verification", result))


# ---------------------------------------------------------------- readiness
def readiness(slug: str) -> dict:
    """Score = sum of completed items. Every item is a fact we can check."""
    data = sitestore.load(slug)
    c, p, imgs = data.get("content") or {}, data.get("profile") or {}, data.get("images") or {}
    products = c.get("products") or []
    owner_photos = any(ph.get("owner") for v in imgs.values() for ph in (v or []))
    verified = (data.get("verification") or {}).get("ok", False)
    https = (data.get("verification") or {}).get("checks", {}).get("https", False)
    custom_domain = bool(p.get("custom_domain"))
    vchecks = (data.get("verification") or {}).get("checks") or {}
    ms = (data.get("verification") or {}).get("ms")
    fast = ms is not None and ms < 3000          # page answered within 3 s on Saheli's own check
    cx_ok = verified and all(vchecks.get(k) for k in ("mobile_ready", "has_title", "enquiry_form"))

    def item(label, done, points, tip=None, action=None):
        return {"label": label, "done": bool(done), "points": points, "tip": None if done else tip, "action": None if done else action}

    sections = [
        ("Business identity", [
            item("Business name and identity", c.get("business_name") and c.get("tagline_en"), 5),
            item("Product and service listings", len(products) >= 1, 5, "Apne products jodiye", "chat"),
            item("Accurate product pricing", products and all(x.get("price_inr") for x in products), 5,
                 "Kuch products ka price missing hai — dashboard se boliye: 'X ka price 250 kar do'", "edit"),
            item("Business story and description", c.get("story_en"), 5),
            item("Contact and delivery information", (p.get("whatsapp") or p.get("email")) and (p.get("delivery_area") or p.get("city")), 4,
                 "Saheli ko bataiye aap kahan tak delivery karti hain", "chat"),
        ]),
        ("Online presence", [
            item("Website published", (config.SITES_DIR / slug / "index.html").exists(), 10),
            item("Verified live by Saheli", verified, 5, "Website check nahi ho paayi — dobara verify kijiye", "verify"),
            item("Website performance and HTTPS", https and fast, 5, "VPS par deploy hote hi HTTPS apne aap lag jaata hai"),
            item("Own .com domain connected", custom_domain, 5, "Apna .com chahiye to Saheli GoDaddy ka daam pehle dikhayegi — kharidna sirf aapki manzoori se", "domain"),
        ]),
        ("Customer ordering", [
            item("WhatsApp ordering setup", p.get("whatsapp"), 7, "Saheli ko apna WhatsApp number bataiye", "chat"),
            item("UPI payment setup", p.get("upi_id"), 7, "UPI ID jodiye — customers turant pay kar sakenge", "chat"),
            item("Enquiries also arrive by email", mailer.enabled(), 6, "Email abhi server par juda nahi hai — tab tak saari enquiries dashboard mein dikhti hain"),
            item("Customer-facing checks pass (mobile, title, enquiry form)", cx_ok, 4,
                 "Saheli ki live check mein kuch kami mili — dashboard se dobara check kijiye", "verify"),
            item("First customer order received", orders.stats(slug)["count"] > 0, 5,
                 "Website ka link 5 purane customers ko WhatsApp par bhejiye — pehla order yahin dikhega", "share"),
        ]),
        ("Trust", [
            item("Original product photographs", owner_photos, 8, "Camera button se apne products ki asli photos bhejiye", "chat"),
            item("Real customer words", p.get("testimonials"), 4, "Kisi khush customer ki baat Saheli ko bataiye", "chat"),
            item("Visible to AI assistants (MCP)", (config.SITES_DIR / slug / ".well-known" / "agent-card.json").exists(), 3),
        ]),
        ("Marketing", [
            item("Launch announcements and promotional content", data.get("marketing"), 6, "Assistant se Instagram posts ya WhatsApp message banwaiye", "assist"),
            item("Growth plan", p.get("has_growth_plan") or data.get("growth_plan"), 4, "Saheli se growth plan maangiye", "chat"),
        ]),
    ]
    out, total, got = [], 0, 0
    for name, items in sections:
        s_total = sum(i["points"] for i in items)
        s_got = sum(i["points"] for i in items if i["done"])
        total += s_total
        got += s_got
        out.append({"name": name, "score": round(100 * s_got / s_total), "items": items})
    next_steps = [i for _, items in sections for i in items if not i["done"]]
    # steps she can act on herself come first; server-side setup (no action) comes last
    # paid upgrades (own .com) never headline over free, useful actions
    next_steps.sort(key=lambda i: (i["action"] is None, i["action"] == "domain", -i["points"]))
    score = round(100 * got / total)
    return {"score": score, "sections": out, "next_steps": next_steps[:3],
            "message": _message(p.get("owner_name"), verified, next_steps[0] if next_steps else None, score)}


def _message(owner: str | None, live: bool, nxt: dict | None, score: int) -> str:
    """One warm, specific sentence: where she stands and the single most useful next step."""
    who = f"{owner} ji" if owner else "Aapki"
    head = (f"{who}, aapki website live hai!" if owner else "Aapki website live hai!") if live else \
        (f"{who}, website ban gayi hai — bas live check baaki hai." if owner else "Website ban gayi hai — bas live check baaki hai.")
    if not nxt:
        return head + " Sab kuch taiyaar hai. Ab link zyada se zyada customers tak pahunchaiye."
    return f"{head} Agla kadam: {nxt['tip'] or nxt['label']}."


# ---------------------------------------------------------------- business assistant
TASKS = {
    "instagram": "Write 5 Instagram posts (caption + 5-8 relevant hashtags each) to launch and promote this business. Vary them: launch announcement, product spotlight, behind the scenes, customer-order call to action, offer.",
    "whatsapp": "Write a WhatsApp broadcast message announcing the new website to existing customers, plus a shorter WhatsApp Status version. Include the website link.",
    "festival": "Write a festive/seasonal offer campaign for the next major Indian festival or season: a short offer headline, WhatsApp message, Instagram caption and website banner text. Do not invent discounts - suggest a placeholder like [X% off] for her to decide.",
    "order_confirmation": "Write 3 ready-to-use customer message templates: order confirmation, out-for-delivery, and thank-you + ask for feedback.",
    "improve": "Review this website content and suggest the 5 most valuable improvements, most important first, each with why it matters and exactly what to do.",
}

ASSIST_TOOL = {
    "name": "assistant_output",
    "description": "Return ready-to-use content for the business owner.",
    "input_schema": {"type": "object", "properties": {
        "title": {"type": "string", "description": "Short Hinglish title"},
        "items": {"type": "array", "minItems": 1, "maxItems": 8, "items": {"type": "object", "properties": {
            "heading": {"type": "string"}, "text": {"type": "string", "description": "Ready to copy-paste"}}, "required": ["heading", "text"]}},
        "tip": {"type": "string", "description": "One practical Hinglish tip"}},
        "required": ["title", "items"]},
}


def assist(slug: str, task: str, request: str = "") -> dict:
    data = sitestore.load(slug)
    c, p = data.get("content") or {}, data.get("profile") or {}
    brief = {
        "business": c.get("business_name"), "tagline": c.get("tagline_en"), "about": c.get("intro_en"),
        "area": c.get("area_text"), "products": [{k: x.get(k) for k in ("name", "price_inr", "unit", "description")} for x in c.get("products") or []],
        "website": config.site_url(slug), "whatsapp": p.get("whatsapp"), "language_pref": p.get("language", "hinglish"),
    }
    instruction = TASKS.get(task) or ("Help with this request: " + request)
    if request and task in TASKS:
        instruction += f"\nExtra wishes from the owner: {request}"
    resp = claude.client().messages.create(
        model=config.CLAUDE_MODEL, max_tokens=3000, tools=[ASSIST_TOOL], tool_choice={"type": "tool", "name": "assistant_output"},
        messages=[{"role": "user", "content": (
            "You are Saheli, a marketing and business assistant for a small Indian business. "
            f"{instruction}\nWrite customer-facing text in the language mix her customers use (Hinglish/English; "
            "Hindi in Devanagari only if she prefers Hindi). Use only facts from the business data. Never invent "
            "prices, discounts, reviews or awards.\n\nBusiness data:\n" + json.dumps(brief, ensure_ascii=False))}])
    out = next((b.input for b in resp.content if b.type == "tool_use"), None)
    if not out:
        raise RuntimeError("Assistant returned nothing")
    entry = {"task": task, "request": request, "output": out, "created_at": datetime.now(timezone.utc).isoformat()}

    def remember(d: dict) -> None:  # re-read under the lock: the Claude call above took seconds
        d["marketing"] = (d.get("marketing") or [])[-19:] + [entry]
    sitestore.update(slug, remember)
    return out
