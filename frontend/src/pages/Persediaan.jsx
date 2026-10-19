import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatTanggalWaktu } from "@/lib/format";

const REASONS = [
  { v: "penyesuaian", l: "Penyesuaian" },
  { v: "rusak", l: "Barang Rusak" },
  { v: "hilang", l: "Barang Hilang" },
  { v: "penghitungan", l: "Hasil Penghitungan Fisik" },
  { v: "retur", l: "Retur / Pengembalian" },
];

export default function Persediaan() {
  const [products, setProducts] = useState([]);
  const [moves, setMoves] = useState([]);
  const [sel, setSel] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("penyesuaian");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    api.listProducts().then(setProducts);
    api.listMovements({ limit: 100 }).then(setMoves);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!sel || !delta) { setMsg("Pilih barang dan isi perubahan stok"); return; }
    try {
      await api.adjustStock({ product_id: sel, qty_delta: parseInt(delta, 10), reason, note });
      setMsg("Berhasil disimpan"); setDelta(0); setNote(""); load();
    } catch (e) { setMsg(e?.response?.data?.detail || "Gagal"); }
  };

  const lowStock = products.filter((p) => p.stock <= p.min_stock && p.active);

  return (
    <div className="p-6 space-y-4" data-testid="page-persediaan">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Persediaan Barang</h1>
        <p className="text-sm text-slate-500">Pantau stok, catat penyesuaian, dan lihat riwayat pergerakan stok.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 space-y-3 lg:col-span-1">
          <h3 className="font-bold text-slate-800">Penyesuaian Stok</h3>
          <label className="text-xs block">Barang
            <select className="input mt-1" value={sel} onChange={(e) => setSel(e.target.value)} data-testid="stock-adjust-product">
              <option value="">Pilih barang...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stok: {p.stock})</option>)}
            </select>
          </label>
          <label className="text-xs block">Perubahan (+ masuk / − keluar)
            <input type="number" className="input mt-1 font-mono-num" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="contoh: -2" data-testid="stock-adjust-delta" />
          </label>
          <label className="text-xs block">Alasan
            <select className="input mt-1" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="stock-adjust-reason">
              {REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </label>
          <label className="text-xs block">Catatan
            <input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} data-testid="stock-adjust-note" />
          </label>
          {msg && <div className="text-xs text-slate-600">{msg}</div>}
          <button className="btn-primary w-full" onClick={submit} data-testid="stock-adjustment-button">Simpan Penyesuaian</button>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-3">Stok Menipis ({lowStock.length})</h3>
          <div className="max-h-72 overflow-y-auto">
            <table className="ktp-table">
              <thead><tr><th>Nama</th><th>Kategori</th><th className="text-right">Stok</th><th className="text-right">Min</th></tr></thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.name}</td>
                    <td className="text-xs">{p.category_name || "-"}</td>
                    <td className="text-right font-mono-num font-bold text-amber-700">{p.stock} {p.unit}</td>
                    <td className="text-right font-mono-num">{p.min_stock}</td>
                  </tr>
                ))}
                {lowStock.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500 py-6">Semua stok aman.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200"><h3 className="font-bold text-slate-800">Riwayat Pergerakan Stok</h3></div>
        <table className="ktp-table">
          <thead><tr><th>Waktu</th><th>Barang</th><th>Alasan</th><th className="text-right">Perubahan</th><th>Catatan</th></tr></thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id}>
                <td className="text-xs font-mono-num">{formatTanggalWaktu(m.created_at)}</td>
                <td className="font-semibold">{m.product_name}</td>
                <td className="text-xs">{m.reason}</td>
                <td className={`text-right font-mono-num font-bold ${m.qty_delta > 0 ? "text-emerald-700" : "text-rose-600"}`}>{m.qty_delta > 0 ? "+" : ""}{m.qty_delta} {m.unit}</td>
                <td className="text-xs text-slate-500">{m.note}</td>
              </tr>
            ))}
            {moves.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-6">Belum ada pergerakan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
