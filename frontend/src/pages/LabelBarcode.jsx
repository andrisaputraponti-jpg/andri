import React, { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { Printer, Wand2, Search } from "lucide-react";

const SIZES = {
  "38x25": { w: 38, h: 25, bar: 22, label: "38 × 25 mm" },
  "50x30": { w: 50, h: 30, bar: 28, label: "50 × 30 mm" },
  "60x40": { w: 60, h: 40, bar: 40, label: "60 × 40 mm" },
};

function BarcodeSvg({ value, heightMm }) {
  const ref = useRef(null);
  useEffect(() => {
    const opts = { height: heightMm * 3, fontSize: 11, margin: 0, width: 1.3, displayValue: true };
    try { JsBarcode(ref.current, value, { ...opts, format: /^\d{13}$/.test(value) ? "EAN13" : "CODE128" }); }
    catch { JsBarcode(ref.current, value, { ...opts, format: "CODE128" }); }
  }, [value, heightMm]);
  return <svg ref={ref} style={{ maxWidth: "100%", height: `${heightMm * 0.55}mm` }} />;
}

const Label = ({ p, size, showName, showPrice }) => (
  <div className="label-sticker flex flex-col items-center justify-center overflow-hidden bg-white text-black border border-dashed border-slate-300 print:border-0"
    style={{ width: `${size.w}mm`, height: `${size.h}mm`, padding: "1.5mm" }}>
    {showName && <div className="text-[8px] font-bold leading-tight text-center truncate w-full">{p.name}</div>}
    <BarcodeSvg value={p.barcode} heightMm={size.bar} />
    {showPrice && <div className="text-[10px] font-bold leading-none">{rupiah(p.sale_price)}</div>}
  </div>
);

export default function LabelBarcode() {
  const [products, setProducts] = useState([]);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [q, setQ] = useState("");
  const [qty, setQty] = useState({});
  const [sizeKey, setSizeKey] = useState("38x25");
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api.listProducts({ active_only: true }).then(setProducts);
  useEffect(() => { load(); }, []);

  const list = useMemo(() => products.filter((p) => (!onlyMissing || !p.barcode) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))), [products, onlyMissing, q]);
  const missing = products.filter((p) => !p.barcode);

  const generate = async (ids) => {
    setBusy(true); setMsg("");
    for (const id of ids) {
      try { await api.generateBarcode(id); } catch (e) { setMsg(e?.response?.data?.detail || "Gagal membuat barcode"); }
    }
    await load();
    setQty((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, prev[id] || 1])) }));
    setBusy(false);
  };

  const labels = products.filter((p) => p.barcode && qty[p.id] > 0).flatMap((p) => Array.from({ length: qty[p.id] }, (_, i) => ({ p, key: `${p.id}-${i}` })));
  const size = SIZES[sizeKey];

  return (
    <div className="p-6 space-y-4" data-testid="page-label">
      <style>{`@media print { @page { size: auto; margin: 4mm; } .print-area.labels { width: auto !important; padding: 0 !important; } }`}</style>
      <div className="flex items-end justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Label Barcode</h1>
          <p className="text-sm text-slate-500">Buat barcode untuk barang yang belum punya, lalu cetak stiker label.</p>
        </div>
        <button className="btn-secondary" disabled={busy || missing.length === 0} onClick={() => generate(missing.map((p) => p.id))} data-testid="label-generate-all-button">
          <Wand2 className="h-4 w-4" /> Buat barcode untuk {missing.length} barang
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 no-print">
        <div className="card overflow-hidden xl:col-span-3">
          <div className="p-3 border-b border-slate-200 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input className="input pl-9" placeholder="Cari barang..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="label-search-input" />
            </div>
            <label className="text-xs flex items-center gap-2 whitespace-nowrap">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} data-testid="label-only-missing" /> Hanya tanpa barcode
            </label>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="ktp-table">
              <thead><tr><th>Barang</th><th>Barcode</th><th className="text-right">Jumlah Label</th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} data-testid={`label-row-${p.id}`}>
                    <td className="font-semibold">{p.name}<div className="text-[11px] text-slate-500 font-normal">{rupiah(p.sale_price)}</div></td>
                    <td className="font-mono-num text-xs">
                      {p.barcode || (
                        <button className="btn-ghost text-xs text-emerald-700 px-2 py-1" disabled={busy} onClick={() => generate([p.id])} data-testid={`label-generate-${p.id}`}>
                          <Wand2 className="h-3.5 w-3.5" /> Buat barcode
                        </button>
                      )}
                    </td>
                    <td className="text-right">
                      <input type="number" min={0} disabled={!p.barcode} className="input py-1 w-20 text-right font-mono-num" value={qty[p.id] || 0}
                        onChange={(e) => setQty({ ...qty, [p.id]: Math.max(0, parseInt(e.target.value || "0", 10)) })} data-testid={`label-qty-${p.id}`} />
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={3} className="text-center text-slate-500 py-8">Tidak ada barang.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5 space-y-3 xl:col-span-2 h-fit">
          <h3 className="font-bold text-slate-800">Pengaturan Label</h3>
          <label className="text-xs block">Ukuran stiker
            <select className="input mt-1" value={sizeKey} onChange={(e) => setSizeKey(e.target.value)} data-testid="label-size-select">
              {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} data-testid="label-show-name" /> Tampilkan nama barang</label>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} data-testid="label-show-price" /> Tampilkan harga</label>
          <div className="text-sm text-slate-600" data-testid="label-total-count">Total: <b>{labels.length}</b> label</div>
          {msg && <div className="text-xs text-rose-600">{msg}</div>}
          <button className="btn-primary w-full" disabled={labels.length === 0} onClick={() => window.print()} data-testid="label-print-button">
            <Printer className="h-4 w-4" /> Cetak Label
          </button>
          <p className="text-[11px] text-slate-500">Barcode buatan toko memakai awalan 20 (khusus internal), jadi tidak bentrok dengan barcode pabrik.</p>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-slate-800 mb-3 no-print">Pratinjau</h3>
          <div className="print-area labels flex flex-wrap gap-[2mm]" data-testid="label-preview">
            {labels.map(({ p, key }) => <Label key={key} p={p} size={size} showName={showName} showPrice={showPrice} />)}
          </div>
        </div>
      )}
    </div>
  );
}
