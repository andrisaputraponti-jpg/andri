import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, parseRupiahInput, formatTanggalWaktu } from "@/lib/format";
import { Plus, Check, Trash2 } from "lucide-react";

export default function Pembelian() {
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);
  const [received, setReceived] = useState(true);

  const load = () => api.listPurchases().then(setList);
  useEffect(() => { load(); api.listProducts().then(setProducts); }, []);

  const addItem = () => setItems((prev) => [...prev, { product_id: "", qty: 1, cost_price: 0 }]);
  const upd = (i, k, v) => setItems((prev) => prev.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const rm = (i) => setItems((prev) => prev.filter((_, j) => j !== i));

  const total = items.reduce((s, x) => s + (parseInt(x.qty || 0, 10) * parseInt(x.cost_price || 0, 10)), 0);

  const submit = async () => {
    if (items.length === 0) return;
    try {
      await api.createPurchase({
        supplier_name: supplier, note,
        items: items.filter((x) => x.product_id).map((x) => ({ product_id: x.product_id, qty: parseInt(x.qty, 10), cost_price: parseInt(x.cost_price, 10) })),
        received,
      });
      setOpen(false); setSupplier(""); setNote(""); setItems([]); setReceived(true);
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Gagal"); }
  };

  const receive = async (p) => {
    if (!window.confirm(`Konfirmasi pembelian ${p.purchase_no} sebagai diterima dan tambahkan ke stok?`)) return;
    await api.receivePurchase(p.id); load();
  };
  const remove = async (p) => {
    if (!window.confirm(`Hapus pembelian ${p.purchase_no}?`)) return;
    try { await api.deletePurchase(p.id); load(); } catch (e) { alert(e?.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="page-pembelian">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Pembelian Barang</h1>
          <p className="text-sm text-slate-500">Catat pembelian dari pemasok. Stok bertambah saat barang diterima.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)} data-testid="purchase-add-button"><Plus className="h-4 w-4" /> Pembelian Baru</button>
      </div>

      <div className="card overflow-hidden">
        <table className="ktp-table">
          <thead><tr><th>No. Pembelian</th><th>Tanggal</th><th>Pemasok</th><th className="text-right">Total</th><th>Status</th><th>Catatan</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} data-testid={`purchase-row-${p.id}`}>
                <td className="font-mono-num font-semibold">{p.purchase_no}</td>
                <td className="text-xs font-mono-num">{formatTanggalWaktu(p.created_at)}</td>
                <td>{p.supplier_name || "-"}</td>
                <td className="text-right font-mono-num font-bold">{rupiah(p.total)}</td>
                <td>{p.status === "diterima" ? <span className="pill bg-emerald-100 text-emerald-800">Diterima</span> : <span className="pill bg-amber-100 text-amber-800">Menunggu</span>}</td>
                <td className="text-xs text-slate-500">{p.note}</td>
                <td className="text-right">
                  {p.status !== "diterima" && (
                    <>
                      <button className="btn-ghost p-1.5 text-emerald-700" onClick={() => receive(p)} data-testid={`purchase-confirm-${p.id}`}><Check className="h-4 w-4" /></button>
                      <button className="btn-ghost p-1.5 text-rose-600" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">Belum ada pembelian.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-3xl p-5 space-y-3">
            <h3 className="font-bold text-lg">Pembelian Baru</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">Nama Pemasok<input className="input mt-1" value={supplier} onChange={(e) => setSupplier(e.target.value)} data-testid="purchase-supplier" /></label>
              <label className="text-xs">Catatan<input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} /></label>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="ktp-table">
                <thead><tr><th>Barang</th><th className="text-right">Qty</th><th className="text-right">Harga Beli</th><th className="text-right">Subtotal</th><th></th></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td>
                        <select className="input py-1" value={it.product_id} onChange={(e) => upd(i, "product_id", e.target.value)} data-testid={`purchase-item-product-${i}`}>
                          <option value="">Pilih...</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="text-right"><input type="number" className="input py-1 w-20 text-right font-mono-num" value={it.qty} onChange={(e) => upd(i, "qty", e.target.value)} /></td>
                      <td className="text-right"><input className="input py-1 w-32 text-right font-mono-num" value={Number(it.cost_price).toLocaleString("id-ID")} onChange={(e) => upd(i, "cost_price", parseRupiahInput(e.target.value))} /></td>
                      <td className="text-right font-mono-num">{rupiah(parseInt(it.qty || 0, 10) * parseInt(it.cost_price || 0, 10))}</td>
                      <td><button className="btn-ghost p-1 text-rose-600" onClick={() => rm(i)}><Trash2 className="h-3 w-3" /></button></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="text-center">
                      <button className="btn-ghost" onClick={addItem} data-testid="purchase-add-item">+ Tambah Baris</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-2">
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} data-testid="purchase-received-toggle" /> Tandai sudah diterima (langsung tambah stok)</label>
              <div className="text-xl font-bold font-mono-num">{rupiah(total)}</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setOpen(false)}>Batal</button>
              <button className="btn-primary" onClick={submit} data-testid="purchase-form-save">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
