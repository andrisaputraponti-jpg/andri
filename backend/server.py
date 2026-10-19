"""Kasir Toko Serba Ada - POS Backend (FastAPI + MongoDB).

All currency amounts are stored as INTEGERS in Rupiah (no decimals).
All timestamps stored as ISO strings in UTC.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Kasir Toko Serba Ada API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("kasir")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ============================= MODELS =============================
class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = ""
    active: bool = True
    created_at: str = Field(default_factory=now_iso)


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    code: str
    barcode: Optional[str] = ""
    name: str
    category_id: Optional[str] = ""
    category_name: Optional[str] = ""
    unit: str = "Pcs"
    cost_price: int = 0           # Harga beli (modal) dalam Rupiah
    sale_price: int = 0           # Harga jual standar
    stock: int = 0
    min_stock: int = 0
    active: bool = True
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    code: Optional[str] = ""
    barcode: Optional[str] = ""
    name: str
    category_id: Optional[str] = ""
    unit: Optional[str] = "Pcs"
    cost_price: int = 0
    sale_price: int = 0
    stock: int = 0
    min_stock: int = 0
    active: bool = True


class CartItem(BaseModel):
    product_id: str
    name: str
    unit: str = "Pcs"
    qty: int
    price: int                    # harga aktual satuan
    cost_price: int = 0
    discount: int = 0             # diskon total untuk baris ini (Rp)


class SaleCreate(BaseModel):
    items: List[CartItem]
    global_discount: int = 0      # diskon global Rp
    tax_percent: int = 0          # 0 atau 11
    cash_received: int = 0
    note: Optional[str] = ""


class StockAdjust(BaseModel):
    product_id: str
    qty_delta: int                # +/- delta
    reason: str                   # 'penyesuaian', 'rusak', 'hilang', 'penghitungan'
    note: Optional[str] = ""


class PurchaseItemIn(BaseModel):
    product_id: str
    qty: int
    cost_price: int


class PurchaseCreate(BaseModel):
    supplier_name: Optional[str] = ""
    items: List[PurchaseItemIn]
    note: Optional[str] = ""
    received: bool = False        # jika True langsung tambah stok


class SettingsModel(BaseModel):
    store_name: str = "Toko Serba Ada"
    address: str = ""
    phone: str = ""
    receipt_footer: str = "Terima kasih atas kunjungan Anda."
    paper_size: str = "58mm"      # '58mm' | '80mm'
    allow_sell_below_cost: bool = True
    enable_tax: bool = False
    tax_percent: int = 11
    printer_name: str = ""
    low_stock_global: int = 5


# ============================= HELPERS =============================
def strip_id(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


async def get_settings_doc() -> Dict[str, Any]:
    doc = await db.settings.find_one({"_id": "singleton"})
    if not doc:
        default = SettingsModel().model_dump()
        default["_id"] = "singleton"
        await db.settings.insert_one(default)
        doc = default
    doc.pop("_id", None)
    return doc


async def next_sale_number() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    counter = await db.counters.find_one_and_update(
        {"_id": f"sale_{today}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter["seq"] if counter else 1
    return f"TRX-{today}-{seq:04d}"


async def next_purchase_number() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    counter = await db.counters.find_one_and_update(
        {"_id": f"purchase_{today}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter["seq"] if counter else 1
    return f"BLI-{today}-{seq:04d}"


async def record_stock_movement(product_id: str, delta: int, reason: str,
                                ref_type: str = "", ref_id: str = "",
                                note: str = ""):
    doc = {
        "id": new_id(),
        "product_id": product_id,
        "qty_delta": delta,
        "reason": reason,
        "ref_type": ref_type,
        "ref_id": ref_id,
        "note": note,
        "created_at": now_iso(),
    }
    await db.stock_movements.insert_one(doc)


# ============================= SEEDING =============================
SEED_CATEGORIES = [
    "Sembako & Kebutuhan Pokok",
    "Makanan & Camilan",
    "Minuman Dingin & Hangat",
    "Perlengkapan Rumah Tangga",
    "Perawatan Pribadi & Sabun",
    "Alat Tulis Kantor (ATK)",
]

SEED_PRODUCTS = [
    {"name": "Beras Ramos Wangi 5kg", "barcode": "899100110001", "cat": "Sembako & Kebutuhan Pokok", "cost": 64000, "price": 72000, "stock": 25, "unit": "Sak"},
    {"name": "Minyak Goreng Bimoli 2L", "barcode": "899100110002", "cat": "Sembako & Kebutuhan Pokok", "cost": 32000, "price": 37500, "stock": 40, "unit": "Pouch"},
    {"name": "Gula Pasir Gulaku 1kg", "barcode": "899100110003", "cat": "Sembako & Kebutuhan Pokok", "cost": 15500, "price": 18000, "stock": 30, "unit": "Bungkus"},
    {"name": "Indomie Goreng Spesial 85g", "barcode": "899886620022", "cat": "Makanan & Camilan", "cost": 2800, "price": 3500, "stock": 120, "unit": "Bungkus"},
    {"name": "Teh Pucuk Harum 350ml", "barcode": "899277531102", "cat": "Minuman Dingin & Hangat", "cost": 3200, "price": 4000, "stock": 48, "unit": "Botol"},
    {"name": "Aqua Air Mineral 600ml", "barcode": "899600160026", "cat": "Minuman Dingin & Hangat", "cost": 2700, "price": 3500, "stock": 60, "unit": "Botol"},
    {"name": "Sabun Sunlight Jeruk Nipis 750ml", "barcode": "899999905221", "cat": "Perlengkapan Rumah Tangga", "cost": 14000, "price": 16500, "stock": 15, "unit": "Pouch"},
    {"name": "Pasta Gigi Pepsodent 190g", "barcode": "899999905223", "cat": "Perawatan Pribadi & Sabun", "cost": 12500, "price": 15000, "stock": 20, "unit": "Kotak"},
    {"name": "Pulpen Standard AE7 Hitam", "barcode": "899111222333", "cat": "Alat Tulis Kantor (ATK)", "cost": 2000, "price": 3000, "stock": 50, "unit": "Pcs"},
]


async def ensure_seed():
    cats_count = await db.categories.count_documents({})
    cat_map: Dict[str, str] = {}
    if cats_count == 0:
        for n in SEED_CATEGORIES:
            c = Category(name=n, description="(contoh - boleh dihapus)")
            await db.categories.insert_one(c.model_dump())
            cat_map[n] = c.id
    else:
        async for c in db.categories.find({}, {"_id": 0}):
            cat_map[c["name"]] = c["id"]

    prod_count = await db.products.count_documents({})
    if prod_count == 0:
        seq = 1
        for p in SEED_PRODUCTS:
            cat_id = cat_map.get(p["cat"], "")
            prod = Product(
                code=f"P{seq:04d}",
                barcode=p["barcode"],
                name=p["name"],
                category_id=cat_id,
                category_name=p["cat"],
                unit=p["unit"],
                cost_price=p["cost"],
                sale_price=p["price"],
                stock=p["stock"],
                min_stock=5,
            )
            await db.products.insert_one(prod.model_dump())
            await record_stock_movement(prod.id, p["stock"], "stok_awal",
                                        ref_type="seed", note="Stok awal data contoh")
            seq += 1

    await get_settings_doc()  # ensure settings exist


# ============================= CATEGORIES =============================
@api.get("/categories")
async def list_categories():
    out = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return out


@api.post("/categories")
async def create_category(data: CategoryCreate):
    c = Category(**data.model_dump())
    await db.categories.insert_one(c.model_dump())
    return c.model_dump()


@api.put("/categories/{cat_id}")
async def update_category(cat_id: str, data: CategoryCreate):
    existing = await db.categories.find_one({"id": cat_id})
    if not existing:
        raise HTTPException(404, "Kategori tidak ditemukan")
    await db.categories.update_one({"id": cat_id}, {"$set": {
        "name": data.name, "description": data.description or ""}})
    # sync product category name
    await db.products.update_many({"category_id": cat_id},
                                  {"$set": {"category_name": data.name}})
    return {"ok": True}


@api.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    used = await db.products.count_documents({"category_id": cat_id})
    if used > 0:
        raise HTTPException(400, f"Kategori digunakan oleh {used} barang")
    r = await db.categories.delete_one({"id": cat_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Kategori tidak ditemukan")
    return {"ok": True}


# ============================= PRODUCTS =============================
@api.get("/products")
async def list_products(q: Optional[str] = None, category_id: Optional[str] = None,
                        active_only: bool = False, low_stock: bool = False):
    query: Dict[str, Any] = {}
    if active_only:
        query["active"] = True
    if category_id:
        query["category_id"] = category_id
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"code": {"$regex": q, "$options": "i"}},
            {"barcode": {"$regex": q, "$options": "i"}},
        ]
    items = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(5000)
    if low_stock:
        items = [i for i in items if i.get("stock", 0) <= i.get("min_stock", 0)]
    return items


@api.get("/products/by-barcode/{barcode}")
async def product_by_barcode(barcode: str):
    doc = await db.products.find_one({"barcode": barcode, "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Barcode tidak terdaftar")
    return doc


@api.post("/products")
async def create_product(data: ProductCreate):
    cat_name = ""
    if data.category_id:
        cat = await db.categories.find_one({"id": data.category_id})
        if cat:
            cat_name = cat["name"]
    code = data.code or f"P{int(datetime.now().timestamp())%100000:05d}"
    p = Product(
        code=code,
        barcode=(data.barcode or "").strip(),
        name=data.name,
        category_id=data.category_id or "",
        category_name=cat_name,
        unit=data.unit or "Pcs",
        cost_price=max(0, int(data.cost_price)),
        sale_price=max(0, int(data.sale_price)),
        stock=max(0, int(data.stock)),
        min_stock=max(0, int(data.min_stock)),
        active=data.active,
    )
    await db.products.insert_one(p.model_dump())
    if p.stock > 0:
        await record_stock_movement(p.id, p.stock, "stok_awal",
                                    note="Stok awal saat tambah barang")
    return p.model_dump()


@api.put("/products/{pid}")
async def update_product(pid: str, data: ProductCreate):
    existing = await db.products.find_one({"id": pid})
    if not existing:
        raise HTTPException(404, "Barang tidak ditemukan")
    cat_name = existing.get("category_name", "")
    if data.category_id and data.category_id != existing.get("category_id"):
        cat = await db.categories.find_one({"id": data.category_id})
        cat_name = cat["name"] if cat else ""
    stock_delta = int(data.stock) - int(existing.get("stock", 0))
    upd = {
        "code": data.code or existing["code"],
        "barcode": (data.barcode or "").strip(),
        "name": data.name,
        "category_id": data.category_id or "",
        "category_name": cat_name,
        "unit": data.unit or "Pcs",
        "cost_price": max(0, int(data.cost_price)),
        "sale_price": max(0, int(data.sale_price)),
        "stock": max(0, int(data.stock)),
        "min_stock": max(0, int(data.min_stock)),
        "active": data.active,
        "updated_at": now_iso(),
    }
    await db.products.update_one({"id": pid}, {"$set": upd})
    if stock_delta != 0:
        await record_stock_movement(pid, stock_delta, "penyesuaian_edit",
                                    note="Penyesuaian via edit produk")
    return {"ok": True}


@api.delete("/products/{pid}")
async def delete_product(pid: str):
    used = await db.sale_items.count_documents({"product_id": pid})
    if used > 0:
        # soft-delete via deactivate agar riwayat tidak rusak
        await db.products.update_one({"id": pid}, {"$set": {"active": False}})
        return {"ok": True, "soft": True,
                "message": "Barang dinonaktifkan karena memiliki riwayat penjualan"}
    r = await db.products.delete_one({"id": pid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Barang tidak ditemukan")
    return {"ok": True}


# ============================= STOCK =============================
@api.get("/stock/movements")
async def list_movements(product_id: Optional[str] = None, limit: int = 200):
    q: Dict[str, Any] = {}
    if product_id:
        q["product_id"] = product_id
    docs = await db.stock_movements.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # enrich dengan nama produk
    pids = list({d["product_id"] for d in docs})
    pmap: Dict[str, str] = {}
    if pids:
        async for p in db.products.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "name": 1, "unit": 1}):
            pmap[p["id"]] = p
    for d in docs:
        p = pmap.get(d["product_id"], {})
        d["product_name"] = p.get("name", "(dihapus)")
        d["unit"] = p.get("unit", "")
    return docs


@api.post("/stock/adjust")
async def adjust_stock(data: StockAdjust):
    p = await db.products.find_one({"id": data.product_id})
    if not p:
        raise HTTPException(404, "Barang tidak ditemukan")
    new_stock = int(p.get("stock", 0)) + int(data.qty_delta)
    if new_stock < 0:
        raise HTTPException(400, "Stok tidak boleh negatif")
    await db.products.update_one({"id": data.product_id},
                                 {"$set": {"stock": new_stock, "updated_at": now_iso()}})
    await record_stock_movement(data.product_id, data.qty_delta, data.reason,
                                ref_type="adjust", note=data.note or "")
    return {"ok": True, "new_stock": new_stock}


# ============================= SALES / KASIR =============================
@api.post("/sales")
async def create_sale(data: SaleCreate):
    if not data.items:
        raise HTTPException(400, "Keranjang kosong")

    settings = await get_settings_doc()

    # Validate & compute totals, lock stock
    subtotal = 0
    line_docs: List[Dict[str, Any]] = []
    for it in data.items:
        if it.qty <= 0:
            raise HTTPException(400, f"Kuantitas tidak valid untuk {it.name}")
        p = await db.products.find_one({"id": it.product_id})
        if not p:
            raise HTTPException(404, f"Barang {it.name} tidak ditemukan")
        if int(p.get("stock", 0)) < it.qty:
            raise HTTPException(400,
                                f"Stok {p['name']} tidak cukup (tersisa {p.get('stock',0)})")
        if (not settings.get("allow_sell_below_cost", True)) and it.price < int(p.get("cost_price", 0)):
            raise HTTPException(400,
                                f"Harga jual {p['name']} di bawah modal (tidak diizinkan)")
        line_subtotal = it.qty * it.price - max(0, it.discount)
        subtotal += line_subtotal
        line_docs.append({
            "id": new_id(),
            "product_id": it.product_id,
            "product_name": p["name"],
            "unit": p.get("unit", "Pcs"),
            "qty": it.qty,
            "price": int(it.price),
            "cost_price": int(p.get("cost_price", 0)),
            "discount": max(0, int(it.discount)),
            "line_total": line_subtotal,
        })

    global_discount = max(0, int(data.global_discount))
    after_disc = max(0, subtotal - global_discount)
    tax_percent = int(data.tax_percent) if settings.get("enable_tax") else 0
    tax = (after_disc * tax_percent) // 100 if tax_percent else 0
    total = after_disc + tax
    cash = max(0, int(data.cash_received))
    if cash < total:
        raise HTTPException(400, "Uang diterima kurang dari total")
    change = cash - total

    sale_no = await next_sale_number()
    sale_id = new_id()
    created = now_iso()

    cogs = sum(li["qty"] * li["cost_price"] for li in line_docs)
    sale_doc = {
        "id": sale_id,
        "sale_no": sale_no,
        "created_at": created,
        "items_count": sum(li["qty"] for li in line_docs),
        "subtotal": subtotal,
        "global_discount": global_discount,
        "tax_percent": tax_percent,
        "tax": tax,
        "total": total,
        "cash_received": cash,
        "change": change,
        "cogs": cogs,
        "gross_profit": total - tax - cogs,
        "note": data.note or "",
    }
    await db.sales.insert_one(sale_doc)
    for li in line_docs:
        li["sale_id"] = sale_id
        li["sale_no"] = sale_no
        li["created_at"] = created
        await db.sale_items.insert_one(li)
        # decrement stock + record movement
        await db.products.update_one({"id": li["product_id"]},
                                     {"$inc": {"stock": -li["qty"]},
                                      "$set": {"updated_at": created}})
        await record_stock_movement(li["product_id"], -li["qty"], "penjualan",
                                    ref_type="sale", ref_id=sale_id,
                                    note=f"Penjualan {sale_no}")

    sale_doc.pop("_id", None)
    for li in line_docs:
        li.pop("_id", None)
    sale_doc["items"] = line_docs
    return sale_doc


@api.get("/sales")
async def list_sales(start: Optional[str] = None, end: Optional[str] = None,
                     q: Optional[str] = None, limit: int = 200):
    query: Dict[str, Any] = {}
    if start or end:
        rng: Dict[str, Any] = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end
        query["created_at"] = rng
    if q:
        query["sale_no"] = {"$regex": q, "$options": "i"}
    docs = await db.sales.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api.get("/sales/{sale_id}")
async def get_sale(sale_id: str):
    s = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    items = await db.sale_items.find({"sale_id": sale_id}, {"_id": 0}).to_list(1000)
    s["items"] = items
    return s


# ============================= PURCHASES =============================
@api.post("/purchases")
async def create_purchase(data: PurchaseCreate):
    if not data.items:
        raise HTTPException(400, "Daftar barang pembelian kosong")
    pur_no = await next_purchase_number()
    pur_id = new_id()
    created = now_iso()
    total = 0
    line_docs: List[Dict[str, Any]] = []
    for it in data.items:
        p = await db.products.find_one({"id": it.product_id})
        if not p:
            raise HTTPException(404, "Barang tidak ditemukan")
        if it.qty <= 0:
            raise HTTPException(400, "Kuantitas pembelian tidak valid")
        line_total = it.qty * it.cost_price
        total += line_total
        line_docs.append({
            "id": new_id(),
            "purchase_id": pur_id,
            "product_id": it.product_id,
            "product_name": p["name"],
            "unit": p.get("unit", "Pcs"),
            "qty": it.qty,
            "cost_price": int(it.cost_price),
            "line_total": line_total,
            "created_at": created,
        })

    doc = {
        "id": pur_id,
        "purchase_no": pur_no,
        "supplier_name": data.supplier_name or "",
        "created_at": created,
        "total": total,
        "status": "diterima" if data.received else "menunggu",
        "note": data.note or "",
    }
    await db.purchases.insert_one(doc)
    for li in line_docs:
        await db.purchase_items.insert_one(li)

    if data.received:
        await _receive_purchase(pur_id)
    return await get_purchase(pur_id)


async def _receive_purchase(pur_id: str):
    pur = await db.purchases.find_one({"id": pur_id})
    if not pur:
        raise HTTPException(404, "Pembelian tidak ditemukan")
    if pur.get("status") == "diterima":
        return
    items = await db.purchase_items.find({"purchase_id": pur_id}, {"_id": 0}).to_list(1000)
    for li in items:
        p = await db.products.find_one({"id": li["product_id"]})
        if not p:
            continue
        # Weighted average cost update
        old_stock = int(p.get("stock", 0))
        old_cost = int(p.get("cost_price", 0))
        add_qty = int(li["qty"])
        add_cost = int(li["cost_price"])
        new_stock = old_stock + add_qty
        new_cost = ((old_stock * old_cost) + (add_qty * add_cost)) // max(new_stock, 1) \
            if new_stock > 0 else add_cost
        await db.products.update_one({"id": p["id"]}, {"$set": {
            "stock": new_stock,
            "cost_price": new_cost,
            "updated_at": now_iso(),
        }})
        await record_stock_movement(p["id"], add_qty, "pembelian",
                                    ref_type="purchase", ref_id=pur_id,
                                    note=f"Pembelian {pur.get('purchase_no','')}")
    await db.purchases.update_one({"id": pur_id}, {"$set": {
        "status": "diterima", "received_at": now_iso()}})


@api.post("/purchases/{pur_id}/receive")
async def receive_purchase(pur_id: str):
    await _receive_purchase(pur_id)
    return {"ok": True}


@api.get("/purchases")
async def list_purchases(limit: int = 200):
    docs = await db.purchases.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api.get("/purchases/{pur_id}")
async def get_purchase(pur_id: str):
    s = await db.purchases.find_one({"id": pur_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Pembelian tidak ditemukan")
    items = await db.purchase_items.find({"purchase_id": pur_id}, {"_id": 0}).to_list(1000)
    s["items"] = items
    return s


@api.delete("/purchases/{pur_id}")
async def delete_purchase(pur_id: str):
    p = await db.purchases.find_one({"id": pur_id})
    if not p:
        raise HTTPException(404, "Pembelian tidak ditemukan")
    if p.get("status") == "diterima":
        raise HTTPException(400, "Pembelian yang sudah diterima tidak dapat dihapus")
    await db.purchases.delete_one({"id": pur_id})
    await db.purchase_items.delete_many({"purchase_id": pur_id})
    return {"ok": True}


# ============================= REPORTS / DASHBOARD =============================
def _date_range_iso(start_date: Optional[str], end_date: Optional[str]):
    """Accept YYYY-MM-DD; produce ISO range inclusive."""
    def to_iso(d: str, end: bool = False) -> str:
        dt = datetime.fromisoformat(d)
        if end:
            dt = dt + timedelta(days=1) - timedelta(microseconds=1)
        return dt.replace(tzinfo=timezone.utc).isoformat()

    today = datetime.now(timezone.utc).date().isoformat()
    s = to_iso(start_date or today)
    e = to_iso(end_date or today, end=True)
    return s, e


@api.get("/dashboard")
async def dashboard(start_date: Optional[str] = None, end_date: Optional[str] = None):
    s, e = _date_range_iso(start_date, end_date)
    sales = await db.sales.find(
        {"created_at": {"$gte": s, "$lte": e}}, {"_id": 0}
    ).to_list(10000)
    omzet = sum(x["total"] for x in sales)
    trx_count = len(sales)
    gross_profit = sum(x.get("gross_profit", 0) for x in sales)

    products = await db.products.find({"active": True}, {"_id": 0}).to_list(10000)
    active_products = len(products)
    low_stock = sum(1 for p in products if p.get("stock", 0) <= p.get("min_stock", 0))
    inventory_value = sum(p.get("stock", 0) * p.get("cost_price", 0) for p in products)

    purchases = await db.purchases.find(
        {"created_at": {"$gte": s, "$lte": e}}, {"_id": 0}).to_list(10000)
    total_purchases = sum(x.get("total", 0) for x in purchases)

    # Best sellers in range
    pipeline = [
        {"$match": {"created_at": {"$gte": s, "$lte": e}}},
        {"$group": {
            "_id": "$product_id",
            "product_name": {"$first": "$product_name"},
            "qty": {"$sum": "$qty"},
            "revenue": {"$sum": "$line_total"},
        }},
        {"$sort": {"qty": -1}},
        {"$limit": 10},
    ]
    best = await db.sale_items.aggregate(pipeline).to_list(10)
    best = [{"product_id": b["_id"], "product_name": b["product_name"],
             "qty": b["qty"], "revenue": b["revenue"]} for b in best]

    # Sales trend (last 7 days from end_date)
    end_dt = datetime.fromisoformat(e[:19])
    trend = []
    for i in range(6, -1, -1):
        d = (end_dt - timedelta(days=i)).date()
        d_s, d_e = _date_range_iso(d.isoformat(), d.isoformat())
        day_sales = await db.sales.find(
            {"created_at": {"$gte": d_s, "$lte": d_e}}, {"_id": 0, "total": 1}
        ).to_list(10000)
        trend.append({
            "date": d.isoformat(),
            "total": sum(x["total"] for x in day_sales),
            "count": len(day_sales),
        })

    return {
        "range": {"start": s, "end": e},
        "omzet": omzet,
        "transactions": trx_count,
        "gross_profit": gross_profit,
        "active_products": active_products,
        "low_stock_count": low_stock,
        "inventory_value": inventory_value,
        "total_purchases": total_purchases,
        "best_sellers": best,
        "sales_trend": trend,
    }


@api.get("/reports/sales")
async def report_sales(start_date: Optional[str] = None, end_date: Optional[str] = None):
    s, e = _date_range_iso(start_date, end_date)
    sales = await db.sales.find(
        {"created_at": {"$gte": s, "$lte": e}}, {"_id": 0}
    ).sort("created_at", -1).to_list(10000)

    # by category
    items = await db.sale_items.find(
        {"created_at": {"$gte": s, "$lte": e}}, {"_id": 0}).to_list(100000)
    pid_set = list({i["product_id"] for i in items})
    cat_map: Dict[str, str] = {}
    if pid_set:
        async for p in db.products.find({"id": {"$in": pid_set}},
                                        {"_id": 0, "id": 1, "category_name": 1}):
            cat_map[p["id"]] = p.get("category_name") or "Tanpa Kategori"
    by_cat: Dict[str, Dict[str, int]] = {}
    for it in items:
        c = cat_map.get(it["product_id"], "Tanpa Kategori")
        if c not in by_cat:
            by_cat[c] = {"qty": 0, "revenue": 0}
        by_cat[c]["qty"] += it["qty"]
        by_cat[c]["revenue"] += it["line_total"]
    by_cat_list = [{"category": k, **v} for k, v in by_cat.items()]
    by_cat_list.sort(key=lambda x: x["revenue"], reverse=True)

    totals = {
        "omzet": sum(x["total"] for x in sales),
        "transactions": len(sales),
        "gross_profit": sum(x.get("gross_profit", 0) for x in sales),
        "discount": sum(x.get("global_discount", 0) for x in sales),
        "tax": sum(x.get("tax", 0) for x in sales),
    }
    return {"range": {"start": s, "end": e},
            "totals": totals, "sales": sales, "by_category": by_cat_list}


# ============================= SETTINGS =============================
@api.get("/settings")
async def get_settings():
    return await get_settings_doc()


@api.put("/settings")
async def update_settings(data: SettingsModel):
    doc = data.model_dump()
    doc["_id"] = "singleton"
    await db.settings.replace_one({"_id": "singleton"}, doc, upsert=True)
    doc.pop("_id", None)
    return doc


# ============================= BACKUP =============================
@api.get("/backup/export")
async def backup_export():
    collections = ["categories", "products", "sales", "sale_items", "purchases",
                   "purchase_items", "stock_movements", "settings", "counters"]
    data: Dict[str, Any] = {"version": 1, "exported_at": now_iso()}
    for col in collections:
        docs = await db[col].find({}).to_list(1000000)
        for d in docs:
            if "_id" in d and not isinstance(d["_id"], str):
                d["_id"] = str(d["_id"])
        data[col] = docs
    return JSONResponse(content=data)


@api.post("/backup/import")
async def backup_import(payload: Dict[str, Any] = Body(...)):
    if not isinstance(payload, dict) or "version" not in payload:
        raise HTTPException(400, "Berkas cadangan tidak valid")
    collections = ["categories", "products", "sales", "sale_items", "purchases",
                   "purchase_items", "stock_movements", "settings", "counters"]
    restored: Dict[str, int] = {}
    for col in collections:
        docs = payload.get(col) or []
        await db[col].delete_many({})
        if docs:
            await db[col].insert_many(docs)
        restored[col] = len(docs)
    return {"ok": True, "restored": restored}


# ============================= INIT =============================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_start():
    try:
        await db.products.create_index("barcode")
        await db.products.create_index("code")
        await db.products.create_index("category_id")
        await db.sales.create_index("created_at")
        await db.sale_items.create_index("sale_id")
        await db.sale_items.create_index("product_id")
        await db.purchases.create_index("created_at")
        await db.stock_movements.create_index("product_id")
        await ensure_seed()
        logger.info("Kasir backend ready")
    except Exception as ex:
        logger.exception("Startup error: %s", ex)


@app.on_event("shutdown")
async def on_stop():
    client.close()


@api.get("/")
async def root():
    return {"app": "Kasir Toko Serba Ada", "status": "ok"}
