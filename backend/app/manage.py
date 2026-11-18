"""Admin commands.

    python -m app.manage claim-sites you@example.com   # give all ownerless website folders to this user
    python -m app.manage users                         # list users and their websites
"""
import sys

from . import auth, db, sitestore


def claim_sites(email: str) -> None:
    user = auth.get_or_create_user(email)
    claimed = 0
    for slug in sitestore.slugs():
        if auth.site_owner(slug) is None:
            auth.assign_site(slug, user["id"])
            claimed += 1
            print("  claimed", slug)
    print(f"{claimed} website(s) now belong to {user['email']}")


def users() -> None:
    for u in db.all_("SELECT id, email, name, last_login_at FROM users ORDER BY id"):
        print(f"{u['id']:3d}  {u['email']:32s} {u['name'] or '':16s} last login: {u['last_login_at'] or '-'}  sites: {', '.join(auth.user_sites(u['id'])) or '-'}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "claim-sites" and len(sys.argv) == 3:
        claim_sites(sys.argv[2])
    elif cmd == "users":
        users()
    else:
        print(__doc__)
