"""API contract under failure (runs where FastAPI is installed, e.g. CI): structured errors with a request id,
no internal details leaked, admin-only failure drills, health with circuit states."""
import pytest

pytest.importorskip("fastapi.testclient")
anthropic = pytest.importorskip("anthropic")
if getattr(anthropic, "STUB", False):
    pytest.skip("real anthropic SDK not installed", allow_module_level=True)

from fastapi.testclient import TestClient  # noqa: E402

from app import agent, main, resilience  # noqa: E402

client = TestClient(main.app)


def login(email):
    """Real login flow (dev codes are on outside production): request a code, verify it, keep the session cookie."""
    client.cookies.clear()
    code = client.post("/api/auth/request-code", json={"email": email}).json()["dev_code"]
    r = client.post("/api/auth/verify", json={"email": email, "code": code})
    assert r.status_code == 200, r.text


def test_health_reports_database_and_circuits():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["checks"]["database"] is True and "godaddy" in r.json()["circuits"]
    assert r.headers["X-Request-ID"]


def test_claude_outage_returns_a_friendly_structured_error(monkeypatch):
    login("outage@example.com")
    def down(*a, **k): raise RuntimeError("secret internal stack detail")
    monkeypatch.setattr(agent, "chat", down)
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers={"X-Request-ID": "abc123"})
    body = r.json()
    assert r.status_code == 500 and body["code"] == "internal" and body["request_id"] == "abc123"
    assert "secret" not in r.text  # internals stay in the server log


def test_failure_drill_is_admin_only(monkeypatch):
    seen = {}
    def spy(history, profile=None):
        try:
            resilience.inject("claude"); seen["fault"] = False
        except resilience.ServiceError:
            seen["fault"] = True
        return {"reply": "ok", "events": [], "profile": None, "approval": None, "growth_plan": None, "degraded": None}
    monkeypatch.setattr(agent, "chat", spy)
    login("drill-user@example.com")
    client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers={"X-Saheli-Fault": "claude"})
    assert seen["fault"] is False
    login("admin@example.com")
    client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers={"X-Saheli-Fault": "claude"})
    assert seen["fault"] is True
