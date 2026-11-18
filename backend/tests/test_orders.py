"""Orders: prices come from the server, tampered/stale carts are rejected, payment is only ever owner-confirmed."""
import json

import pytest

from app import config, orders

SITE = {"content": {"business_name": "Sonali's Achaar", "products": [
    {"name": "Raw mango pickle", "price_inr": 250, "unit": "500 g"}, {"name": "Lemon pickle", "price_inr": 220}, {"name": "Gift box", "price_inr": None}]},
        "profile": {"whatsapp": "9829012345", "upi_id": "sonali@okaxis"}}
CUSTOMER = {"name": "Priya", "phone": "9876543210", "address": "Jaipur", "pincode": "302021"}


@pytest.fixture(autouse=True)
def site():
    d = config.SITES_DIR / "sonali"
    d.mkdir(parents=True, exist_ok=True)
    (d / "site.json").write_text(json.dumps(SITE))
    yield


def test_total_is_computed_on_the_server():
    o = orders.create("sonali", [{"index": 0, "qty": 2, "price": 1}, {"index": 1, "qty": 1}], CUSTOMER, "upi")
    assert o["total"] == 720 and o["code"].startswith("#") and "am=720.00" in o["upi_link"] and "pa=sonali@okaxis" in o["upi_link"]


@pytest.mark.parametrize("items,why", [
    ([{"index": 9, "qty": 1}], "unknown product"), ([{"index": 0, "qty": 0}], "zero qty"), ([{"index": 0, "qty": 500}], "absurd qty"),
    ([{"index": 0, "qty": 1, "name": "Something else"}], "menu changed"), ([{"index": 2, "qty": 1}], "unpriced item"), ([], "empty cart")])
def test_bad_carts_are_rejected(items, why):
    with pytest.raises(orders.OrderError):
        orders.create("sonali", items, CUSTOMER, "upi")


def test_payment_is_pending_until_the_owner_confirms_and_can_be_undone():
    o = orders.create("sonali", [{"index": 0, "qty": 1}], CUSTOMER, "upi")
    row = orders.get("sonali", o["id"])
    assert row["payment_status"] == "pending" and row["paid_confirmed_by"] is None
    paid = orders.update("sonali", o["id"], payment_status="paid")
    assert paid["paid_confirmed_by"] == "owner" and paid["paid_confirmed_at"]
    undone = orders.update("sonali", o["id"], payment_status="pending")
    assert undone["paid_confirmed_by"] is None and undone["paid_confirmed_at"] is None
