"""One shared Claude client, configured for production:
   * explicit timeout (CLAUDE_TIMEOUT s) — a hung request can't hang a user forever
   * SDK retries (max 2) with backoff on 429 / 5xx / 529-overloaded / connection errors
   * failure drills hook (resilience.inject) so the fallback paths can be demonstrated live
Callers use client().messages.create(...) exactly like the SDK; exceptions are classified by resilience.classify."""
import os

import anthropic

from . import config, resilience

# a plain number: anthropic>=2 ships its own HTTP library (httpx2) and rejects httpx.Timeout objects
TIMEOUT = float(os.getenv("CLAUDE_TIMEOUT", "90"))
_sdk: anthropic.Anthropic | None = None


class _Messages:
    def __init__(self, sdk: anthropic.Anthropic):
        self._sdk = sdk

    def create(self, **kwargs):
        resilience.inject("claude")
        return self._sdk.messages.create(**kwargs)


class _Client:
    def __init__(self, sdk: anthropic.Anthropic):
        self.messages = _Messages(sdk)


def client() -> _Client:
    global _sdk
    if _sdk is None:  # one connection pool for the whole process
        _sdk = anthropic.Anthropic(
            api_key=config.ANTHROPIC_API_KEY,
            base_url="https://api.anthropic.com",  # ignore any machine-wide ANTHROPIC_BASE_URL
            timeout=TIMEOUT,
            max_retries=2,
        )
    return _Client(_sdk)
