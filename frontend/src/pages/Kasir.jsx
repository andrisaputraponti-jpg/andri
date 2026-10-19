import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { rupiah, parseRupiahInput } from "@/lib/format";
import { Search, Trash2, Plus, Minus, X, AlertTriangle } from "lucide-react";
import Receipt from "@/components/Receipt";

const QUICK_CASH = [0, 10000, 20000, 50000, 100000, 200000];

export default function Kasir() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("");
  const [q, setQ] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]); // {product_id, name, unit, qty, price, cost_price, discount, stock}
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [cash, setCash] = useState(0);
  const [settings, setSettings] = useState(null);
  const [tax, setTax] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const barcodeRef = useRef(null);
  const cashRef = useRef(null);

  const refreshProducts = useCallback(() => {
    api.listProducts({ active_only: true, category_id: activeCat || undefined, q: q || undefined })
      .then(setProducts);
  }, [activeCat, q]);

  useEffect(() => {
    api.listCategories().then(setCategories);
    api.getSettings().then((s) => { setSettings(s); setTax(!!s.enable_tax && !!s.tax_percent); });
  }, []);
  useEffect(() => { refreshProducts(); }, [refreshProducts]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F2") { e.preventDefault(); barcodeRef.current?.focus(); }
      if (e.key === "F4") { e.preventDefault(); setCart([]); setGlobalDiscount(0); setCash(0); }
      if (e.key === "F9") { e.preventDefault(); cashRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus barcode on mount
  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const addProductToCart = (p) => {
    if (!p) return;
    if (p.stock <= 0) { setMsg(`Stok ${p.name} habis`); return; }
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.product_id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        if (copy[idx].qty + 1 > p.stock) { setMsg(`Stok ${p.name} tidak cukup`); return copy; }
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, {
        product_id: p.id, name: p.name, unit: p.unit, qty: 1,
        price: p.sale_price, cost_price: p.cost_price, discount: 0, stock: p.stock,
      }];
    });
    setMsg("");
  };

  const onBarcodeKey = async (e) => {
    if (e.key !== "Enter") return;
    const code = barcode.trim();
    if (!code) return;
    try {
      const p = await api.productByBarcode(code);
      addProductToCart(p);
      setBarcode("");
    } catch {
      // fallback to search
      const matches = await api.listProducts({ q: code, active_only: true });
      if (matches.length === 1) {
        addProductToCart(matches[0]);
        setBarcode("");
      } else {
        setMsg(`Barcode "${code}" tidak terdaftar. Cari manual atau daftarkan dulu.`);
      }
    }
    barcodeRef.current?.focus();
  };

  const updateQty = (pid, qty) => {
    setCart((prev) => prev.map((x) => {
      if (x.product_id !== pid) return x;
      const q2 = Math.max(1, Math.min(x.stock, parseInt(qty || "1", 10)));
      return { ...x, qty: q2 };
    }));
  };
  const updatePrice = (pid, price) => {
    setCart((prev) => prev.map((x) => x.product_id === pid ? { ...x, price: parseRupiahInput(price) } : x));
  };
  const updateDisc = (pid, d) => {
    setCart((prev) => prev.map((x) => x.product_id === pid ? { ...x, discount: parseRupiahInput(d) } : x));
  };
  const removeItem = (pid) => setCart((prev) => prev.filter((x) => x.product_id !== pid));

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, x) => s + x.qty * x.price - (x.discount || 0), 0);
    const afterDisc = Math.max(0, subtotal - globalDiscount);
    const taxPct = tax && settings?.tax_percent ? settings.tax_percent : 0;
    const taxVal = taxPct ? Math.floor((afterDisc * taxPct) / 100) : 0;
    const total = afterDisc + taxVal;
    const change = Math.max(0, cash - total);
    return { subtotal, afterDisc, taxPct, taxVal, total, change };
  }, [cart, globalDiscount, tax, cash, settings]);

  const anyBelowCost = cart.some((x) => x.price < x.cost_price);

  const checkout = async () => {
    if (busy) return;
    if (!cart.length) { setMsg("Keranjang kosong"); return; }
    if (cash < totals.total) { setMsg("Uang diterima kurang dari total"); return; }
    setBusy(true); setMsg("");
    try {
      const sale = await api.createSale({
        items: cart.map((x) => ({
          product_id: x.product_id, name: x.name, unit: x.unit,
          qty: x.qty, price: x.price, cost_price: x.cost_price, discount: x.discount || 0,
        })),
        global_discount: globalDiscount,
        tax_percent: totals.taxPct,
        cash_received: cash,
      });
      setLastSale(sale);
      setCart([]); setGlobalDiscount(0); setCash(0); setBarcode("");
      refreshProducts();
    } catch (e) {
      setMsg(e?.response?.data?.detail || "Gagal menyimpan transaksi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] grid grid-cols-5 gap-0" data-testid="page-kasir">
      {/* LEFT: catalog */}
      <section className="col-span-3 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-4 space-y-3 border-b border-slate-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input
                ref={barcodeRef}
                className="input pl-9 font-mono-num text-base"
                placeholder="Pindai barcode atau tekan Enter (F2)"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={onBarcodeKey}
                data-testid="pos-barcode-input"
              />
            </div>
            <div className="relative w-72">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Cari nama/kode barang..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="pos-search-input"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              className={`pill ${!activeCat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              onClick={() => setActiveCat("")}
              data-testid="pos-category-filter-all"
            >Semua</button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`pill whitespace-nowrap ${activeCat === c.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                onClick={() => setActiveCat(c.id)}
                data-testid={`pos-category-filter-${c.id}`}
              >{c.name}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {products.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">Tidak ada barang.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => {
                const low = p.stock <= p.min_stock;
                const out = p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    disabled={out}
                    onClick={() => addProductToCart(p)}
                    className="text-left card p-3 hover:border-emerald-300 hover:shadow-md transition-all disabled:opacity-50"
                    data-testid={`pos-product-item-button-${p.id}`}
                  >
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

      {/* RIGHT: cart */}
      <section className="col-span-2 flex flex-col bg-slate-50">
        <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Keranjang ({cart.length})</h3>
          <button className="btn-ghost text-xs" onClick={() => setCart([])} data-testid="pos-clear-cart-button">
            <Trash2 className="h-3.5 w-3.5" /> Bersihkan
          </button>
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
                  <button className="text-rose-500 hover:text-rose-700" onClick={() => removeItem(it.product_id)} data-testid={`pos-cart-delete-${it.product_id}`}>
                    <X className="h-4 w-4" />
                  </button>
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
                    <input className={`input py-1 mt-0.5 font-mono-num ${below ? "border-amber-400" : ""}`} value={it.price.toLocaleString("id-ID")} onChange={(e) => updatePrice(it.product_id, e.target.value)} data-testid={`pos-cart-price-${it.product_id}`} />
                  </div>
                  <div>
                    <label className="text-slate-500">Diskon</label>
                    <input className="input py-1 mt-0.5 font-mono-num" value={(it.discount || 0).toLocaleString("id-ID")} onChange={(e) => updateDisc(it.product_id, e.target.value)} data-testid={`pos-cart-disc-${it.product_id}`} />
                  </div>
                </div>
                {below && (
                  <div className="text-[11px] text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Harga di bawah modal ({rupiah(it.cost_price)})
                  </div>
                )}
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
          {settings?.tax_percent > 0 && (
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

          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-sm text-slate-500">Uang Diterima</span>
            <input ref={cashRef} className="input py-2 w-40 text-right font-mono-num text-base" value={cash.toLocaleString("id-ID")} onChange={(e) => setCash(parseRupiahInput(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") checkout(); }} data-testid="pos-cash-input" />
          </div>
          <div className="grid grid-cols-6 gap-1">
            {QUICK_CASH.map((v, i) => (
              <button key={i} onClick={() => setCash(v === 0 ? totals.total : v)} className="btn-secondary text-[11px] py-1 px-1 whitespace-nowrap" data-testid={`pos-quick-cash-${v}`}>
                {v === 0 ? "Uang Pas" : `${v / 1000}rb`}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-sm text-slate-500">Kembalian</span>
            <span className="text-xl font-bold font-mono-num text-emerald-700" data-testid="pos-change-amount">{rupiah(totals.change)}</span>
          </div>

          {msg && <div className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded">{msg}</div>}
          {anyBelowCost && !settings?.allow_sell_below_cost && (
            <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">Terdapat harga di bawah modal (dilarang oleh pengaturan).</div>
          )}

          <button
            className="btn-primary w-full py-3 text-base"
            disabled={busy || !cart.length}
            onClick={checkout}
            data-testid="pos-checkout-button"
          >
            {busy ? "Memproses..." : "Bayar & Simpan (F9/Enter)"}
          </button>
        </div>
      </section>

      {lastSale && settings && (
        <Receipt sale={lastSale} settings={settings} onClose={() => setLastSale(null)} />
      )}
    </div>
  );
}
