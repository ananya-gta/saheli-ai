"""Test setup: isolated data folders, and (only when the real SDKs aren't installed, e.g. offline) minimal stubs."""
import os
import sys
import tempfile
import types
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="saheli-tests-"))
os.environ.update(DATA_DIR=str(_tmp / "data"), SITES_DIR=str(_tmp / "sites"), SECRET_KEY="t" * 40,
                  ANTHROPIC_API_KEY="test-key", GODADDY_PAT="test-pat", AUTO_WARMUP="0", ADMIN_EMAILS="admin@example.com",
                  # explicit values win over the developer's real .env (load_dotenv never overrides)
                  ENV="development", DOMAIN="", PUBLIC_API_URL="", SITE_URL_TEMPLATE="http://localhost:8000/sites/{slug}/",
                  SMTP_HOST="", SMTP_USER="", SMTP_PASS="", MAIL_TO="", DEV_LOGIN_CODES="true",
                  PRIVATE_DIR=str(_tmp / "private"), UPLOADS_DIR=str(_tmp / "uploads"), DB_PATH=str(_tmp / "data" / "saheli.db"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:  # pragma: no cover - environment dependent
    import anthropic  # noqa: F401
except ImportError:  # offline sandbox: a stub good enough for import; anthropic-specific tests are skipped
    stub = types.ModuleType("anthropic")
    stub.Anthropic = object
    stub.STUB = True
    sys.modules["anthropic"] = stub
try:  # pragma: no cover
    import dotenv  # noqa: F401
except ImportError:
    d = types.ModuleType("dotenv"); d.load_dotenv = lambda *a, **k: None; sys.modules["dotenv"] = d
