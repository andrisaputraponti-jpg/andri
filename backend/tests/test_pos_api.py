# Kasir Toko Serba Ada - backend regression tests (iteration 2)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    ss.headers.update({"Content-Type": "application/json"})
    return ss


@pytest.fixture(scope="module")
def cat(s):
    r = s.post(f"{API}/categories", json={"name": "TEST_Kategori", "description": "x"})
    assert r.status_code == 200
    c = r.json()
    yield c
    s.delete(f"{API}/categories/{c['id']}")


# ---- Categories CRUD ----
class TestCategories:
    def test_create_update_delete(self, s):
        r = s.post(f"{API}/categories", json={"name": "TEST_Cat2"})
        assert r.status_code == 200
        cid = r.json()["id"]
        assert any(c["id"] == cid for c in s.get(f"{API}/categories").json())
        r = s.put(f"{API}/categories/{cid}", json={"name": "TEST_Cat2_upd", "description": "d"})
        assert r.status_code == 200
        c = [c for c in s.get(f"{API}/categories").json() if c["id"] == cid][0]
        assert c["name"] == "TEST_Cat2_upd" and c["description"] == "d"
        assert s.delete(f"{API}/categories/{cid}").status_code == 200
        assert not any(c["id"] == cid for c in s.get(f"{API}/categories").json())
        assert s.delete(f"{API}/categories/{cid}").status_code == 404

    def test_update_missing_404(self, s):
        assert s.put(f"{API}/categories/nope", json={"name": "x"}).status_code == 404

    def test_delete_used_category_400(self, s, cat):
        p = s.post(f"{API}/products", json={"name": "TEST_ProdCat", "category_id": cat["id"],
                                            "sale_price": 1000, "cost_price": 500}).json()
        r = s.delete(f"{API}/categories/{cat['id']}")
        assert r.status_code == 400
        assert "digunakan" in r.json()["detail"]
        # rename syncs product category_name
        s.put(f"{API}/categories/{cat['id']}", json={"name": "TEST_Kategori_R"})
        prods = s.get(f"{API}/products", params={"q": "TEST_ProdCat"}).json()
        assert prods[0]["category_name"] == "TEST_Kategori_R"
        assert s.delete(f"{API}/products/{p['id']}").status_code == 200


# ---- Products CRUD ----
class TestProducts:
    def test_create_auto_code_and_movement(self, s, cat):
        r = s.post(f"{API}/products", json={"name": "TEST_Prod1", "barcode": "TEST999001",
                                            "category_id": cat["id"], "cost_price": 1000,
                                            "sale_price": 1500, "stock": 10, "min_stock": 2})
        assert r.status_code == 200
        p = r.json()
        assert p["code"].startswith("P") and len(p["code"]) > 1
        assert p["category_name"] in ("TEST_Kategori", "TEST_Kategori_R")
        assert "_id" not in p
        mv = s.get(f"{API}/stock/movements", params={"product_id": p["id"]}).json()
        assert len(mv) == 1 and mv[0]["qty_delta"] == 10 and mv[0]["reason"] == "stok_awal"
        bc = s.get(f"{API}/products/by-barcode/TEST999001")
        assert bc.status_code == 200 and bc.json()["id"] == p["id"]
        # update stock -> movement
        upd = dict(name="TEST_Prod1_upd", barcode="TEST999001", category_id=cat["id"],
                   cost_price=1000, sale_price=1600, stock=15, min_stock=2)
        assert s.put(f"{API}/products/{p['id']}", json=upd).status_code == 200
        got = [x for x in s.get(f"{API}/products", params={"q": "TEST_Prod1_upd"}).json()][0]
        assert got["sale_price"] == 1600 and got["stock"] == 15
        mv = s.get(f"{API}/stock/movements", params={"product_id": p["id"]}).json()
        assert any(m["qty_delta"] == 5 and m["reason"] == "penyesuaian_edit" for m in mv)
        # hard delete (no sales)
        d = s.delete(f"{API}/products/{p['id']}").json()
        assert d.get("ok") and not d.get("soft")
        assert s.get(f"{API}/products/by-barcode/TEST999001").status_code == 404

    def test_update_missing_404(self, s):
        assert s.put(f"{API}/products/nope", json={"name": "x"}).status_code == 404

    def test_delete_missing_404(self, s):
        assert s.delete(f"{API}/products/nope").status_code == 404

    def test_regex_special_chars_search(self, s):
        r = s.get(f"{API}/products", params={"q": "(abc"})
        assert r.status_code == 200, f"Search with '(' returned {r.status_code}"


# ---- Stock adjust ----
class TestStock:
    def test_adjust(self, s):
        p = s.post(f"{API}/products", json={"name": "TEST_Stock", "stock": 5,
                                            "sale_price": 100}).json()
        r = s.post(f"{API}/stock/adjust", json={"product_id": p["id"], "qty_delta": 3,
                                                "reason": "penyesuaian"})
        assert r.status_code == 200 and r.json()["new_stock"] == 8
        r = s.post(f"{API}/stock/adjust", json={"product_id": p["id"], "qty_delta": -2,
                                                "reason": "rusak"})
        assert r.json()["new_stock"] == 6
        r = s.post(f"{API}/stock/adjust", json={"product_id": p["id"], "qty_delta": -100,
                                                "reason": "hilang"})
        assert r.status_code == 400
        prod = [x for x in s.get(f"{API}/products", params={"q": "TEST_Stock"}).json() if x["id"] == p["id"]][0]
        assert prod["stock"] == 6
        assert s.post(f"{API}/stock/adjust", json={"product_id": "nope", "qty_delta": 1,
                                                   "reason": "x"}).status_code == 404
        s.delete(f"{API}/products/{p['id']}")


# ---- Sales + soft delete + settings below cost ----
class TestSales:
    def test_sale_happy_and_soft_delete(self, s):
        p = s.post(f"{API}/products", json={"name": "TEST_SaleProd", "stock": 10,
                                            "cost_price": 1000, "sale_price": 2000}).json()
        before = s.get(f"{API}/dashboard").json()["omzet"]
        r = s.post(f"{API}/sales", json={"items": [{"product_id": p["id"], "name": p["name"],
                                                    "qty": 2, "price": 2000, "discount": 500}],
                                         "global_discount": 500, "cash_received": 5000})
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["subtotal"] == 3500 and sale["total"] == 3000 and sale["change"] == 2000
        assert sale["sale_no"].startswith("TRX-")
        assert len(sale["items"]) == 1 and "_id" not in sale["items"][0]
        assert sale["gross_profit"] == 1000
        g = s.get(f"{API}/sales/{sale['id']}").json()
        assert g["total"] == 3000 and len(g["items"]) == 1
        prod = [x for x in s.get(f"{API}/products", params={"q": "TEST_SaleProd"}).json() if x["id"] == p["id"]][0]
        assert prod["stock"] == 8
        after = s.get(f"{API}/dashboard").json()["omzet"]
        assert after - before == 3000
        # insufficient cash
        r = s.post(f"{API}/sales", json={"items": [{"product_id": p["id"], "name": "x",
                                                    "qty": 1, "price": 2000}],
                                         "cash_received": 100})
        assert r.status_code == 400
        # insufficient stock
        r = s.post(f"{API}/sales", json={"items": [{"product_id": p["id"], "name": "x",
                                                    "qty": 999, "price": 2000}],
                                         "cash_received": 99999999})
        assert r.status_code == 400
        # soft delete
        d = s.delete(f"{API}/products/{p['id']}").json()
        assert d.get("soft") is True
        prod = [x for x in s.get(f"{API}/products", params={"q": "TEST_SaleProd"}).json() if x["id"] == p["id"]][0]
        assert prod["active"] is False

    def test_below_cost_blocked(self, s):
        orig = s.get(f"{API}/settings").json()
        p = s.post(f"{API}/products", json={"name": "TEST_BelowCost", "stock": 10,
                                            "cost_price": 1000, "sale_price": 2000}).json()
        try:
            new = dict(orig, allow_sell_below_cost=False)
            assert s.put(f"{API}/settings", json=new).status_code == 200
            assert s.get(f"{API}/settings").json()["allow_sell_below_cost"] is False
            r = s.post(f"{API}/sales", json={"items": [{"product_id": p["id"], "name": "x",
                                                        "qty": 1, "price": 500}],
                                             "cash_received": 1000})
            assert r.status_code == 400 and "modal" in r.json()["detail"]
        finally:
            orig["allow_sell_below_cost"] = True
            s.put(f"{API}/settings", json=orig)
            s.delete(f"{API}/products/{p['id']}")
        assert s.get(f"{API}/settings").json()["allow_sell_below_cost"] is True


# ---- Purchases ----
class TestPurchases:
    def test_pending_receive_wac_delete(self, s):
        p = s.post(f"{API}/products", json={"name": "TEST_PurProd", "stock": 10,
                                            "cost_price": 1000, "sale_price": 2000}).json()
        r = s.post(f"{API}/purchases", json={"supplier_name": "TEST_Sup", "received": False,
                                             "items": [{"product_id": p["id"], "qty": 10,
                                                        "cost_price": 2000}]})
        assert r.status_code == 200
        pur = r.json()
        assert pur["status"] == "menunggu" and pur["total"] == 20000
        assert pur["purchase_no"].startswith("BLI-") and len(pur["items"]) == 1
        prod = [x for x in s.get(f"{API}/products", params={"q": "TEST_PurProd"}).json() if x["id"] == p["id"]][0]
        assert prod["stock"] == 10
        assert s.post(f"{API}/purchases/{pur['id']}/receive").status_code == 200
        prod = [x for x in s.get(f"{API}/products", params={"q": "TEST_PurProd"}).json() if x["id"] == p["id"]][0]
        assert prod["stock"] == 20 and prod["cost_price"] == 1500
        assert s.get(f"{API}/purchases/{pur['id']}").json()["status"] == "diterima"
        # receive again idempotent
        s.post(f"{API}/purchases/{pur['id']}/receive")
        assert [x for x in s.get(f"{API}/products", params={"q": "TEST_PurProd"}).json() if x["id"] == p["id"]][0]["stock"] == 20
        assert s.delete(f"{API}/purchases/{pur['id']}").status_code == 400
        # pending purchase delete ok
        r2 = s.post(f"{API}/purchases", json={"items": [{"product_id": p["id"], "qty": 1,
                                                         "cost_price": 1}]}).json()
        assert s.delete(f"{API}/purchases/{r2['id']}").status_code == 200
        assert s.get(f"{API}/purchases/{r2['id']}").status_code == 404
        # received=True direct
        r3 = s.post(f"{API}/purchases", json={"received": True, "items": [
            {"product_id": p["id"], "qty": 5, "cost_price": 1500}]}).json()
        assert r3["status"] == "diterima"
        assert [x for x in s.get(f"{API}/products", params={"q": "TEST_PurProd"}).json() if x["id"] == p["id"]][0]["stock"] == 25
        assert s.post(f"{API}/purchases", json={"items": []}).status_code == 400
        assert s.post(f"{API}/purchases/nope/receive").status_code == 404
        s.delete(f"{API}/products/{p['id']}")


# ---- Backup export/import roundtrip ----
class TestBackup:
    def test_roundtrip(self, s):
        exp = s.get(f"{API}/backup/export")
        assert exp.status_code == 200
        data = exp.json()
        counts = {k: len(data[k]) for k in data if isinstance(data[k], list)}
        r = s.post(f"{API}/backup/import", json=data)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        for k, v in r.json()["restored"].items():
            assert counts[k] == v
        exp2 = s.get(f"{API}/backup/export").json()
        for k, v in counts.items():
            assert len(exp2[k]) == v
        # app still functions after import
        assert s.get(f"{API}/products").status_code == 200
        assert s.get(f"{API}/settings").status_code == 200

    def test_invalid_import(self, s):
        assert s.post(f"{API}/backup/import", json={"foo": 1}).status_code == 400
