"""GoDaddy wrapper: retries on 5xx/timeouts, clear errors, circuit breaker — and never raises into the agent."""
import httpx
import pytest

from app import godaddy, resilience


class FakeClient:
    """Replays a script of responses/exceptions for httpx.Client().get()."""
    script: list = []
    calls = 0

    def __init__(self, *a, **k): pass
    def __enter__(self): return self
    def __exit__(self, *a): return False

    def get(self, url, params=None, headers=None, **k):
        FakeClient.calls += 1
        step = FakeClient.script.pop(0) if FakeClient.script else FakeClient.last
        FakeClient.last = step
        if isinstance(step, Exception):
            raise step
        code, body = step
        return Resp(code, body)


class Resp:
    def __init__(self, code, body): self.status_code, self._b = code, body; self.text = str(body)
    def json(self): return self._b


@pytest.fixture(autouse=True)
def fake_http(monkeypatch):
    FakeClient.script, FakeClient.calls, FakeClient.last = [], 0, (200, {})
    monkeypatch.setattr(godaddy.httpx, "Client", FakeClient)
    monkeypatch.setattr(resilience.time, "sleep", lambda s: None)
    resilience.BREAKERS["godaddy"] = resilience.CircuitBreaker("godaddy", fail_max=4, reset_after=30)
    yield


def test_success_after_a_5xx_is_retried():
    FakeClient.script = [(503, {}), (200, {"domain": "sonaliachaar.com", "available": True, "prices": [{"price": {"value": 1299, "currencyCode": "USD"}}]})]
    out = godaddy.check_availability("sonaliachaar.com")
    assert out["available"] is True and out["price"]["amount"] == 12.99 and FakeClient.calls == 2


def test_timeouts_become_a_clear_retryable_error_not_an_exception():
    FakeClient.script = [httpx.ReadTimeout("slow")] * 3
    out = godaddy.suggest_domains("sonali achaar")
    assert out["code"] == "godaddy_timeout" and out["retryable"] is True and "error" in out
    assert FakeClient.calls == 3  # bounded retries


def test_client_errors_are_not_retried():
    FakeClient.script = [(422, {"message": "invalid domain"})]
    out = godaddy.check_availability("bad domain")
    assert out["code"] == "godaddy_error" and out["retryable"] is False and FakeClient.calls == 1


def test_persistent_outage_opens_the_circuit_and_fails_fast():
    FakeClient.script = [httpx.ConnectError("down")] * 30
    for _ in range(4):
        godaddy.check_availability("a.com")
    before = FakeClient.calls
    out = godaddy.check_availability("a.com")
    assert out["code"] == "circuit_open" and FakeClient.calls == before  # GoDaddy not called while open


def test_failure_drill_simulates_an_outage():
    token = resilience.set_faults({"godaddy"})
    try:
        out = godaddy.suggest_domains("anything")
    finally:
        resilience.reset_faults(token)
    assert out["code"] == "godaddy_unavailable" and FakeClient.calls == 0
