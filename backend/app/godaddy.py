"""Thin wrapper around the GoDaddy Domains v3 discovery endpoints (read-only).

Docs: https://developer.godaddy.com/docs/api-users/domains/search
Prices in v3 responses are in cents -> divided by 100 here.
"""
import os

import httpx

from . import config, resilience

# Rough USD->INR rate for showing friendly prices. Update in .env (USD_INR=...) to today's rate.
USD_INR = float(os.getenv("USD_INR", "85"))

TIMEOUT = httpx.Timeout(8.0, connect=4.0)  # x3 attempts with backoff stays well under the agent turn budget


def _headers() -> dict:
    return {"Authorization": f"Bearer {config.GODADDY_PAT}", "Accept": "application/json"}


def _money(obj) -> dict | None:
    """Turn {'value': 919, 'currencyCode': 'USD'} into {'amount': 9.19, 'currency': 'USD'}."""
    if isinstance(obj, dict) and "value" in obj:
        amount = round(obj["value"] / 100, 2)
        currency = obj.get("currencyCode", "USD")
        out = {"amount": amount, "currency": currency}
        if currency == "USD":
            out["approx_inr"] = int(round(amount * USD_INR, -1))  # rounded to nearest 10
        return out
    return None


def _first_price(item: dict) -> dict | None:
    prices = item.get("prices") or []
    if prices and isinstance(prices[0], dict):
        return _money(prices[0].get("price")) or _money(prices[0])
    return _money(item.get("price"))


class _Retryable(Exception):
    """5xx / 429 from GoDaddy: worth one more try."""


def _get(path: str, params: dict) -> httpx.Response:
    """GET with failure drills, bounded retries (timeouts, network, 5xx, 429) and a circuit breaker."""
    def once() -> httpx.Response:
        resilience.inject("godaddy")
        with httpx.Client(timeout=TIMEOUT) as client:
            r = client.get(f"{config.GODADDY_BASE_URL}{path}", params=params, headers=_headers())
        if r.status_code == 429 or r.status_code >= 500:
            raise _Retryable(f"GoDaddy {r.status_code}")
        return r

    def with_retry() -> httpx.Response:
        try:
            return resilience.retry(once, attempts=3, base=0.5, service="godaddy")
        except resilience.ServiceError as err:
            if err.code == "internal":  # _Retryable exhausted -> upstream unavailable
                raise resilience.ServiceError("godaddy_unavailable", 503, resilience.MSG["godaddy_unavailable"], True, "godaddy") from err
            raise
    return resilience.BREAKERS["godaddy"].call(with_retry)


def _fail(key: str, value: str, exc: Exception) -> dict:
    err = resilience.classify(exc, "godaddy")
    return {key: value, "error": err.message, "code": err.code, "retryable": err.retryable}


def check_availability(domain: str) -> dict:
    """Is one exact domain free? Returns availability + indicative 1st-year price."""
    try:
        r = _get("/v3/domains/check-availability", {"domain": domain})
    except Exception as exc:  # noqa: BLE001
        return _fail("domain", domain, exc)
    if r.status_code >= 400:
        return {"domain": domain, "error": f"GoDaddy ne mana kiya ({r.status_code}): {r.text[:160]}", "code": "godaddy_error", "retryable": False}
    data = r.json()
    return {
        "domain": data.get("domain", domain),
        "available": bool(data.get("available")),
        "price": _first_price(data),
    }


def suggest_domains(query: str, tlds: str = "com,in,shop,store", limit: int = 6) -> dict:
    """Natural-language suggestions. GoDaddy only returns names that are actually available."""
    try:
        r = _get("/v3/domains/suggestions", {"query": query, "tlds": tlds, "pageSize": limit})
    except Exception as exc:  # noqa: BLE001
        return _fail("query", query, exc)
    if r.status_code >= 400:
        return {"query": query, "error": f"GoDaddy ne mana kiya ({r.status_code}): {r.text[:160]}", "code": "godaddy_error", "retryable": False}
    data = r.json()
    items = data if isinstance(data, list) else (
        data.get("suggestions") or data.get("items") or data.get("results") or []
    )
    suggestions = []
    for item in items[:limit]:
        if isinstance(item, str):
            suggestions.append({"domain": item, "price": None})
        elif isinstance(item, dict):
            suggestions.append({"domain": item.get("domain") or item.get("name"), "price": _first_price(item)})
    return {"query": query, "suggestions": suggestions}
