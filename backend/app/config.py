"""Reads settings from environment variables (.env file in local dev).

ENV=production switches on every production safeguard (Secure cookies, no dev login codes, required
settings checked at startup). It is explicit on purpose: production must never be guessed from other values.
"""
import os
import re
from pathlib import Path

from dotenv import load_dotenv

# Load ../.env (project root) when running locally; in Docker, env vars come from env_file.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

def _clean(value: str) -> str:
    """Remove stray spaces/quotes that sneak in when pasting keys into .env."""
    return value.strip().strip('"').strip("'")


ENV = _clean(os.getenv("ENV", "development")).lower()
ANTHROPIC_API_KEY = _clean(os.getenv("ANTHROPIC_API_KEY", ""))
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
GODADDY_PAT = _clean(os.getenv("GODADDY_PAT", ""))
GODADDY_BASE_URL = os.getenv("GODADDY_BASE_URL", "https://api.godaddy.com").rstrip("/")

# The platform's own domain, e.g. saheliai.com. Generated sites live at https://<slug>.<DOMAIN>
DOMAIN = _clean(os.getenv("DOMAIN", "")).lower()

# Where generated websites are saved, and how their public URL looks.
SITES_DIR = Path(os.getenv("SITES_DIR", Path(__file__).resolve().parents[2] / "sites"))
# Local: served by FastAPI. Production: derived from DOMAIN -> "https://{slug}.<DOMAIN>/"
SITE_URL_TEMPLATE = os.getenv("SITE_URL_TEMPLATE") or (
    f"https://{{slug}}.{DOMAIN}/" if DOMAIN and ENV == "production" else "http://localhost:8000/sites/{slug}/")


# Owner-uploaded product photos (before they are copied into a site)
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", SITES_DIR.parent / "uploads"))
# Cheaper/faster model for small tasks (summaries); falls back to the main model
CLAUDE_FAST_MODEL = os.getenv("CLAUDE_FAST_MODEL", "claude-haiku-5-5")


# App data (users, sessions, site ownership) lives next to the sites folder
DATA_DIR = Path(os.getenv("DATA_DIR", SITES_DIR.parent))
DB_PATH = Path(os.getenv("DB_PATH", DATA_DIR / "saheli.db"))
# Per-site private data (customer enquiries): never inside SITES_DIR, which the web server publishes
PRIVATE_DIR = Path(os.getenv("PRIVATE_DIR", DATA_DIR / "private"))
# Random secret used to hash login codes and session tokens. MUST be set (long random string) in production.
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))


def site_url(slug: str) -> str:
    return SITE_URL_TEMPLATE.format(slug=slug)


# Optional integrations (features clearly report when these are missing)
PEXELS_API_KEY = _clean(os.getenv("PEXELS_API_KEY", ""))
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = _clean(os.getenv("SMTP_USER", ""))
SMTP_PASS = _clean(os.getenv("SMTP_PASS", ""))
# where the saheliai.com contact form is delivered; defaults to the platform mailbox itself
CONTACT_EMAIL = _clean(os.getenv("CONTACT_EMAIL", "")) or SMTP_USER
MAIL_FROM = _clean(os.getenv("MAIL_FROM", ""))
MAIL_TO = _clean(os.getenv("MAIL_TO", ""))  # fallback inbox when the owner has no email
# Public base URL of this API, used by generated sites for their enquiry forms.
# Local: "" (same origin, sites are served by FastAPI). Production: https://<DOMAIN>
PUBLIC_API_URL = (os.getenv("PUBLIC_API_URL") or (f"https://{DOMAIN}" if DOMAIN and ENV == "production" else "")).rstrip("/")


def mcp_url(slug: str) -> str:
    base = PUBLIC_API_URL or "http://localhost:8000"
    return f"{base}/mcp/{slug}"


def is_production() -> bool:
    return ENV == "production"


def dev_login_codes() -> bool:
    """Show login codes in the terminal/UI when email isn't set up. Never in production."""
    if is_production():
        return False
    return os.getenv("DEV_LOGIN_CODES", "").lower() != "false"


def cors_origin_regex() -> str:
    """Generated websites (and the app itself) may call the public API from the browser."""
    local = r"localhost(:\d+)?|127\.0\.0\.1(:\d+)?"
    if DOMAIN:
        return rf"https?://({local}|([a-z0-9-]+\.)*{re.escape(DOMAIN)})"
    return rf"https?://({local})"


def integrations() -> dict:
    """What is CONFIGURED on this server (a key is present) — not a guarantee the remote service is up."""
    return {
        "photos": bool(PEXELS_API_KEY),            # Pexels key; Openverse (keyless) is always tried as well
        "email": bool(SMTP_HOST and SMTP_USER and SMTP_PASS),
        "claude": bool(ANTHROPIC_API_KEY and "REPLACE_ME" not in ANTHROPIC_API_KEY),
        "godaddy_domains": bool(GODADDY_PAT and "REPLACE_ME" not in GODADDY_PAT),
        "https": PUBLIC_API_URL.startswith("https://"),
        # not built — always reported honestly as false
        "payment_gateway": False,
        "domain_purchase": False,
        "custom_domain_connect": False,
    }


def admin_emails() -> set[str]:
    """Comma-separated ADMIN_EMAILS may run failure drills (X-Saheli-Fault header)."""
    return {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}


def missing_settings() -> list[str]:
    """Names of required settings that are still empty or placeholders."""
    missing = []
    if not ANTHROPIC_API_KEY or "REPLACE_ME" in ANTHROPIC_API_KEY:
        missing.append("ANTHROPIC_API_KEY")
    if not GODADDY_PAT or "REPLACE_ME" in GODADDY_PAT:
        missing.append("GODADDY_PAT")
    return missing


def production_problems() -> list[str]:
    """Settings that make a production deployment unsafe. The API refuses to start if any are present."""
    if not is_production():
        return []
    problems = []
    if SECRET_KEY == "dev-only-change-me" or len(SECRET_KEY) < 32:
        problems.append("SECRET_KEY must be a long random string (python -c 'import secrets;print(secrets.token_urlsafe(48))')")
    if not DOMAIN:
        problems.append("DOMAIN must be set (e.g. saheliai.com)")
    if not PUBLIC_API_URL.startswith("https://"):
        problems.append("PUBLIC_API_URL must be https:// (defaults to https://<DOMAIN>)")
    if not SITE_URL_TEMPLATE.startswith("https://") or "{slug}" not in SITE_URL_TEMPLATE:
        problems.append("SITE_URL_TEMPLATE must look like https://{slug}.<DOMAIN>/")
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS):
        problems.append("SMTP_HOST, SMTP_USER and SMTP_PASS are required: login codes are sent by email")
    return problems
