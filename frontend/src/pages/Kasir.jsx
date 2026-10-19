import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { rupiah, parseRupiahInput } from "@/lib/format";
import { cache, isNetworkError, newClientId, queueSale, queueCounts } from "@/lib/offline";
import { Search, Trash2, Plus, Minus, X, AlertTriangle, WifiOff } from "lucide-react";
import Receipt from "@/components/Receipt";
import PaymentPanel from "@/components/PaymentPanel";

export default function Kasir() {
  const [products, setProducts] = useState(cache.get("products", []));
  const [categories, setCategories] = useState(cache.get("categories", []));
  const [settings, setSettings] = useState(cache.get("settings", null));
  const [offlineData, setOfflineData] = useState(false);
  const [activeCat, setActiveCat] = useState("");
  const [q, setQ] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [cash, setCash] = useState(0);
  const [method, setMethod] = useState("tunai");
  const [payRef, setPayRef] = useState("");
  const [tax, setTax] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const barcodeRef = useRef(null);
  const cashRef = useRef(null);

  const saveProducts = (list) => { setProducts(list); cache.set("products", list); };

  const loadCatalog = useCallback(async () => {
    try {
      const [p, c, s] = await Promise.all([api.listProducts({ active_only: true }), api.listCategories(), api.getSettings()]);
      saveProducts(p); setCategories(c); setSettings(s);
      cache.set("categories", c); cache.set("settings", s);
      setOfflineData(false);
    } catch {
      setOfflineData(true);
    }
  }, []);

  useEffect(() => {
    loadCatalog(); barcodeRef.current?.focus();
    const onQueue = () => { if (!queueCounts().pending) loadCatalog(); };
    const onOffline = () => setOfflineData(true);
    window.addEventListener("online", loadCatalog);
    window.addEventListener("offline", onOffline);
    window.addEventListener("queue-changed", onQueue);
    return () => {
      window.removeEventListener("online", loadCatalog);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("queue-changed", onQueue);
    };
  }, [loadCatalog]);
  useEffect(() => { if (settings) setTax(!!settings.enable_tax && !!settings.tax_percent); }, [settings]);

  const resetCart = () => { setCart([]); setGlobalDiscount(0); setCash(0); setPayRef(""); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F2") { e.preventDefault(); barcodeRef.current?.focus(); }
      if (e.key === "F4") { e.preventDefault(); resetCart(); }
      if (e.key === "F9") { e.preventDefault(); cashRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => (!activeCat || p.category_id === activeCat) &&
      (!s || p.name.toLowerCase().includes(s) || (p.code || "").toLowerCase().includes(s) || (p.barcode || "").includes(s)));
  }, [products, q, activeCat]);

  const addProductToCart = (p) => {
    if (p.stock <= 0) { setMsg(`Stok ${p.name} habis`); return; }
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.product_id === p.id);
      if (idx >= 0) {
        if (prev[idx].qty + 1 > p.stock) { setMsg(`Stok ${p.name} tidak cukup`); return prev; }
        return prev.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { product_id: p.id, name: p.name, unit: p.unit, qty: 1, price: p.sale_price, cost_price: p.cost_price, discount: 0, stock: p.stock }];
    });
    setMsg("");
  };

  const onBarcodeKey = (e) => {
    if (e.key !== "Enter") return;
    const code = barcode.trim();
    if (!code) return;
    const p = products.find((x) => x.barcode === code) || products.find((x) => (x.code || "").toLowerCase() === code.toLowerCase());
    if (p) { addProductToCart(p); setBarcode(""); }
    else setMsg(`Barcode "${code}" tidak terdaftar. Cari manual atau daftarkan dulu.`);
  };

  const patchItem = (pid, patch) => setCart((prev) => prev.map((x) => (x.product_id === pid ? { ...x, ...patch(x) } : x)));
  const updateQty = (pid, qty) => patchItem(pid, (x) => ({ qty: Math.max(1, Math.min(x.stock, parseInt(qty || "1", 10) || 1)) }));
  const removeItem = (pid) => setCart((prev) => prev.filter((x) => x.product_id !== pid));

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, x) => s + x.qty * x.price - (x.discount || 0), 0);
    const afterDisc = Math.max(0, subtotal - globalDiscount);
    const taxPct = tax && settings?.tax_percent ? settings.tax_percent : 0;
    const taxVal = taxPct ? Math.floor((afterDisc * taxPct) / 100) : 0;
    const total = afterDisc + taxVal;
    const paid = method === "tunai" ? cash : total;
    return { subtotal, taxPct, taxVal, total, paid, change: Math.max(0, paid - total) };
  }, [cart, globalDiscount, tax, cash, settings, method]);

  const buildLocalSale = (payload) => {
    const items = cart.map((x) => ({ product_id: x.product_id, product_name: x.name, unit: x.unit, qty: x.qty, price: x.price, discount: x.discount || 0, line_total: x.qty * x.price - (x.discount || 0) }));
    return {
      sale_no: `OFFLINE-${payload.client_id.slice(0, 8).toUpperCase()}`, created_at: payload.client_created_at, items,
      subtotal: totals.subtotal, global_discount: globalDiscount, tax_percent: totals.taxPct, tax: totals.taxVal,
      total: totals.total, cash_received: totals.paid, change: totals.change, payment_method: method, payment_ref: payRef, offline: true,
    };
  };

  const checkout = async () => {
    if (busy) return;
    if (!cart.length) { setMsg("Keranjang kosong"); return; }
    if (totals.paid < totals.total) { setMsg("Uang diterima kurang dari total"); return; }
    setBusy(true); setMsg("");
    const payload = {
      items: cart.map((x) => ({ product_id: x.product_id, name: x.name, unit: x.unit, qty: x.qty, price: x.price, cost_price: x.cost_price, discount: x.discount || 0 })),
      global_discount: globalDiscount, tax_percent: totals.taxPct, cash_received: totals.paid,
      payment_method: method, payment_ref: payRef, client_id: newClientId(), client_created_at: new Date().toISOString(),
    };
    try {
      setLastSale(await api.createSale(payload));
      resetCart(); loadCatalog();
    } catch (e) {
      if (isNetworkError(e)) {
        queueSale(payload);
        setLastSale(buildLocalSale(payload));
        const sold = Object.fromEntries(cart.map((x) => [x.product_id, x.qty]));
        saveProducts(products.map((p) => (sold[p.id] ? { ...p, stock: p.stock - sold[p.id] } : p)));
        resetCart(); setOfflineData(true);
      } else {
        setMsg(e?.response?.data?.detail || "Gagal menyimpan transaksi");
      }
    } finally {
      setBusy(false);
      barcodeRef.current?.focus();
    }
  };

  const anyBelowCost = cart.some((x) => x.price < x.cost_price);

  return (
    <div className="h-[calc(100vh-4rem)] grid grid-cols-5 gap-0" data-testid="page-kasir">
      <section className="col-span-3 flex flex-col border-r border-slate-200 bg-white min-h-0">
        <div className="p-4 space-y-3 border-b border-slate-200">
          {offlineData && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="pos-offline-banner">
              <WifiOff className="h-3.5 w-3.5" /> Mode offline: memakai data barang tersimpan. Penjualan disimpan di komputer ini dan dikirim otomatis saat internet kembali.
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input ref={barcodeRef} className="input pl-9 font-mono-num text-base" placeholder="Pindai barcode atau tekan Enter (F2)"
                value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={onBarcodeKey} data-testid="pos-barcode-input" />
            </div>
            <div className="relative w-72">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input className="input pl-9" placeholder="Cari nama/kode barang..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="pos-search-input" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button className={`pill ${!activeCat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`} onClick={() => setActiveCat("")} data-testid="pos-category-filter-all">Semua</button>
            {categories.map((c) => (
              <button key={c.id} className={`pill whitespace-nowrap ${activeCat === c.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                onClick={() => setActiveCat(c.id)} data-testid={`pos-category-filter-${c.id}`}>{c.name}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {visible.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">Tidak ada barang.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {visible.map((p) => {
                const out = p.stock <= 0;
                const low = p.stock <= p.min_stock;
                return (
                  <button key={p.id} disabled={out} onClick={() => addProductToCart(p)}
                    className="text-left card p-3 hover:border-emerald-300 hover:shadow-md transition-all disabled:opacity-50" data-testid={`pos-product-item-button-${p.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 line-clamp-2">{p.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono-num mt-0.5">{p.barcode || p.code}</div>
                      </div>
                      <span className={`pill ${out ? "bg-rose-100 text-rose-700" : low ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {out ? "Habis" : `${p.stock} ${p.unit}`}
                      </span>
                    </div>
                    <div className="mt-2 font-extrabold text-emerald-700 font-mono-num">{rupiah(p.sale_price)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="col-span-2 flex flex-col bg-slate-50 min-h-0">
        <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Keranjang ({cart.length})</h3>
          <button className="btn-ghost text-xs" onClick={resetCart} data-testid="pos-clear-cart-button"><Trash2 className="h-3.5 w-3.5" /> Bersihkan</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-10">Keranjang kosong. Pindai barcode atau pilih barang.</div>
          ) : cart.map((it) => {
            const below = it.price < it.cost_price;
            return (
              <div key={it.product_id} className="card p-3 space-y-2" data-testid={`pos-cart-item-row-${it.product_id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{it.name}</div>
                    <div className="text-[11px] text-slate-500">{it.stock} {it.unit} tersedia</div>
                  </div>
                  <button className="text-rose-500 hover:text-rose-700" onClick={() => removeItem(it.product_id)} data-testid={`pos-cart-delete-${it.product_id}`}><X className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-slate-500">Qty</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <button className="btn-ghost p-1" onClick={() => updateQty(it.product_id, it.qty - 1)}><Minus className="h-3 w-3" /></button>
                      <input type="number" className="input py-1 text-center font-mono-num" value={it.qty} onChange={(e) => updateQty(it.product_id, e.target.value)} data-testid={`pos-cart-qty-${it.product_id}`} />
                      <button className="btn-ghost p-1" onClick={() => updateQty(it.product_id, it.qty + 1)}><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-500">Harga</label>
                    <input className={`input py-1 mt-0.5 font-mono-num ${below ? "border-amber-400" : ""}`} value={it.price.toLocaleString("id-ID")}
                      onChange={(e) => patchItem(it.product_id, () => ({ price: parseRupiahInput(e.target.value) }))} data-testid={`pos-cart-price-${it.product_id}`} />
                  </div>
                  <div>
                    <label className="text-slate-500">Diskon</label>
                    <input className="input py-1 mt-0.5 font-mono-num" value={(it.discount || 0).toLocaleString("id-ID")}
                      onChange={(e) => patchItem(it.product_id, () => ({ discount: parseRupiahInput(e.target.value) }))} data-testid={`pos-cart-disc-${it.product_id}`} />
                  </div>
                </div>
                {below && <div className="text-[11px] text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Harga di bawah modal ({rupiah(it.cost_price)})</div>}
                <div className="text-right font-bold text-slate-900 font-mono-num">{rupiah(it.qty * it.price - (it.discount || 0))}</div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-mono-num font-semibold">{rupiah(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="text-slate-500">Diskon Global</span>
            <input className="input py-1 w-32 text-right font-mono-num" value={globalDiscount.toLocaleString("id-ID")} onChange={(e) => setGlobalDiscount(parseRupiahInput(e.target.value))} data-testid="pos-global-discount-input" />
          </div>
          {settings?.tax_percent > 0 && settings?.enable_tax && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-500">
                <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} data-testid="pos-tax-toggle" /> PPN {settings.tax_percent}%
              </label>
              <span className="font-mono-num">{rupiah(totals.taxVal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="font-bold text-slate-800">TOTAL</span>
            <span className="text-3xl font-black font-mono-num text-emerald-700" data-testid="pos-grand-total-amount">{rupiah(totals.total)}</span>
          </div>

          <PaymentPanel method={method} setMethod={setMethod} cash={cash} setCash={setCash} payRef={payRef} setPayRef={setPayRef}
            total={totals.total} change={totals.change} settings={settings} cashRef={cashRef} onEnter={checkout} />

          {msg && <div className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded" data-testid="pos-error-message">{msg}</div>}
          {anyBelowCost && settings && !settings.allow_sell_below_cost && (
            <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">Terdapat harga di bawah modal (dilarang oleh pengaturan).</div>
          )}

          <button className="btn-primary w-full py-3 text-base" disabled={busy || !cart.length} onClick={checkout} data-testid="pos-checkout-button">
            {busy ? "Memproses..." : "Bayar & Simpan (F9/Enter)"}
          </button>
        </div>
      </section>

      {lastSale && <Receipt sale={lastSale} settings={settings || {}} onClose={() => setLastSale(null)} />}
    </div>
  );
}
