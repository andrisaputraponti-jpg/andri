import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Save } from "lucide-react";

const Field = ({ label, children }) => (
  <label className="text-xs block"><span className="font-semibold text-slate-700">{label}</span>{children}</label>
);

export default function Pengaturan() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.getSettings().then(setS); }, []);
  if (!s) return <div className="p-6 text-slate-500">Memuat...</div>;

  const onQris = (file) => {
    if (!file) return;
    if (file.size > 1024 * 1024) { setMsg("Ukuran gambar QRIS maksimal 1 MB."); return; }
    const r = new FileReader();
    r.onload = () => setS((prev) => ({ ...prev, qris_image: r.result }));
    r.readAsDataURL(file);
  };

  const save = async () => {
    const upd = await api.updateSettings(s);
    setS(upd); setMsg("Pengaturan disimpan.");
    window.dispatchEvent(new Event("settings-updated"));
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl" data-testid="page-pengaturan">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Pengaturan</h1>
        <p className="text-sm text-slate-500">Identitas toko, printer, dan aturan transaksi.</p>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-slate-800">Identitas Toko</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama Toko"><input className="input mt-1" value={s.store_name} onChange={(e) => setS({ ...s, store_name: e.target.value })} data-testid="settings-store-name" /></Field>
          <Field label="Telepon"><input className="input mt-1" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} data-testid="settings-phone" /></Field>
          <Field label="Alamat"><input className="input mt-1" value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} data-testid="settings-address" /></Field>
          <Field label="Pesan Penutup Struk"><input className="input mt-1" value={s.receipt_footer} onChange={(e) => setS({ ...s, receipt_footer: e.target.value })} data-testid="settings-footer" /></Field>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-slate-800">Printer & Struk</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama Printer (Windows)"><input className="input mt-1" value={s.printer_name} onChange={(e) => setS({ ...s, printer_name: e.target.value })} placeholder="contoh: EPSON TM-T82" data-testid="settings-printer-name" /></Field>
          <Field label="Ukuran Kertas">
            <select className="input mt-1" value={s.paper_size} onChange={(e) => setS({ ...s, paper_size: e.target.value })} data-testid="settings-paper-size">
              <option value="58mm">58 mm (thermal kecil)</option>
              <option value="80mm">80 mm (thermal besar)</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-500">Pilih "Cetak via dialog" untuk kompatibilitas umum. Untuk perintah ESC/POS mentah, gunakan tombol "Unduh ESC/POS" pada dialog struk.</p>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-slate-800">Pembayaran Non-Tunai</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Gambar QRIS Toko">
            <div className="mt-1 flex items-start gap-3">
              {s.qris_image ? <img src={s.qris_image} alt="QRIS" className="h-24 w-24 object-contain border rounded" data-testid="settings-qris-preview" /> : <div className="h-24 w-24 border border-dashed rounded flex items-center justify-center text-slate-400 text-[10px] text-center">Belum ada</div>}
              <div className="space-y-1">
                <input type="file" accept="image/*" onChange={(e) => onQris(e.target.files?.[0])} className="text-xs" data-testid="settings-qris-upload" />
                {s.qris_image && <button className="btn-ghost text-xs text-rose-600 px-0" onClick={() => setS({ ...s, qris_image: "" })}>Hapus gambar</button>}
              </div>
            </div>
          </Field>
          <Field label="Info Rekening Transfer"><textarea rows={4} className="input mt-1" value={s.bank_info} onChange={(e) => setS({ ...s, bank_info: e.target.value })} placeholder={"BCA 1234567890\na.n. Toko Serba Ada"} data-testid="settings-bank-info" /></Field>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-slate-800">Aturan Transaksi</h3>
        <div className="grid grid-cols-1 gap-3">
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={s.allow_sell_below_cost} onChange={(e) => setS({ ...s, allow_sell_below_cost: e.target.checked })} data-testid="settings-allow-below-cost" /> Izinkan menjual di bawah harga modal</label>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={s.enable_tax} onChange={(e) => setS({ ...s, enable_tax: e.target.checked })} data-testid="settings-enable-tax" /> Aktifkan PPN</label>
          <Field label="Persentase PPN (%)"><input type="number" className="input mt-1 w-32 font-mono-num" value={s.tax_percent} onChange={(e) => setS({ ...s, tax_percent: parseInt(e.target.value || 0, 10) })} data-testid="settings-tax-percent" /></Field>
          <Field label="Batas Stok Rendah Default"><input type="number" className="input mt-1 w-32 font-mono-num" value={s.low_stock_global} onChange={(e) => setS({ ...s, low_stock_global: parseInt(e.target.value || 0, 10) })} data-testid="settings-low-stock" /></Field>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        <button className="btn-primary" onClick={save} data-testid="settings-save-button"><Save className="h-4 w-4" /> Simpan Pengaturan</button>
      </div>
    </div>
  );
}
