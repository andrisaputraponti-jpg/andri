import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, formatTanggalWaktu, todayIso } from "@/lib/format";
import Receipt from "@/components/Receipt";
import { Eye } from "lucide-react";

export default function Riwayat() {
  const [list, setList] = useState([]);
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [settings, setSettings] = useState(null);
  const [sel, setSel] = useState(null);

  const load = () => {
    const sIso = new Date(start + "T00:00:00").toISOString();
    const eIso = new Date(end + "T23:59:59").toISOString();
    api.listSales({ start: sIso, end: eIso }).then(setList);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);
  useEffect(() => { api.getSettings().then(setSettings); }, []);

  const openDetail = async (s) => {
    const full = await api.getSale(s.id);
    setSel(full);
  };

  return (
    <div className="p-6 space-y-4" data-testid="page-riwayat">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Riwayat Penjualan</h1>
          <p className="text-sm text-slate-500">Daftar semua transaksi penjualan.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Dari</label>
          <input type="date" className="input w-40" value={start} onChange={(e) => setStart(e.target.value)} data-testid="riwayat-start" />
          <label className="text-xs text-slate-500">Sampai</label>
          <input type="date" className="input w-40" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="riwayat-end" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="ktp-table">
          <thead><tr><th>No. Transaksi</th><th>Waktu</th><th className="text-right">Item</th><th className="text-right">Total</th><th className="text-right">Laba Kotor</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} data-testid={`sale-row-${s.id}`}>
                <td className="font-mono-num font-bold">{s.sale_no}</td>
                <td className="text-xs font-mono-num">{formatTanggalWaktu(s.created_at)}</td>
                <td className="text-right font-mono-num">{s.items_count}</td>
                <td className="text-right font-mono-num font-bold text-emerald-700">{rupiah(s.total)}</td>
                <td className="text-right font-mono-num text-slate-600">{rupiah(s.gross_profit)}</td>
                <td className="text-right"><button className="btn-ghost p-1.5" onClick={() => openDetail(s)} data-testid={`sale-view-${s.id}`}><Eye className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-8">Belum ada transaksi pada rentang ini.</td></tr>}
          </tbody>
        </table>
      </div>

      {sel && settings && <Receipt sale={sel} settings={settings} onClose={() => setSel(null)} />}
    </div>
  );
}
