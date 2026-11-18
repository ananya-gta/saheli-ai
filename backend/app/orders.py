"""Customer orders placed on a generated website (or by an AI agent via MCP).

Payment states: 'pending' (customer may have paid by UPI, unknown to us) -> 'paid' only when the owner confirms
she received it (recorded with time and paid_confirmed_by='owner'). There is no gateway verification.

Prices are always recomputed on the server from the site's current product list — the browser only
sends which items and how many. Payments go straight to the owner's UPI ID; Saheli has no payment
gateway, so an order stays 'payment pending' until the owner marks it paid in her dashboard.

Idempotency: the website (and AI agents) send an idempotency key per checkout. Retrying with the same key —
a double tap, a flaky network, an agent repeating a tool call — returns the first order instead of a duplicate.
"""
import json
import logging
import re
import sqlite3
from urllib.parse import quote

from . import config, db, mailer, sitegen, sitestore

log = logging.getLogger("saheli")
IDEM_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")

STATUSES = ("new", "confirmed", "delivered", "cancelled")
PAYMENT_STATUSES = ("pending", "paid")
MAX_ITEMS, MAX_QTY = 30, 99


class OrderError(ValueError):
    pass


def _site(slug: str) -> dict:
    try:
        return sitestore.load(slug)
    except sitestore.SiteNotFound:
        raise OrderError("Website not found")


def _money(n: float) -> str:
    return "₹" + f"{round(n):,}"


def code(number: int) -> str:
    return f"#{number}"


def create(slug: str, items: list[dict], customer: dict, payment_method: str, channel: str = "website",
           idempotency_key: str | None = None) -> dict:
    if idempotency_key is not None and not IDEM_RE.match(idempotency_key):
        raise OrderError("Invalid idempotency key")
    if idempotency_key and (prev := _by_key(slug, idempotency_key)):
        return {**_result(slug, prev), "replayed": True}
    data = _site(slug)
    products = (data.get("content") or {}).get("products") or []
    profile = data.get("profile") or {}
    upi = sitegen._clean_upi(profile.get("upi_id"))

    if not items or len(items) > MAX_ITEMS:
        raise OrderError("Your bag is empty")
    lines, total = [], 0.0
    for it in items:
        try:
            idx, qty = int(it.get("index")), int(it.get("qty"))
        except (TypeError, ValueError):
            raise OrderError("Invalid item")
        if not (0 <= idx < len(products)) or not (1 <= qty <= MAX_QTY):
            raise OrderError("Invalid item")
        p = products[idx]
        # the menu may have been edited after the customer opened the page
        if it.get("name") and it["name"].strip().lower() != (p.get("name") or "").strip().lower():
            raise OrderError("The menu was just updated. Please refresh the page and add your items again.")
        price = float(p.get("price_inr") or 0)
        if price <= 0:
            raise OrderError(f"{p.get('name')} has no price yet. Please send an enquiry instead.")
        lines.append({"name": p.get("name"), "unit": p.get("unit") or "", "qty": qty, "price": price, "amount": price * qty})
        total += price * qty

    name = (customer.get("name") or "").strip()[:100]
    phone = re.sub(r"[^\d+]", "", customer.get("phone") or "")[:20]
    if not name or len(re.sub(r"\D", "", phone)) < 10:
        raise OrderError("Please enter your name and a valid phone number")
    if payment_method not in ("upi", "cod"):
        raise OrderError("Choose a payment method")
    if payment_method == "upi" and not upi:
        payment_method = "cod"

    try:
        with db.tx() as c:  # BEGIN IMMEDIATE: the next number can't be taken by a concurrent order
            number = (c.execute("SELECT COALESCE(MAX(number), 1000) FROM orders WHERE slug = ?", (slug,)).fetchone()[0]) + 1
            oid = c.execute(
                "INSERT INTO orders (slug, number, items, total, customer_name, customer_phone, address, pincode,"
                " payment_method, channel, idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (slug, number, json.dumps(lines, ensure_ascii=False), total, name, phone,
                 (customer.get("address") or "").strip()[:500] or None, (customer.get("pincode") or "").strip()[:10] or None,
                 payment_method, channel, idempotency_key or None)).lastrowid
    except sqlite3.IntegrityError:
        if idempotency_key and (prev := _by_key(slug, idempotency_key)):  # the same checkout raced itself
            return {**_result(slug, prev), "replayed": True}
        raise

    order = get(slug, oid)
    out = _result(slug, order)
    out["email_queued"] = _notify(slug, order, sitegen.business_name(slug))
    return out


def _by_key(slug: str, key: str) -> dict | None:
    r = db.one("SELECT * FROM orders WHERE slug = ? AND idempotency_key = ?", slug, key)
    return _row(r) if r else None


def _result(slug: str, order: dict) -> dict:
    """What the customer (or their AI agent) gets back for an order."""
    profile = sitestore.field(slug, "profile", default={}) or {}
    upi = sitegen._clean_upi(profile.get("upi_id"))
    whatsapp = sitegen._clean_phone(profile.get("whatsapp"))
    business = sitegen.business_name(slug)
    is_upi = order["payment_method"] == "upi"
    return {
        "ok": True, "id": order["id"], "number": order["number"], "code": code(order["number"]), "total": order["total"],
        "items": order["items"], "payment_method": order["payment_method"],
        "upi_link": upi_link(upi, business, order["total"], order["number"]) if is_upi else None,
        "upi_id": upi if is_upi else None,
        "whatsapp_url": f"https://wa.me/{whatsapp}?text={quote(whatsapp_text(order, business))}" if whatsapp else None,
        "email_queued": False,
    }


def upi_link(upi: str | None, business: str, total: float, number: int) -> str | None:
    if not upi:
        return None
    return (f"upi://pay?pa={quote(upi, safe='@')}&pn={quote(business)}&am={total:.2f}&cu=INR"
            f"&tn={quote(f'Order {code(number)} {business}'[:60])}")


def whatsapp_text(o: dict, business: str) -> str:
    rows = [f"*New order {code(o['number'])} — {business}*", ""]
    for i in o["items"]:
        unit = f" ({i['unit']})" if i.get("unit") else ""
        rows.append(f"• {i['name']}{unit} × {i['qty']} = {_money(i['amount'])}")
    rows += ["", f"*Total: {_money(o['total'])}*", "", f"Name: {o['customer_name']}", f"Phone: {o['customer_phone']}"]
    if o.get("pincode"):
        rows.append(f"Pincode: {o['pincode']}")
    if o.get("address"):
        rows.append(f"Address: {o['address']}")
    rows.append("Payment: " + ("UPI" if o["payment_method"] == "upi" else "Cash on delivery"))
    return "\n".join(rows)


def _notify(slug: str, o: dict, business: str) -> bool:
    to = sitegen.owner_email(slug) or config.MAIL_TO
    body = whatsapp_text(o, business).replace("*", "")
    body += ("\n\nPayment goes directly to your UPI ID. Check your UPI app, then mark it paid in your Saheli dashboard."
             if o["payment_method"] == "upi" else "\n\nCollect cash on delivery, then mark it paid in your Saheli dashboard.")
    body += "\n\n— Sent by Saheli AI"
    return mailer.send_later(to, f"New order {code(o['number'])} for {business}: {_money(o['total'])}", body,
                             what=f"order email for {slug}")


def _row(r: dict) -> dict:
    r = dict(r)
    r["items"] = json.loads(r["items"])
    r["code"] = code(r["number"])
    return r


def get(slug: str, oid: int) -> dict | None:
    r = db.one("SELECT * FROM orders WHERE slug = ? AND id = ?", slug, oid)
    return _row(r) if r else None


def list_(slug: str, limit: int = 100) -> list[dict]:
    return [_row(r) for r in db.all_("SELECT * FROM orders WHERE slug = ? ORDER BY id DESC LIMIT ?", slug, limit)]


def update(slug: str, oid: int, status: str | None = None, payment_status: str | None = None) -> dict:
    if status and status not in STATUSES:
        raise OrderError("Invalid status")
    if payment_status and payment_status not in PAYMENT_STATUSES:
        raise OrderError("Invalid payment status")
    if not get(slug, oid):
        raise OrderError("Order not found")
    sets, args = [], []
    if status:
        sets.append("status = ?")
        args.append(status)
    if payment_status:
        paid = payment_status == "paid"
        # Saheli has no payment gateway: "paid" always means the OWNER confirmed she received the money
        sets += ["payment_status = ?", "paid_confirmed_at = " + ("datetime('now')" if paid else "NULL"), "paid_confirmed_by = ?"]
        args += [payment_status, "owner" if paid else None]
    if sets:
        db.run(f"UPDATE orders SET {', '.join(sets)}, updated_at = datetime('now') WHERE slug = ? AND id = ?", *args, slug, oid)
    return get(slug, oid)


def stats(slug: str) -> dict:
    r = db.one("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN payment_status='paid' THEN total END),0) AS paid,"
               " COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total END),0) AS value FROM orders WHERE slug = ?", slug)
    return {"count": r["n"], "paid_total": r["paid"], "order_value": r["value"]}
