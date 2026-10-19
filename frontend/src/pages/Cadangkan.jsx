import React, { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Download, Upload, ShieldCheck } from "lucide-react";

export default function Cadangkan() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const doExport = async () => {
    setBusy(true); setMsg("");
    try {
      const data = await api.backupExport();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `cadangan-kasir-${stamp}.json`; a.click();
      URL.revokeObjectURL(url);
      setMsg("Cadangan berhasil diunduh. Simpan di tempat aman (flashdisk, cloud drive).");
    } catch (e) { setMsg("Gagal membuat cadangan."); }
    setBusy(false);
  };

  const doImport = async (file) => {
    if (!file) return;
    if (!window.confirm("Memulihkan akan MENGHAPUS semua data saat ini dan menggantinya dengan isi berkas cadangan. Lanjutkan?")) return;
    setBusy(true); setMsg("");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const r = await api.backupImport(payload);
      setMsg(`Pemulihan berhasil. Produk: ${r.restored.products || 0}, Penjualan: ${r.restored.sales || 0}.`);
    } catch (e) { setMsg("Gagal memulihkan: berkas tidak valid."); }
    setBusy(false);
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl" data-testid="page-cadangkan">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Cadangkan Data</h1>
        <p className="text-sm text-slate-500">Cadangkan seluruh database (barang, transaksi, pengaturan) ke berkas JSON yang dapat dipulihkan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Download className="h-4 w-4" /> Buat Cadangan</h3>
          <p className="text-sm text-slate-600">Unduh salinan database saat ini. Simpan beberapa versi di flashdisk atau cloud agar aman.</p>
          <button className="btn-primary w-full" onClick={doExport} disabled={busy} data-testid="backup-export-json-button">Unduh Cadangan JSON</button>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Upload className="h-4 w-4" /> Pulihkan Cadangan</h3>
          <p className="text-sm text-slate-600">Pilih berkas cadangan JSON untuk memulihkan data. Perhatian: data saat ini akan tergantikan.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} data-testid="backup-import-input" />
          <button className="btn-secondary w-full" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="backup-import-json-button">Pilih Berkas Cadangan</button>
        </div>
      </div>

      <div className="card p-4 border-emerald-200 bg-emerald-50/50">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800">
            <div className="font-bold">Saran Keamanan</div>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>Simpan cadangan di dua tempat berbeda (contoh: komputer + flashdisk).</li>
              <li>Lakukan cadangan harian setelah toko tutup.</li>
              <li>Beri nama berkas sesuai tanggal untuk memudahkan penelusuran.</li>
              <li>Lindungi komputer dari akses tidak sah dengan password sistem.</li>
            </ul>
          </div>
        </div>
      </div>

      {msg && <div className="card p-3 text-sm text-slate-700">{msg}</div>}
    </div>
  );
}
