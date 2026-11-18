"""Retry, circuit breaker, error classification and failure drills."""
import httpx
import pytest

from app import resilience as r


def test_retry_recovers_from_transient_failures():
    calls, slept = [], []
    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise httpx.ReadTimeout("slow")
        return "ok"
    assert r.retry(flaky, attempts=3, service="godaddy", sleep=slept.append) == "ok"
    assert len(calls) == 3 and len(slept) == 2 and slept[1] > slept[0] * 1.2  # exponential backoff


def test_retry_does_not_repeat_non_retryable_errors():
    calls = []
    def bad():
        calls.append(1)
        raise r.ServiceError("claude_config", 503, "x", retryable=False, service="claude")
    with pytest.raises(r.ServiceError) as e:
        r.retry(bad, attempts=5, sleep=lambda s: None)
    assert e.value.code == "claude_config" and len(calls) == 1


def test_classify_network_failures_per_service():
    assert r.classify(httpx.ReadTimeout("t"), "godaddy").code == "godaddy_timeout"
    assert r.classify(httpx.ConnectError("c"), "godaddy").code == "godaddy_unavailable"
    e = r.classify(ValueError("boom"))
    assert e.code == "internal" and "boom" not in e.message  # internals never reach the user


def test_classify_anthropic_errors():
    anthropic = pytest.importorskip("anthropic")
    if getattr(anthropic, "STUB", False):
        pytest.skip("real anthropic SDK not installed")
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    assert r.classify(anthropic.APITimeoutError(request=req)).code == "claude_timeout"
    assert r.classify(anthropic.APIConnectionError(request=req)).code == "claude_unreachable"
    overloaded = anthropic.APIStatusError("overloaded", response=httpx.Response(529, request=req), body=None)
    assert r.classify(overloaded).code == "claude_busy"


def test_circuit_breaker_opens_fails_fast_and_recovers():
    now = [0.0]
    cb = r.CircuitBreaker("godaddy", fail_max=2, reset_after=30, clock=lambda: now[0])
    def boom(): raise httpx.ConnectError("down")
    for _ in range(2):
        with pytest.raises(httpx.ConnectError):
            cb.call(boom)
    assert cb.state == "open"
    called = []
    with pytest.raises(r.ServiceError) as e:            # fail fast: the dependency is not even called
        cb.call(lambda: called.append(1))
    assert e.value.code == "circuit_open" and not called
    now[0] = 31                                          # cool-down over -> one trial call allowed
    assert cb.state == "half-open"
    assert cb.call(lambda: "back") == "back"
    assert cb.state == "closed" and cb.failures == 0


def test_failed_half_open_trial_reopens():
    now = [0.0]
    cb = r.CircuitBreaker("x", fail_max=1, reset_after=10, clock=lambda: now[0])
    with pytest.raises(httpx.ConnectError):
        cb.call(lambda: (_ for _ in ()).throw(httpx.ConnectError("x")))
    now[0] = 11
    with pytest.raises(httpx.ConnectError):
        cb.call(lambda: (_ for _ in ()).throw(httpx.ConnectError("x")))
    assert cb.state == "open"


def test_failure_drills_are_scoped_to_the_request():
    r.inject("claude")                                   # nothing active -> no-op
    token = r.set_faults({"godaddy", "not-a-fault"})
    try:
        with pytest.raises(httpx.ConnectError):
            r.inject("godaddy")
        r.inject("claude")                               # only the requested service fails
    finally:
        r.reset_faults(token)
    r.inject("godaddy")                                  # cleared after the request
