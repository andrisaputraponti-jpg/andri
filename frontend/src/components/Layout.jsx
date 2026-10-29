import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Tags, Warehouse,
  Truck, Receipt, BarChart3, Settings, Database, Store, Scan, Printer, Clock, Barcode, Wifi, WifiOff, CloudUpload,
} from "lucide-react";
import { api } from "@/lib/api";
import InstallButton from "@/components/InstallButton";
import { cache, useConnection, retryFailed } from "@/lib/offline";
import { formatTanggalLengkap, formatJam } from "@/lib/format";

const NAV = [
  { to: "/", label: "Beranda", icon: LayoutDashboard, testid: "nav-item-beranda", end: true },
  { to: "/kasir", label: "Kasir", icon: ShoppingCart, testid: "nav-item-kasir", badge: "F2" },
  { to: "/barang", label: "Daftar Barang", icon: Package, testid: "nav-item-barang" },
  { to: "/kategori", label: "Kategori Barang", icon: Tags, testid: "nav-item-kategori" },
  { to: "/persediaan", label: "Persediaan Barang", icon: Warehouse, testid: "nav-item-persediaan" },
  { to: "/pembelian", label: "Pembelian Barang", icon: Truck, testid: "nav-item-pembelian" },
  { to: "/label", label: "Label Barcode", icon: Barcode, testid: "nav-item-label" },
  { to: "/riwayat", label: "Riwayat Penjualan", icon: Receipt, testid: "nav-item-riwayat" },
  { to: "/laporan", label: "Laporan", icon: BarChart3, testid: "nav-item-laporan" },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings, testid: "nav-item-pengaturan" },
  { to: "/cadangkan", label: "Cadangkan Data", icon: Database, testid: "nav-item-cadangkan" },
];

export default function Layout() {
  const [settings, setSettings] = useState(cache.get("settings", { store_name: "Toko Serba Ada", printer_name: "" }));
  const conn = useConnection();
  const [now, setNow] = useState(new Date());
  const location = useLocation();

  useEffect(() => {
    const reload = () => api.getSettings().then((s) => { setSettings(s); cache.set("settings", s); }).catch(() => {});
    reload();
    window.addEventListener("settings-updated", reload);
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => { clearInterval(t); window.removeEventListener("settings-updated", reload); };
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen grain-bg">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-slate-950 text-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Store className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Kasir</div>
              <div className="text-sm font-bold text-white truncate" data-testid="layout-store-name">{settings.store_name || "Toko Serba Ada"}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={n.testid}
                className={({ isActive }) =>
                  `mx-2 my-0.5 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-400"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{n.label}</span>
                {n.badge && (
                  <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                    {n.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-slate-800 space-y-2">
          <InstallButton />
          <div className="text-[11px] text-slate-500">Kasir Toko Serba Ada v1.0</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-slate-400" />
            <div className="text-sm">
              <span className="font-semibold text-slate-800">{formatTanggalLengkap(now)}</span>
              <span className="text-slate-400"> • </span>
              <span className="font-mono-num text-slate-700">{formatJam(now)} WIB</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`pill border ${conn.online ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-200"}`} data-testid="status-connection">
              {conn.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />} {conn.online ? "Online" : "Offline"}
            </span>
            {conn.pending > 0 && (
              <span className="pill border bg-amber-50 text-amber-800 border-amber-200" data-testid="status-pending-sync">
                <CloudUpload className="h-3 w-3" /> {conn.pending} penjualan menunggu dikirim
              </span>
            )}
            {conn.failed > 0 && (
              <button className="pill border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" onClick={retryFailed} data-testid="status-failed-sync" title="Klik untuk mengirim ulang">
                {conn.failed} penjualan offline gagal dikirim · Kirim ulang
              </button>
            )}
            <span className="pill bg-emerald-50 text-emerald-700 border border-emerald-100" data-testid="status-scanner">
              <Scan className="h-3 w-3" /> Pemindai siap (USB)
            </span>
            <span
              className={`pill border ${
                settings.printer_name
                  ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                  : "bg-amber-50 text-amber-700 border-amber-100"
              }`}
              data-testid="status-printer"
            >
              <Printer className="h-3 w-3" />
              {settings.printer_name ? `Printer: ${settings.printer_name}` : "Printer belum dipilih"}
            </span>
          </div>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
