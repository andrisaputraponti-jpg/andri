import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, todayIso } from "@/lib/format";
import { TrendingUp, ShoppingBag, Package, AlertTriangle, Wallet, Truck, Receipt } from "lucide-react";

const Stat = ({ icon: Icon, label, value, tone = "slate", testid }) => (
  <div className="card p-4" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
        <div className="mt-1.5 text-2xl font-extrabold text-slate-900 font-mono-num">{value}</div>
      </div>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center bg-${tone}-50 text-${tone}-600 border border-${tone}-100`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </div>
);

export default function Beranda() {
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [data, setData] = useState(null);

  const load = () => {
    api.dashboard({ start_date: start, end_date: end }).then(setData);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  if (!data) return <div className="p-8 text-slate-500">Memuat ringkasan...</div>;

  return (
    <div className="p-6 space-y-5" data-testid="page-beranda">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Beranda</h1>
          <p className="text-sm text-slate-500">Ringkasan penjualan dan stok toko Anda.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Dari</label>
          <input type="date" className="input w-40" value={start} onChange={(e) => setStart(e.target.value)} data-testid="beranda-start-date" />
          <label className="text-xs text-slate-500">Sampai</label>
          <input type="date" className="input w-40" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="beranda-end-date" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Wallet} tone="emerald" label="Omzet Penjualan" value={rupiah(data.omzet)} testid="stat-omzet" />
        <Stat icon={Receipt} tone="indigo" label="Jumlah Transaksi" value={data.transactions} testid="stat-trx" />
        <Stat icon={TrendingUp} tone="emerald" label="Estimasi Laba Kotor" value={rupiah(data.gross_profit)} testid="stat-laba" />
        <Stat icon={Package} tone="slate" label="Produk Aktif" value={data.active_products} testid="stat-produk" />
        <Stat icon={AlertTriangle} tone="amber" label="Stok Menipis" value={data.low_stock_count} testid="stat-lowstock" />
        <Stat icon={ShoppingBag} tone="slate" label="Nilai Persediaan" value={rupiah(data.inventory_value)} testid="stat-nilai" />
        <Stat icon={Truck} tone="indigo" label="Total Pembelian" value={rupiah(data.total_purchases)} testid="stat-pembelian" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-3">Tren Penjualan 7 Hari</h3>
          <div className="flex items-end gap-2 h-40">
            {data.sales_trend.map((d) => {
              const max = Math.max(1, ...data.sales_trend.map((x) => x.total));
              const h = Math.max(4, (d.total / max) * 100);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-emerald-500/90 hover:bg-emerald-600 rounded-t-md transition-all" style={{ height: `${h}%` }} title={rupiah(d.total)} />
                  <div className="text-[10px] text-slate-500 font-mono-num">{d.date.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-3">Produk Terlaris</h3>
          {data.best_sellers.length === 0 ? (
            <div className="text-sm text-slate-500">Belum ada penjualan pada periode ini.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.best_sellers.map((b, i) => (
                <li key={b.product_id} className="py-2 flex items-center gap-3" data-testid={`best-seller-${i}`}>
                  <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center">{i + 1}</div>
                  <div className="flex-1 text-sm font-medium text-slate-800 truncate">{b.product_name}</div>
                  <div className="text-xs text-slate-500 font-mono-num">{b.qty} terjual</div>
                  <div className="text-xs font-bold text-slate-800 font-mono-num">{rupiah(b.revenue)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
