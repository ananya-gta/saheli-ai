"""Agent-ready storefront.

Every generated website is also usable by AI assistants:
  * /.well-known/agent-card.json  - A2A-style agent card describing the business and its skills
  * /llms.txt                     - plain-text summary for LLMs
  * POST {API}/mcp/<slug>         - a minimal MCP server (JSON-RPC 2.0 over HTTP) with tools:
                                    get_business_info, list_products, send_enquiry
So a customer can ask their own assistant "order 2 jars of mango pickle from Sonali's Achaar"
and the enquiry lands in the owner's inbox.
"""
import json

from . import config, enquiries, orders, sitestore

PROTOCOL_VERSION = "2025-06-18"


def _site(slug: str) -> dict:
    return sitestore.load(slug)


def business_info(slug: str) -> dict:
    data = _site(slug)
    c, p = data["content"], data.get("profile") or {}
    return {
        "name": c.get("business_name"), "tagline": c.get("tagline_en"), "about": c.get("intro_en"),
        "owner": p.get("owner_name"), "area": c.get("area_text"), "hours": c.get("timings_text") or None,
        "website": config.site_url(slug), "whatsapp": ("+" + p["whatsapp"].lstrip("+")) if p.get("whatsapp") else None,
        "payment_methods": p.get("payment_methods") or [], "how_to_order": [s.get("text") for s in c.get("process_steps") or []],
        "faqs": c.get("faqs") or [],
    }


def products(slug: str, category: str | None = None) -> list[dict]:
    out = []
    for i, item in enumerate(_site(slug)["content"].get("products") or []):
        if category and (item.get("category") or "").lower() != category.lower():
            continue
        out.append({"index": i, **{k: item.get(k) for k in ("name", "price_inr", "unit", "description", "category", "duration", "schedule") if item.get(k)}})
    return out


def write_files(slug: str) -> None:
    """Write agent-card.json and llms.txt into the site folder."""
    info, items = business_info(slug), products(slug)
    card = {
        "name": info["name"],
        "description": f"{info['tagline']}. {info['about']}",
        "url": config.mcp_url(slug),
        "version": "1.0.0",
        "provider": {"organization": info["name"], "url": info["website"]},
        "documentationUrl": info["website"] + "llms.txt" if info["website"].endswith("/") else info["website"] + "/llms.txt",
        "capabilities": {"streaming": False, "pushNotifications": False},
        "defaultInputModes": ["text"], "defaultOutputModes": ["text"],
        "protocols": {"mcp": {"transport": "streamable-http", "endpoint": config.mcp_url(slug)}},
        "skills": [
            {"id": "get_business_info", "name": "Business information", "description": "Location, hours, payment and ordering details.",
             "tags": ["info"], "examples": [f"Where does {info['name']} deliver?"]},
            {"id": "list_products", "name": "Products and prices", "description": "Current products/services with prices.",
             "tags": ["catalog"], "examples": [f"What does {info['name']} sell?"]},
            {"id": "place_order", "name": "Place an order", "description": "Order priced products by index; returns an order number and UPI payment link.",
             "tags": ["order", "payment"]},
            {"id": "send_enquiry", "name": "Send an order or enquiry", "description": "Send an order request or question to the owner.",
             "tags": ["order", "booking"], "examples": ["I'd like to order two of your bestsellers"]},
        ],
    }
    sitestore.write_public(slug, ".well-known/agent-card.json", json.dumps(card, ensure_ascii=False, indent=2))
    lines = [f"# {info['name']}", "", f"> {info['tagline']}", "", info["about"] or "", "",
             f"- Area: {info['area']}"] + ([f"- Hours: {info['hours']}"] if info["hours"] else []) + \
            ([f"- WhatsApp: {info['whatsapp']}"] if info["whatsapp"] else []) + \
            [f"- AI agents: MCP endpoint {config.mcp_url(slug)} (tools: get_business_info, list_products, place_order, send_enquiry)", "",
             "## Products", ""] + \
            [f"- {p['name']}" + (f" — ₹{int(p['price_inr'])}" if p.get("price_inr") else "") + (f" / {p['unit']}" if p.get("unit") else "")
             + (f": {p['description']}" if p.get("description") else "") for p in items]
    sitestore.write_public(slug, "llms.txt", "\n".join(lines) + "\n")


TOOLS = [
    {"name": "get_business_info", "description": "Get the business's details: about, area served, hours, payment and how to order.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "list_products", "description": "List products or services with prices in INR.",
     "inputSchema": {"type": "object", "properties": {"category": {"type": "string", "description": "Optional category filter"}}}},
    {"name": "place_order", "description": "Place an order for priced products (use the index from list_products). Ask the customer for their name, phone and delivery address first, and confirm the items and total with them before calling. Returns an order number and, for UPI, a payment link that pays the owner directly.",
     "inputSchema": {"type": "object", "properties": {
         "items": {"type": "array", "items": {"type": "object", "properties": {"index": {"type": "integer"}, "qty": {"type": "integer", "minimum": 1}}, "required": ["index", "qty"]}},
         "name": {"type": "string"}, "phone": {"type": "string"}, "address": {"type": "string"}, "pincode": {"type": "string"},
         "payment_method": {"type": "string", "enum": ["upi", "cod"]},
         "idempotency_key": {"type": "string", "description": "Optional, 8-64 letters/digits/-/_. Reuse the same key when retrying so the order is not placed twice."}},
         "required": ["items", "name", "phone"]}},
    {"name": "send_enquiry", "description": "Send an order request or question to the business owner. Ask the customer for their name and phone first.",
     "inputSchema": {"type": "object", "properties": {
         "name": {"type": "string"}, "phone": {"type": "string"}, "message": {"type": "string", "description": "What they want, quantities, dates"},
         "email": {"type": "string"}}, "required": ["name", "phone", "message"]}},
]


def handle(slug: str, msg: dict) -> dict | None:
    """Handle one JSON-RPC message. Returns a response dict, or None for notifications."""
    mid, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}

    def ok(result):
        return {"jsonrpc": "2.0", "id": mid, "result": result}

    def err(code, text):
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": text}}

    if mid is None:  # notification (e.g. notifications/initialized)
        return None
    if method == "initialize":
        return ok({"protocolVersion": params.get("protocolVersion") or PROTOCOL_VERSION,
                   "capabilities": {"tools": {"listChanged": False}},
                   "serverInfo": {"name": f"saheli-{slug}", "version": "1.0.0"},
                   "instructions": f"Storefront for {business_info(slug)['name']}. Use list_products, then send_enquiry to place an order request."})
    if method == "ping":
        return ok({})
    if method == "tools/list":
        return ok({"tools": TOOLS})
    if method == "tools/call":
        name, args = params.get("name"), params.get("arguments") or {}
        try:
            if name == "get_business_info":
                data = business_info(slug)
            elif name == "list_products":
                data = {"products": products(slug, args.get("category"))}
            elif name == "place_order":
                try:
                    res = orders.create(slug, args.get("items") or [], {k: str(args.get(k) or "") for k in ("name", "phone", "address", "pincode")},
                                        args.get("payment_method") or "upi", channel="agent",
                                        idempotency_key=(str(args["idempotency_key"]) if args.get("idempotency_key") else None))
                except orders.OrderError as exc:
                    return ok({"content": [{"type": "text", "text": str(exc)}], "isError": True})
                data = {k: res[k] for k in ("code", "total", "items", "payment_method", "upi_link", "upi_id")}
                data["note"] = ("Share upi_link with the customer to pay the owner directly. " if res["upi_link"] else "") + \
                    "The owner has been notified and will confirm on WhatsApp or phone."
            elif name == "send_enquiry":
                if not all(str(args.get(k, "")).strip() for k in ("name", "phone", "message")):
                    return ok({"content": [{"type": "text", "text": "Please provide name, phone and message."}], "isError": True})
                clean = {k: str(args.get(k, ""))[:2000] for k in ("name", "phone", "message", "email")}
                res = enquiries.save_and_notify(slug, clean, channel="agent")
                data = {"status": "sent", "note": "The owner will contact the customer on WhatsApp or phone.", **{k: res[k] for k in ("saved", "email_queued")}}
            else:
                return err(-32602, f"Unknown tool: {name}")
        except FileNotFoundError:
            return err(-32004, "Business not found")
        return ok({"content": [{"type": "text", "text": json.dumps(data, ensure_ascii=False)}],
                   "structuredContent": data, "isError": False})
    return err(-32601, f"Method not found: {method}")
