import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, parseRupiahInput } from "@/lib/format";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

const empty = { code: "", barcode: "", name: "", category_id: "", unit: "Pcs", cost_price: 0, sale_price: 0, stock: 0, min_stock: 5, active: true };

export default function Barang() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => api.listProducts({ q }).then(setItems);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);
  useEffect(() => { api.listCategories().then(setCats); }, []);

  const openNew = () => { setForm(empty); setEditing("new"); };
  const openEdit = (p) => { setForm({ ...p }); setEditing(p.id); };

  const save = async () => {
    const payload = {
      ...form,
      cost_price: parseInt(form.cost_price || 0, 10),
      sale_price: parseInt(form.sale_price || 0, 10),
      stock: parseInt(form.stock || 0, 10),
      min_stock: parseInt(form.min_stock || 0, 10),
    };
    if (editing === "new") await api.createProduct(payload);
    else await api.updateProduct(editing, payload);
    setEditing(null); load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Hapus barang "${p.name}"?`)) return;
    try {
      const r = await api.deleteProduct(p.id);
      if (r.soft) alert("Barang memiliki riwayat penjualan, dinonaktifkan saja.");
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Gagal menghapus"); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="page-barang">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Daftar Barang</h1>
          <p className="text-sm text-slate-500">Kelola semua produk yang dijual di toko Anda.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input className="input pl-9 w-72" placeholder="Cari nama/kode/barcode..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="product-search-input" />
          </div>
          <button className="btn-primary" onClick={openNew} data-testid="product-add-new-button"><Plus className="h-4 w-4" /> Tambah Barang</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="ktp-table">
          <thead>
            <tr>
              <th>Kode</th><th>Nama</th><th>Barcode</th><th>Kategori</th>
              <th className="text-right">Modal</th><th className="text-right">Harga Jual</th>
              <th className="text-right">Stok</th><th>Status</th><th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} data-testid={`product-table-row-${p.id}`}>
                <td className="font-mono-num text-xs">{p.code}</td>
                <td className="font-semibold">{p.name}</td>
                <td className="font-mono-num text-xs text-slate-500">{p.barcode || "-"}</td>
                <td className="text-xs">{p.category_name || "-"}</td>
                <td className="text-right font-mono-num">{rupiah(p.cost_price)}</td>
                <td className="text-right font-mono-num font-bold text-emerald-700">{rupiah(p.sale_price)}</td>
                <td className="text-right font-mono-num">
                  <span className={p.stock <= p.min_stock ? "text-amber-700 font-bold" : ""}>{p.stock} {p.unit}</span>
                </td>
                <td>{p.active ? <span className="pill bg-emerald-100 text-emerald-800">Aktif</span> : <span className="pill bg-slate-200 text-slate-600">Nonaktif</span>}</td>
                <td className="text-right">
                  <button className="btn-ghost p-1.5" onClick={() => openEdit(p)} data-testid={`product-edit-${p.id}`}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-ghost p-1.5 text-rose-600" onClick={() => remove(p)} data-testid={`product-delete-${p.id}`}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={9} className="text-center text-slate-500 py-8">Belum ada barang.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-xl p-5 space-y-3">
            <h3 className="font-bold text-lg">{editing === "new" ? "Tambah Barang" : "Ubah Barang"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">Nama Barang<input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-form-name" /></label>
              <label className="text-xs">Kode<input className="input mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="product-form-code" placeholder="Otomatis bila kosong" /></label>
              <label className="text-xs">Barcode<input className="input mt-1 font-mono-num" value={form.barcode || ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} data-testid="product-form-barcode" /></label>
              <label className="text-xs">Satuan<input className="input mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} data-testid="product-form-unit" /></label>
              <label className="text-xs col-span-2">Kategori
                <select className="input mt-1" value={form.category_id || ""} onChange={(e) => setForm({ ...form, category_id: e.target.value })} data-testid="product-form-category">
                  <option value="">(Tanpa kategori)</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-xs">Harga Modal (Rp)<input className="input mt-1 font-mono-num" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: parseRupiahInput(e.target.value) })} data-testid="product-form-cost" /></label>
              <label className="text-xs">Harga Jual (Rp)<input className="input mt-1 font-mono-num" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: parseRupiahInput(e.target.value) })} data-testid="product-form-sale" /></label>
              <label className="text-xs">Stok<input type="number" className="input mt-1 font-mono-num" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="product-form-stock" /></label>
              <label className="text-xs">Stok Minimum<input type="number" className="input mt-1 font-mono-num" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} data-testid="product-form-min" /></label>
              <label className="text-xs col-span-2 flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktif</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>Batal</button>
              <button className="btn-primary" onClick={save} data-testid="product-form-save" disabled={!form.name}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
