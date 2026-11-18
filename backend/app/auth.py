"""Passwordless login with a 6-digit email code, cookie sessions, and site ownership checks.

Security choices:
  * Codes and session tokens are stored only as HMAC-SHA256 hashes (keyed with SECRET_KEY).
  * Codes expire in 10 minutes, allow 5 attempts, can be re-sent at most once a minute and 10 times a day.
  * Sessions are random 256-bit tokens in an HttpOnly, SameSite=Lax cookie (Secure in production).
  * Every owner-only API checks that the logged-in user owns the website (403 otherwise).
"""
import hashlib
import hmac
import logging
import re
import secrets
import time

from fastapi import Depends, HTTPException, Request, Response

from . import config, db, mailer

COOKIE = "saheli_session"
CODE_TTL = 10 * 60
RESEND_AFTER = 60
MAX_ATTEMPTS = 5
MAX_CODES_PER_DAY = 10  # with MAX_ATTEMPTS per code: at most 50 guesses per email per day, whatever the IP
log = logging.getLogger("saheli")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[a-zA-Z]{2,24}$")


def _h(value: str) -> str:
    return hmac.new(config.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def normalise_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Sahi email address daaliye (jaise naam@gmail.com)")
    return email


# ---------------------------------------------------------------- login codes
def request_code(email: str) -> dict:
    email = normalise_email(email)
    now = int(time.time())
    row = db.one("SELECT sent_at FROM login_codes WHERE email = ?", email)
    if row and now - row["sent_at"] < RESEND_AFTER:
        raise HTTPException(429, f"Code abhi bheja gaya hai. {RESEND_AFTER - (now - row['sent_at'])} second baad dobara maangiye.")
    day = db.one("SELECT window_start, sends FROM login_throttle WHERE email = ?", email)
    if day and now - day["window_start"] < 86400 and day["sends"] >= MAX_CODES_PER_DAY:
        raise HTTPException(429, "Aaj ke liye bahut saare codes maange gaye. Kal dobara koshish kijiye.")
    db.run("INSERT INTO login_throttle(email, window_start, sends) VALUES (?,?,1) ON CONFLICT(email) DO UPDATE SET "
           "sends = CASE WHEN ? - window_start < 86400 THEN sends + 1 ELSE 1 END, "
           "window_start = CASE WHEN ? - window_start < 86400 THEN window_start ELSE ? END", email, now, now, now, now)
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.run("INSERT INTO login_codes(email, code_hash, expires_at, attempts, sent_at) VALUES (?,?,?,0,?) "
           "ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, sent_at=excluded.sent_at",
           email, _h(f"{email}:{code}"), now + CODE_TTL, now)

    if mailer.enabled():
        try:
            mailer.send(email, f"Saheli AI login code: {code}",
                        f"Namaste!\n\nAapka Saheli AI login code hai: {code}\n\nYe code 10 minute tak chalega. "
                        "Agar aapne ye nahi maanga tha, to is email ko ignore kar dijiye.\n\n— Saheli AI")
            return {"sent": True, "via": "email"}
        except Exception as exc:
            log.error("could not email the login code: %r", exc)
            if not config.dev_login_codes():
                raise HTTPException(502, "Email nahi bhej paaye. Thodi der baad try kijiye.") from exc
    if config.dev_login_codes():
        log.warning("DEV LOGIN CODE for %s: %s", email, code)
        return {"sent": True, "via": "dev", "dev_code": code}
    raise HTTPException(503, "Login email abhi set nahi hai. Admin se SMTP settings set karwaiye.")


def verify_code(email: str, code: str, user_agent: str = "") -> tuple[dict, str]:
    email = normalise_email(email)
    code = re.sub(r"\D", "", code or "")
    row = db.one("SELECT * FROM login_codes WHERE email = ?", email)
    now = int(time.time())
    if not row or row["expires_at"] < now:
        raise HTTPException(400, "Code expire ho gaya. Naya code maangiye.")
    if row["attempts"] >= MAX_ATTEMPTS:
        raise HTTPException(429, "Bahut baar galat code. Naya code maangiye.")
    if not hmac.compare_digest(row["code_hash"], _h(f"{email}:{code}")):
        db.run("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?", email)
        left = MAX_ATTEMPTS - row["attempts"] - 1
        raise HTTPException(400, f"Code galat hai. {left} koshish baaki." if left > 0 else "Bahut baar galat code. Naya code maangiye.")
    db.run("DELETE FROM login_codes WHERE email = ?", email)

    user = db.one("SELECT * FROM users WHERE email = ?", email)
    if not user:
        uid = db.run("INSERT INTO users(email) VALUES (?)", email)
        user = db.one("SELECT * FROM users WHERE id = ?", uid)
    db.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", user["id"])

    token = secrets.token_urlsafe(32)
    db.run("INSERT INTO sessions(token_hash, user_id, expires_at, user_agent) VALUES (?,?,?,?)",
           _h(token), user["id"], now + config.SESSION_DAYS * 86400, (user_agent or "")[:200])
    db.run("DELETE FROM sessions WHERE expires_at < ?", now)
    return public_user(user), token


def set_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(COOKIE, token, max_age=config.SESSION_DAYS * 86400, httponly=True,
                    secure=config.is_production(), samesite="lax", path="/")


def logout(request: Request, resp: Response) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        db.run("DELETE FROM sessions WHERE token_hash = ?", _h(token))
    resp.delete_cookie(COOKIE, path="/")


def public_user(user: dict) -> dict:
    return {"id": user["id"], "email": user["email"], "name": user.get("name"),
            "is_admin": user["email"].lower() in config.admin_emails()}


# ---------------------------------------------------------------- dependencies
def optional_user(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    row = db.one("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
                 _h(token), int(time.time()))
    return row


def current_user(user: dict | None = Depends(optional_user)) -> dict:
    if not user:
        raise HTTPException(401, "Pehle login kijiye")
    return user


def site_owner(slug: str) -> int | None:
    row = db.one("SELECT owner_id FROM sites WHERE slug = ?", slug)
    return row["owner_id"] if row else None


def require_owner(slug: str, user: dict) -> None:
    owner = site_owner(slug)
    if owner is None or owner != user["id"]:
        # same message whether the site doesn't exist or belongs to someone else (no information leak)
        raise HTTPException(404, "Website nahi mili")


class SiteTaken(Exception):
    pass


def assign_site(slug: str, user_id: int) -> None:
    """Record ownership. Never transfers a website that already belongs to someone else."""
    db.run("INSERT INTO sites(slug, owner_id) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING", slug, user_id)
    if site_owner(slug) != user_id:
        raise SiteTaken(slug)


def release_site(slug: str, user_id: int) -> None:
    """Undo a reservation after a failed build (only her own, and only if nothing was published)."""
    from . import sitestore  # local import: sitestore is a storage module, auth must not depend on it at import
    if not sitestore.exists(slug):
        db.run("DELETE FROM sites WHERE slug = ? AND owner_id = ?", slug, user_id)


def user_sites(user_id: int) -> list[str]:
    return [r["slug"] for r in db.all_("SELECT slug FROM sites WHERE owner_id = ? ORDER BY created_at DESC", user_id)]


def get_or_create_user(email: str) -> dict:
    email = normalise_email(email)
    user = db.one("SELECT * FROM users WHERE email = ?", email)
    if not user:
        uid = db.run("INSERT INTO users(email) VALUES (?)", email)
        user = db.one("SELECT * FROM users WHERE id = ?", uid)
    return user
