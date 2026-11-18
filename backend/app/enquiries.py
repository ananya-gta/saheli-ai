"""Store website enquiries and email them to the owner (shared by the web form and the MCP endpoint).

Enquiries hold customers' names and phone numbers, so they live in the database — never in the
website folder the web server publishes.
"""
import json
import logging
from datetime import datetime, timezone

from . import config, db, mailer, sitestore

log = logging.getLogger("saheli")


def _import_legacy(slug: str) -> None:
    """Older versions kept enquiries in <site>/enquiries.jsonl (inside the web root). Move them once."""
    legacy = sitestore.folder(slug) / "enquiries.jsonl"
    if not legacy.exists():
        return
    rows = [json.loads(line) for line in legacy.read_text(encoding="utf-8").splitlines() if line.strip()]
    with db.tx() as c:
        for r in rows:
            c.execute("INSERT INTO enquiries(slug, data, channel, received_at) VALUES (?,?,?,?)",
                      (slug, json.dumps(r, ensure_ascii=False), r.get("channel", "website"), r.get("received_at", "")))
    legacy.unlink()
    log.info("moved %d legacy enquiries for %s into the database", len(rows), slug)


def save_and_notify(slug: str, data: dict, channel: str = "website") -> dict:
    record = {**{k: v for k, v in data.items() if v not in (None, "")}, "channel": channel,
              "received_at": datetime.now(timezone.utc).isoformat()}
    db.run("INSERT INTO enquiries(slug, data, channel, received_at) VALUES (?,?,?,?)",
           slug, json.dumps(record, ensure_ascii=False), channel, record["received_at"])

    queued = False
    to = sitestore.field(slug, "profile", "email") or config.MAIL_TO
    if mailer.enabled() and to:
        name = sitestore.field(slug, "content", "business_name", default=slug)
        via = "an AI assistant (via your agent-ready storefront)" if channel == "agent" else "your website"
        lines = [f"New enquiry from {via}: {config.site_url(slug)}", ""]
        for label, key in (("Name", "name"), ("Phone", "phone"), ("Email", "email"), ("Interested in", "interest"),
                           ("Preferred date", "date"), ("Area", "area"), ("Class", "grade")):
            if data.get(key):
                lines.append(f"{label}: {data[key]}")
        lines += ["", "Message:", data.get("message", ""), "", "— Sent by Saheli AI"]
        queued = mailer.send_later(to, f"New enquiry for {name}: {data.get('name', '')}", "\n".join(lines),
                                   reply_to=data.get("email") or None, what=f"enquiry email for {slug}")
    return {"ok": True, "saved": True, "email_queued": queued, "email_configured": mailer.enabled()}


def load(slug: str, limit: int = 500) -> list[dict]:
    """Newest first."""
    _import_legacy(slug)
    return [json.loads(r["data"]) for r in
            db.all_("SELECT data FROM enquiries WHERE slug = ? ORDER BY id DESC LIMIT ?", slug, limit)]


def count(slug: str) -> int:
    _import_legacy(slug)
    return db.one("SELECT COUNT(*) AS n FROM enquiries WHERE slug = ?", slug)["n"]
