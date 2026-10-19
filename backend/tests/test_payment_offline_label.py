# Iteration 3: payment methods, offline idempotent sales, by_payment reports, barcode generation, settings qris/bank
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def ean_ok(bc):
    d = [int(c) for c in bc]
    s = sum(x * (3 if i % 2 else 1) for i, x in enumerate(d[:12]))
    return (10 - s % 10) % 10 == d[12]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def cat(s):
    cats = s.get(f"{API}/categories").json()
    return cats[0]["id"] if cats else None


@pytest.fixture(scope="module")
def product(s, cat):
    r = s.post(f"{API}/products", json={"name": f"TEST_Pay {uuid.uuid4().hex[:5]}", "category_id": cat,
                                         "unit": "Pcs", "cost_price": 1000, "sale_price": 2000, "stock": 5, "min_stock": 1})
    assert r.status_code in (200, 201), r.text
    p = r.json()
    yield p
    s.delete(f"{API}/products/{p['id']}")


def item(p, qty=1, price=None):
    return {"product_id": p["id"], "name": p["name"], "unit": "Pcs", "qty": qty,
            "price": price if price is not None else p["sale_price"], "cost_price": p["cost_price"], "discount": 0}


def getp(s, pid):
    return next(x for x in s.get(f"{API}/products").json() if x["id"] == pid)


def stock(s, pid):
    return getp(s, pid)["stock"]


# Payment methods
class TestPayment:
    def test_invalid_method(self, s, product):
        r = s.post(f"{API}/sales", json={"items": [item(product)], "cash_received": 5000, "payment_method": "kartu"})
        assert r.status_code == 400

    def test_qris(self, s, product):
        r = s.post(f"{API}/sales", json={"items": [item(product)], "cash_received": 0, "payment_method": "qris", "payment_ref": "TEST_REF1"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["payment_method"] == "qris" and d["cash_received"] == d["total"] == 2000 and d["change"] == 0
        assert d["payment_ref"] == "TEST_REF1"
        g = s.get(f"{API}/sales/{d['id']}").json()
        assert g["payment_method"] == "qris" and g["payment_ref"] == "TEST_REF1"

    def test_transfer_overpay_forced(self, s, product):
        r = s.post(f"{API}/sales", json={"items": [item(product)], "cash_received": 99999, "payment_method": "transfer"})
        assert r.status_code == 200
        d = r.json()
        assert d["cash_received"] == 2000 and d["change"] == 0

    def test_tunai_insufficient(self, s, product):
        r = s.post(f"{API}/sales", json={"items": [item(product)], "cash_received": 100, "payment_method": "tunai"})
        assert r.status_code == 400


# Idempotency & offline
class TestOffline:
    def test_idempotent(self, s, product):
        before = stock(s, product["id"])
        cid = str(uuid.uuid4())
        body = {"items": [item(product)], "cash_received": 2000, "client_id": cid}
        a = s.post(f"{API}/sales", json=body).json()
        b = s.post(f"{API}/sales", json=body).json()
        assert a["sale_no"] == b["sale_no"] and a["id"] == b["id"]
        assert len(b["items"]) == 1
        assert stock(s, product["id"]) == before - 1

    def test_offline_skips_stock_check(self, s, product):
        cur = stock(s, product["id"])
        cid = str(uuid.uuid4())
        r = s.post(f"{API}/sales", json={"items": [item(product, qty=cur + 3)], "cash_received": 10**7,
                                          "client_id": cid, "client_created_at": "2026-01-02T03:04:05.000Z", "offline": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["offline"] is True and d["created_at"].startswith("2026-01-02T03:04:05")
        assert d["sale_no"].startswith("TRX-")
        assert stock(s, product["id"]) == -3
        # restore stock
        s.post(f"{API}/stock/adjust", json={"product_id": product["id"], "qty_delta": 13, "reason": "penyesuaian"})

    def test_online_stock_check(self, s, product):
        cur = stock(s, product["id"])
        r = s.post(f"{API}/sales", json={"items": [item(product, qty=cur + 1)], "cash_received": 10**7})
        assert r.status_code == 400

    def test_offline_skips_below_cost(self, s, product):
        st = s.get(f"{API}/settings").json()
        s.put(f"{API}/settings", json={**st, "allow_sell_below_cost": False})
        try:
            r1 = s.post(f"{API}/sales", json={"items": [item(product, price=500)], "cash_received": 500})
            assert r1.status_code == 400
            r2 = s.post(f"{API}/sales", json={"items": [item(product, price=500)], "cash_received": 500,
                                               "offline": True, "client_id": str(uuid.uuid4())})
            assert r2.status_code == 200
        finally:
            s.put(f"{API}/settings", json=st)


# Reports by_payment
class TestReports:
    def test_report_by_payment(self, s):
        r = s.get(f"{API}/reports/sales")
        assert r.status_code == 200
        bp = {m["method"]: m for m in r.json()["by_payment"]}
        assert set(bp) == {"tunai", "qris", "transfer"}
        assert bp["qris"]["label"] == "QRIS" and bp["qris"]["count"] >= 1 and bp["qris"]["total"] >= 2000
        assert bp["transfer"]["count"] >= 1

    def test_dashboard_by_payment(self, s):
        r = s.get(f"{API}/dashboard")
        assert r.status_code == 200
        bp = r.json()["by_payment"]
        assert {m["method"] for m in bp} == {"tunai", "qris", "transfer"}
        assert all({"label", "count", "total"} <= set(m) for m in bp)


# Barcode generation
class TestBarcode:
    def test_generate(self, s, cat):
        ids, codes = [], []
        try:
            for _ in range(2):
                p = s.post(f"{API}/products", json={"name": f"TEST_BC {uuid.uuid4().hex[:5]}", "category_id": cat, "unit": "Pcs",
                                                     "cost_price": 100, "sale_price": 200, "stock": 1, "min_stock": 0}).json()
                ids.append(p["id"])
                r = s.post(f"{API}/products/{p['id']}/generate-barcode")
                assert r.status_code == 200, r.text
                bc = r.json()["barcode"]
                assert len(bc) == 13 and bc.isdigit() and bc.startswith("20") and ean_ok(bc)
                assert getp(s, p["id"])["barcode"] == bc
                codes.append(bc)
            assert codes[0] != codes[1]
            r = s.post(f"{API}/products/{ids[0]}/generate-barcode")
            assert r.status_code == 400 and "sudah memiliki barcode" in r.json()["detail"]
            assert s.post(f"{API}/products/nonexistent/generate-barcode").status_code == 404
        finally:
            for i in ids:
                s.delete(f"{API}/products/{i}")


# Settings qris/bank
class TestSettings:
    def test_qris_bank_persist(self, s):
        st = s.get(f"{API}/settings").json()
        img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        try:
            r = s.put(f"{API}/settings", json={**st, "qris_image": img, "bank_info": "BCA 123\na.n. TEST"})
            assert r.status_code == 200
            g = s.get(f"{API}/settings").json()
            assert g["qris_image"] == img and g["bank_info"] == "BCA 123\na.n. TEST"
        finally:
            s.put(f"{API}/settings", json={**st, "qris_image": "", "bank_info": "", "store_name": "Toko Serba Ada"})
