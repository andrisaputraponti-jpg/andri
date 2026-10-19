import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function Kategori() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const load = () => api.listCategories().then(setItems);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return;
    if (editing === "new") await api.createCategory(form);
    else await api.updateCategory(editing, form);
    setEditing(null); load();
  };
  const remove = async (c) => {
    if (!window.confirm(`Hapus kategori "${c.name}"?`)) return;
    try { await api.deleteCategory(c.id); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Gagal menghapus"); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="page-kategori">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Kategori Barang</h1>
          <p className="text-sm text-slate-500">Kelompokkan barang untuk memudahkan pencarian & laporan.</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ name: "", description: "" }); setEditing("new"); }} data-testid="category-add-new-button"><Plus className="h-4 w-4" /> Tambah Kategori</button>
      </div>

      <div className="card overflow-hidden">
        <table className="ktp-table">
          <thead><tr><th>Nama Kategori</th><th>Keterangan</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} data-testid={`category-row-${c.id}`}>
                <td className="font-semibold">{c.name}</td>
                <td className="text-slate-500 text-xs">{c.description || "-"}</td>
                <td className="text-right">
                  <button className="btn-ghost p-1.5" onClick={() => { setForm({ name: c.name, description: c.description || "" }); setEditing(c.id); }}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-ghost p-1.5 text-rose-600" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} className="text-center text-slate-500 py-8">Belum ada kategori.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-5 space-y-3">
            <h3 className="font-bold text-lg">{editing === "new" ? "Tambah Kategori" : "Ubah Kategori"}</h3>
            <label className="text-xs block">Nama<input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="category-form-name" /></label>
            <label className="text-xs block">Keterangan<input className="input mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="category-form-desc" /></label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>Batal</button>
              <button className="btn-primary" onClick={save} data-testid="category-form-save">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
