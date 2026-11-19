"""Platform owner's view: how many people use Saheli and what they use. Admins are the ADMIN_EMAILS in .env.

Usage is counted as events (one row per chat message, site built, edit, ...): no message text is stored.
"""
import logging

from . import db

log = logging.getLogger("saheli.admin")

KINDS = ("chat", "build", "edit", "photos", "assist", "voice")


def track(user_id: int | None, kind: str) -> None:
    """Count one use of a feature. Never breaks the request it is counting."""
    try:
        db.run("INSERT INTO usage_events (user_id, kind) VALUES (?, ?)", user_id, kind)
    except Exception:  # noqa: BLE001
        log.exception("usage event %s not recorded", kind)


def _n(sql: str, *args) -> float:
    row = db.one(sql, *args)
    return next(iter(row.values())) or 0 if row else 0


def stats() -> dict:
    since = lambda days: f"-{days} days"  # noqa: E731
    totals = {
        "users": _n("SELECT COUNT(*) FROM users"),
        "users_new_7d": _n("SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', ?)", since(7)),
        "users_active_7d": _n("SELECT COUNT(DISTINCT user_id) FROM usage_events WHERE at >= datetime('now', ?)", since(7)),
        "sites": _n("SELECT COUNT(*) FROM sites"),
        "sites_new_7d": _n("SELECT COUNT(*) FROM sites WHERE created_at >= datetime('now', ?)", since(7)),
        "orders": _n("SELECT COUNT(*) FROM orders"),
        "order_value": _n("SELECT COALESCE(SUM(total), 0) FROM orders"),
        "enquiries": _n("SELECT COUNT(*) FROM enquiries"),
        "contact_messages": _n("SELECT COUNT(*) FROM contact_messages"),
        "users_with_site": _n("SELECT COUNT(DISTINCT owner_id) FROM sites"),
        "users_with_order": _n("SELECT COUNT(DISTINCT s.owner_id) FROM orders o JOIN sites s ON s.slug = o.slug"),
    }
    usage = {k: {"total": 0, "last_7d": 0} for k in KINDS}
    for r in db.all_("SELECT kind, COUNT(*) AS total, SUM(at >= datetime('now', ?)) AS last_7d FROM usage_events GROUP BY kind", since(7)):
        usage[r["kind"]] = {"total": r["total"], "last_7d": r["last_7d"] or 0}
    daily = db.all_(
        "SELECT date(at) AS day, COUNT(*) AS events, COUNT(DISTINCT user_id) AS users FROM usage_events "
        "WHERE at >= datetime('now', ?) GROUP BY day ORDER BY day", since(14))
    users = db.all_(
        "SELECT u.id, u.email, u.name, u.created_at, u.last_login_at, "
        "(SELECT COUNT(*) FROM sites s WHERE s.owner_id = u.id) AS sites, "
        "(SELECT COUNT(*) FROM usage_events e WHERE e.user_id = u.id AND e.kind = 'chat') AS chats, "
        "(SELECT COUNT(*) FROM orders o JOIN sites s ON s.slug = o.slug WHERE s.owner_id = u.id) AS orders, "
        "(SELECT MAX(at) FROM usage_events e WHERE e.user_id = u.id) AS last_active "
        "FROM users u ORDER BY COALESCE(last_active, u.last_login_at, u.created_at) DESC LIMIT 100")
    sites = db.all_(
        "SELECT s.slug, s.created_at, u.email AS owner, "
        "(SELECT COUNT(*) FROM orders o WHERE o.slug = s.slug) AS orders, "
        "(SELECT COUNT(*) FROM enquiries q WHERE q.slug = s.slug) AS enquiries "
        "FROM sites s JOIN users u ON u.id = s.owner_id ORDER BY s.created_at DESC LIMIT 100")
    messages = db.all_("SELECT name, email, topic, message, received_at FROM contact_messages ORDER BY id DESC LIMIT 20")
    return {"totals": totals, "usage": usage, "daily": daily, "users": users, "sites": sites, "messages": messages}
