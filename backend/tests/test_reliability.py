"""Data integrity under retries and concurrency: idempotent orders, locked site updates, atomic builds, safe AI edits."""
import json
import threading

import pytest

from app import config, editor, orders, sitestore

SITE = {"content": {"business_name": "Sonali's Achaar", "archetype": "bakery",
                    "products": [{"name": "Raw mango pickle", "price_inr": 250, "photo_id": "a" * 16}]},
        "profile": {"whatsapp": "9829012345", "upi_id": "sonali@okaxis"}, "images": {}}
CUSTOMER = {"name": "Priya", "phone": "9876543210"}


@pytest.fixture
def slug():
    sitestore.save("rel-site", json.loads(json.dumps(SITE)))
    return "rel-site"


def test_retrying_an_order_with_the_same_key_does_not_duplicate_it(slug):
    first = orders.create(slug, [{"index": 0, "qty": 1}], CUSTOMER, "upi", idempotency_key="checkout-123456")
    again = orders.create(slug, [{"index": 0, "qty": 1}], CUSTOMER, "upi", idempotency_key="checkout-123456")
    assert again["id"] == first["id"] and again["replayed"] is True
    assert len(orders.list_(slug)) == 1


def test_concurrent_orders_get_unique_numbers(slug):
    results, errors = [], []

    def place(i):
        try:
            results.append(orders.create(slug, [{"index": 0, "qty": 1}], CUSTOMER, "cod", idempotency_key=f"key-{i:08d}"))
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
    threads = [threading.Thread(target=place, args=(i,)) for i in range(12)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert not errors and len({r["number"] for r in results}) == 12


def test_malformed_idempotency_key_is_rejected(slug):
    with pytest.raises(orders.OrderError):
        orders.create(slug, [{"index": 0, "qty": 1}], CUSTOMER, "upi", idempotency_key="bad key!")


def test_concurrent_updates_do_not_lose_writes(slug):
    def bump(i):
        sitestore.update(slug, lambda d: d.setdefault("marks", []).append(i))
    threads = [threading.Thread(target=bump, args=(i,)) for i in range(25)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(sitestore.load(slug)["marks"]) == list(range(25))


def test_failed_build_leaves_nothing_behind():
    with pytest.raises(RuntimeError):
        with sitestore.creating("broken-build") as draft:
            (draft.folder / "index.html").write_text("half")
            raise RuntimeError("photos failed")
    assert not sitestore.folder("broken-build").exists() and not sitestore.exists("broken-build")
    assert not [p for p in config.SITES_DIR.iterdir() if p.name.startswith(".build-broken-build")]


def test_build_cannot_overwrite_an_existing_site(slug):
    with pytest.raises(FileExistsError):
        with sitestore.creating(slug) as draft:
            draft.data = {"content": {}}
    assert sitestore.load(slug)["content"]["business_name"] == "Sonali's Achaar"


def test_ai_edit_output_is_validated_before_it_reaches_the_site(slug):
    content = sitestore.load(slug)["content"]
    upd = {"tagline_en": "  Fresh  ", "palette": "not-a-palette", "unknown": "x",
           "products": [{"name": "Raw mango pickle", "price_inr": -5, "photo_id": "a" * 16},
                        {"name": "Lemon", "price_inr": 180, "photo_id": "f" * 16}, {"price_inr": 9}]}
    out = editor._validated(upd, content)
    assert out["tagline_en"] == "Fresh" and "palette" not in out and "unknown" not in out
    pickle, lemon = out["products"]
    assert "price_inr" not in pickle and pickle["photo_id"] == "a" * 16   # negative price dropped, own photo kept
    assert lemon["price_inr"] == 180 and "photo_id" not in lemon         # AI can't attach a photo she never uploaded
