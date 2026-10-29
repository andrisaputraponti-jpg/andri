import React, { useEffect, useState } from "react";
import { Download, CheckCircle2, X } from "lucide-react";

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

export default function InstallButton() {
  const [prompt, setPrompt] = useState(window.__installPrompt || null);
  const [installed, setInstalled] = useState(isStandalone());
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onReady = () => setPrompt(window.__installPrompt);
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("install-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("install-ready", onReady); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed) {
    return <div className="flex items-center gap-2 text-[11px] text-emerald-400" data-testid="install-status-installed"><CheckCircle2 className="h-3.5 w-3.5" /> Aplikasi terpasang</div>;
  }

  const install = async () => {
    if (!prompt) { setHelp(true); return; }
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__installPrompt = null;
    setPrompt(null);
    if (outcome === "accepted") setInstalled(true);
  };

  const inFrame = window.self !== window.top;

  return (
    <>
      <button onClick={install} data-testid="install-app-button"
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold py-2 transition-colors">
        <Download className="h-3.5 w-3.5" /> Pasang Aplikasi
      </button>
      {help && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setHelp(false)}>
          <div className="card max-w-md w-full p-5 space-y-3 text-slate-800" onClick={(e) => e.stopPropagation()} data-testid="install-help-modal">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Cara Memasang Aplikasi Kasir</h3>
              <button className="btn-ghost p-1" onClick={() => setHelp(false)} data-testid="install-help-close"><X className="h-4 w-4" /></button>
            </div>
            {inFrame && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                Halaman ini sedang dibuka di dalam jendela pratinjau. Buka alamat aplikasi di tab browser baru terlebih dahulu.
              </div>
            )}
            <ol className="list-decimal pl-5 text-sm space-y-1.5">
              <li><b>Chrome / Edge (Windows):</b> klik ikon <b>Instal</b> (layar dengan panah) di ujung kanan kolom alamat, atau menu <b>⋮</b> → <b>Simpan dan bagikan / Aplikasi</b> → <b>Instal Kasir Toko Serba Ada</b>.</li>
              <li><b>Android (Chrome):</b> menu <b>⋮</b> → <b>Instal aplikasi</b> / <b>Tambahkan ke layar utama</b>.</li>
              <li><b>iPhone / iPad (Safari):</b> tombol <b>Bagikan</b> → <b>Tambahkan ke Layar Utama</b>.</li>
              <li><b>Firefox</b> belum mendukung pemasangan. Gunakan Chrome atau Edge.</li>
            </ol>
            <p className="text-xs text-slate-500">Setelah terpasang, aplikasi muncul di Start Menu/desktop dan tetap bisa dipakai saat internet putus. Buka sekali saat online agar data barang tersimpan.</p>
          </div>
        </div>
      )}
    </>
  );
}
