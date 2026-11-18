"""The owner's rights over her data (India's DPDP Act 2023): see everything we hold, and erase it.

export()  - one JSON document with her account, websites (saved data), orders and enquiries.
delete()  - erases her account, sessions, websites (public files + private data), orders, enquiries and photos.
            Irreversible; the API asks her to type her email to confirm.
"""
import logging
from datetime import datetime, timezone

from . import auth, catalog, db, enquiries, orders, sitestore

log = logging.getLogger("saheli")


def export(user: dict) -> dict:
    sites = []
    for slug in auth.user_sites(user["id"]):
        try:
            data = sitestore.load(slug)
        except sitestore.SiteNotFound:
            data = None
        sites.append({"slug": slug, "data": data, "orders": orders.list_(slug, limit=100_000),
                      "enquiries": enquiries.load(slug, limit=100_000)})
    photos = [r["photo_id"] for r in db.all_("SELECT photo_id FROM photos WHERE owner_id = ?", user["id"])]
    return {"exported_at": datetime.now(timezone.utc).isoformat(),
            "account": {k: user.get(k) for k in ("id", "email", "name", "created_at", "last_login_at")},
            "websites": sites, "uploaded_photo_ids": photos}


def delete(user: dict) -> dict:
    slugs = auth.user_sites(user["id"])
    photos = [r["photo_id"] for r in db.all_("SELECT photo_id FROM photos WHERE owner_id = ?", user["id"])]
    # database first, in one transaction: if anything fails, nothing is half-deleted
    with db.tx() as c:
        for slug in slugs:
            c.execute("DELETE FROM orders WHERE slug = ?", (slug,))
            c.execute("DELETE FROM enquiries WHERE slug = ?", (slug,))
        c.execute("DELETE FROM login_codes WHERE email = ?", (user["email"],))
        c.execute("DELETE FROM login_throttle WHERE email = ?", (user["email"],))
        c.execute("DELETE FROM users WHERE id = ?", (user["id"],))  # cascades: sessions, sites, photos
    # then files (a website taken offline even if a file removal below fails)
    for slug in slugs:
        sitestore.remove(slug)
    for pid in photos:
        path = catalog.photo_path(pid)
        if path:
            path.unlink(missing_ok=True)
    log.info("account %s deleted: %d websites, %d photos", user["id"], len(slugs), len(photos))
    return {"deleted": True, "websites": len(slugs), "photos": len(photos)}

