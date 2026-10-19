import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, todayIso, formatTanggalWaktu, PAYMENT_LABELS } from "@/lib/format";
import { Download } from "lucide-react";

export default function Laporan() {
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [data, setData] = useState(null);

  const load = () => api.reportSales({ start_date: start, end_date: end }).then(setData);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  const quick = (type) => {
    const now = new Date();
    const start_ = new Date(now);
    if (type === "today") { /* keep */ }
    else if (type === "week") start_.setDate(now.getDate() - 6);
    else if (type === "month") start_.setDate(1);
    const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setStart(toIso(start_)); setEnd(toIso(now));
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = [["No Transaksi", "Waktu", "Metode", "Subtotal", "Diskon", "PPN", "Total", "Laba Kotor"]];
    data.sales.forEach((s) => rows.push([s.sale_no, formatTanggalWaktu(s.created_at), PAYMENT_LABELS[s.payment_method || "tunai"], s.subtotal, s.global_discount, s.tax, s.total, s.gross_profit]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `laporan-penjualan-${start}-${end}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4" data-testid="page-laporan">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="shrink-0">
          <h1 className="text-2xl font-extrabold text-slate-900">Laporan</h1>
          <p className="text-sm text-slate-500">Omzet, laba kotor, dan analisis penjualan berdasarkan periode.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-secondary text-xs" onClick={() => quick("today")} data-testid="report-period-today">Hari Ini</button>
          <button className="btn-secondary text-xs" onClick={() => quick("week")} data-testid="report-period-week">7 Hari</button>
          <button className="btn-secondary text-xs" onClick={() => quick("month")} data-testid="report-period-month">Bulan Ini</button>
          <input type="date" className="input w-40" value={start} onChange={(e) => setStart(e.target.value)} data-testid="report-start" />
          <input type="date" className="input w-40" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="report-end" />
          <button className="btn-primary" onClick={exportCsv} data-testid="report-export-csv-button"><Download className="h-4 w-4" /> Ekspor CSV</button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card p-4"><div className="text-[11px] uppercase text-slate-500 font-bold">Omzet</div><div className="text-xl font-extrabold font-mono-num text-emerald-700" data-testid="report-omzet">{rupiah(data.totals.omzet)}</div></div>
            <div className="card p-4"><div className="text-[11px] uppercase text-slate-500 font-bold">Transaksi</div><div className="text-xl font-extrabold font-mono-num">{data.totals.transactions}</div></div>
            <div className="card p-4"><div className="text-[11px] uppercase text-slate-500 font-bold">Laba Kotor</div><div className="text-xl font-extrabold font-mono-num text-emerald-700">{rupiah(data.totals.gross_profit)}</div></div>
            <div className="card p-4"><div className="text-[11px] uppercase text-slate-500 font-bold">Diskon</div><div className="text-xl font-extrabold font-mono-num">{rupiah(data.totals.discount)}</div></div>
            <div className="card p-4"><div className="text-[11px] uppercase text-slate-500 font-bold">PPN</div><div className="text-xl font-extrabold font-mono-num">{rupiah(data.totals.tax)}</div></div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-3">Penjualan per Metode Pembayaran</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.by_payment.map((m) => (
                <div key={m.method} className="rounded-lg border border-slate-200 p-3" data-testid={`report-payment-${m.method}`}>
                  <div className="text-[11px] uppercase text-slate-500 font-bold">{m.label}</div>
                  <div className="text-lg font-extrabold font-mono-num">{rupiah(m.total)}</div>
                  <div className="text-xs text-slate-500">{m.count} transaksi</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-bold text-slate-800 mb-3">Penjualan per Kategori</h3>
              <table className="ktp-table">
                <thead><tr><th>Kategori</th><th className="text-right">Qty</th><th className="text-right">Omzet</th></tr></thead>
                <tbody>
                  {data.by_category.map((c) => (
                    <tr key={c.category}><td>{c.category}</td><td className="text-right font-mono-num">{c.qty}</td><td className="text-right font-mono-num font-bold">{rupiah(c.revenue)}</td></tr>
                  ))}
                  {data.by_category.length === 0 && <tr><td colSpan={3} className="text-center text-slate-500 py-4">Tidak ada data.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-slate-800 mb-3">Rincian Transaksi</h3>
              <div className="max-h-96 overflow-y-auto">
                <table className="ktp-table">
                  <thead><tr><th>No.</th><th>Waktu</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {data.sales.map((s) => (
                      <tr key={s.id}><td className="font-mono-num text-xs">{s.sale_no}</td><td className="text-xs">{formatTanggalWaktu(s.created_at)}</td><td className="text-right font-mono-num">{rupiah(s.total)}</td></tr>
                    ))}
                    {data.sales.length === 0 && <tr><td colSpan={3} className="text-center text-slate-500 py-4">Tidak ada transaksi.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
