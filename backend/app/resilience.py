"""Failure handling shared by every external call (Claude, GoDaddy, photo providers).

Design:
  * ServiceError  — one error type the API layer understands: stable `code`, HTTP status, a friendly Hinglish
                    message for the entrepreneur, `retryable`, and the upstream service name. Internal details are
                    logged, never sent to the browser.
  * classify()    — maps SDK/network exceptions (anthropic, httpx) to ServiceError.
  * retry()       — bounded retries with exponential backoff + jitter, only for retryable failures.
  * CircuitBreaker— after repeated failures a dependency is skipped for a cool-down, so one slow provider can't
                    make every request hang (fail fast, recover automatically).
  * faults        — opt-in failure drills (admin only) to demonstrate the behaviour live: "claude", "godaddy",
                    "timeout". Never active unless an admin sends the X-Saheli-Fault header.
"""
from __future__ import annotations

import contextvars
import logging
import random
import threading
import time
from dataclasses import dataclass
from typing import Callable, TypeVar

import httpx

log = logging.getLogger("saheli")
T = TypeVar("T")


@dataclass
class ServiceError(Exception):
    code: str                 # stable machine-readable code, e.g. "claude_busy"
    status: int               # HTTP status for the API response
    message: str              # friendly, shown to the user (Hinglish)
    retryable: bool = True
    service: str = "saheli"   # "claude" | "godaddy" | "photos" | "saheli"

    def __str__(self) -> str:  # pragma: no cover - logging convenience
        return f"{self.service}:{self.code}"

    def public(self, request_id: str | None = None) -> dict:
        return {"detail": self.message, "code": self.code, "retryable": self.retryable,
                "service": self.service, "request_id": request_id}


# ---------------------------------------------------------------- classification
MSG = {
    "claude_timeout": "Saheli ko jawab dene mein zyada time lag gaya. Ek baar phir bhejiye — aapki baatein save hain.",
    "claude_busy": "Saheli abhi bahut saari baatein sun rahi hai. 10–20 second mein dobara koshish kijiye.",
    "claude_unreachable": "Saheli tak pahunch nahi paaye (network). Thodi der mein dobara koshish kijiye.",
    "claude_config": "Saheli abhi set up ho rahi hai. Kripya thodi der baad aaiye.",
    "claude_error": "Saheli se jawab nahi aa paaya. Ek baar phir bhejiye.",
    "godaddy_timeout": "GoDaddy se jawab aane mein der ho gayi.",
    "godaddy_unavailable": "GoDaddy abhi jawab nahi de raha.",
    "godaddy_error": "GoDaddy ne is request ko mana kar diya.",
    "circuit_open": "Ye service abhi thodi der ke liye band hai — kuch der mein apne aap theek ho jaayegi.",
    "internal": "Kuch gadbad ho gayi. Hum dekh rahe hain — ek baar phir koshish kijiye.",
}


def classify(exc: BaseException, service: str = "claude") -> ServiceError:
    """Turn any exception from an external call into a ServiceError."""
    if isinstance(exc, ServiceError):
        return exc
    try:  # anthropic may be absent (tests) or a different version: never let classification itself fail
        import anthropic
    except ImportError:  # pragma: no cover
        anthropic = None
    A = lambda name: getattr(anthropic, name, None) if anthropic else None  # noqa: E731
    is_a = lambda name: (cls := A(name)) is not None and isinstance(exc, cls)  # noqa: E731
    if is_a("APITimeoutError"):
        return ServiceError("claude_timeout", 504, MSG["claude_timeout"], True, "claude")
    if is_a("APIConnectionError"):
        return ServiceError("claude_unreachable", 503, MSG["claude_unreachable"], True, "claude")
    if is_a("RateLimitError"):
        return ServiceError("claude_busy", 429, MSG["claude_busy"], True, "claude")
    if is_a("AuthenticationError") or is_a("PermissionDeniedError"):
        return ServiceError("claude_config", 503, MSG["claude_config"], False, "claude")
    if is_a("APIStatusError"):
        if getattr(exc, "status_code", None) in (500, 502, 503, 529):
            return ServiceError("claude_busy", 503, MSG["claude_busy"], True, "claude")
        return ServiceError("claude_error", 502, MSG["claude_error"], False, "claude")
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)):
        code = f"{service}_timeout" if f"{service}_timeout" in MSG else "claude_timeout"
        return ServiceError(code, 504, MSG[code], True, service)
    if isinstance(exc, httpx.TransportError):
        code = f"{service}_unavailable" if f"{service}_unavailable" in MSG else "claude_unreachable"
        return ServiceError(code, 503, MSG[code], True, service)
    return ServiceError("internal", 500, MSG["internal"], True, service)


# ---------------------------------------------------------------- retry with backoff
def retry(fn: Callable[[], T], *, attempts: int = 3, base: float = 0.4, cap: float = 4.0,
          service: str = "saheli", sleep: Callable[[float], None] | None = None) -> T:
    """Call fn(); on a retryable failure wait base*2^n (+jitter, capped) and try again. Re-raises ServiceError."""
    last: ServiceError | None = None
    for n in range(attempts):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - classified below
            last = classify(exc, service)
            log.warning("retry %s attempt=%d code=%s", service, n + 1, last.code)
            if not last.retryable or n == attempts - 1:
                break
            (sleep or time.sleep)(min(cap, base * 2 ** n) * (0.75 + random.random() / 2))
    assert last is not None
    raise last


# ---------------------------------------------------------------- circuit breaker
class CircuitBreaker:
    """closed -> (fail_max consecutive failures) -> open (fail fast for reset_after s) -> half-open (1 trial)."""

    def __init__(self, name: str, fail_max: int = 4, reset_after: float = 30.0, clock: Callable[[], float] = time.monotonic):
        self.name, self.fail_max, self.reset_after, self.clock = name, fail_max, reset_after, clock
        self.failures, self.opened_at = 0, None
        self._lock = threading.Lock()

    @property
    def state(self) -> str:
        if self.opened_at is None:
            return "closed"
        return "half-open" if self.clock() - self.opened_at >= self.reset_after else "open"

    def call(self, fn: Callable[[], T]) -> T:
        with self._lock:
            if self.state == "open":
                raise ServiceError("circuit_open", 503, MSG["circuit_open"], True, self.name)
        try:
            out = fn()
        except Exception:
            with self._lock:
                self.failures += 1
                if self.failures >= self.fail_max or self.opened_at is not None:
                    self.opened_at = self.clock()  # (re)open; a failed half-open trial re-opens
                    log.error("circuit %s OPEN after %d failures", self.name, self.failures)
            raise
        with self._lock:
            if self.opened_at is not None:
                log.info("circuit %s closed again", self.name)
            self.failures, self.opened_at = 0, None
        return out

    def snapshot(self) -> dict:
        return {"state": self.state, "failures": self.failures}


BREAKERS = {"godaddy": CircuitBreaker("godaddy"), "photos": CircuitBreaker("photos", fail_max=6, reset_after=60)}


# ---------------------------------------------------------------- failure drills (admin-only, per request)
_faults: contextvars.ContextVar[frozenset] = contextvars.ContextVar("saheli_faults", default=frozenset())
FAULTS = {"claude", "godaddy", "timeout"}


def set_faults(names: set[str]):
    return _faults.set(frozenset(n for n in names if n in FAULTS))


def reset_faults(token) -> None:
    _faults.reset(token)


def inject(service: str) -> None:
    """Raise the drill failure for `service` if one is active for this request."""
    active = _faults.get()
    if not active:
        return
    if "timeout" in active:
        raise httpx.ReadTimeout(f"drill: {service} timed out")
    if service in active:
        if service == "claude":
            raise ServiceError("claude_busy", 503, MSG["claude_busy"], True, "claude")
        raise httpx.ConnectError(f"drill: {service} unavailable")
