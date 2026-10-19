import React from "react";
import { rupiah, parseRupiahInput } from "@/lib/format";
import { Banknote, QrCode, Landmark } from "lucide-react";

const QUICK_CASH = [0, 10000, 20000, 50000, 100000, 200000];
const METHODS = [
  { v: "tunai", l: "Tunai", icon: Banknote },
  { v: "qris", l: "QRIS", icon: QrCode },
  { v: "transfer", l: "Transfer", icon: Landmark },
];

export default function PaymentPanel({ method, setMethod, cash, setCash, payRef, setPayRef, total, change, settings, cashRef, onEnter }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
        {METHODS.map(({ v, l, icon: Icon }) => (
          <button key={v} onClick={() => setMethod(v)} data-testid={`pos-pay-method-${v}`}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${method === v ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
            <Icon className="h-3.5 w-3.5" /> {l}
          </button>
        ))}
      </div>

      {method === "tunai" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-slate-500">Uang Diterima</span>
            <input ref={cashRef} className="input py-2 w-40 text-right font-mono-num text-base" value={cash.toLocaleString("id-ID")}
              onChange={(e) => setCash(parseRupiahInput(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }} data-testid="pos-cash-input" />
          </div>
          <div className="grid grid-cols-6 gap-1">
            {QUICK_CASH.map((v) => (
              <button key={v} onClick={() => setCash(v === 0 ? total : v)} className="btn-secondary text-[11px] py-1 px-1 whitespace-nowrap" data-testid={`pos-quick-cash-${v}`}>
                {v === 0 ? "Uang Pas" : `${v / 1000}rb`}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-sm text-slate-500">Kembalian</span>
            <span className="text-xl font-bold font-mono-num text-emerald-700" data-testid="pos-change-amount">{rupiah(change)}</span>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2" data-testid="pos-noncash-panel">
          {method === "qris" ? (
            settings?.qris_image
              ? <img src={settings.qris_image} alt="QRIS toko" className="mx-auto max-h-40 rounded bg-white p-1" data-testid="pos-qris-image" />
              : <div className="text-xs text-amber-700">Gambar QRIS toko belum diunggah di Pengaturan. Tunjukkan QRIS cetak Anda ke pelanggan.</div>
          ) : (
            <div className="text-xs text-slate-700 whitespace-pre-wrap" data-testid="pos-bank-info">{settings?.bank_info || "Info rekening belum diisi di Pengaturan."}</div>
          )}
          <div className="text-xs text-slate-500">Pastikan dana <b>{rupiah(total)}</b> sudah masuk sebelum menyimpan.</div>
          <input ref={cashRef} className="input py-1.5 text-sm" placeholder="No. referensi (opsional)" value={payRef}
            onChange={(e) => setPayRef(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }} data-testid="pos-pay-ref-input" />
        </div>
      )}
    </div>
  );
}
