import React, { useEffect, useRef } from "react";
import { rupiah, formatTanggalWaktu, PAYMENT_LABELS } from "@/lib/format";
import { Printer, Download, X } from "lucide-react";

function buildEscPos(sale, settings) {
  const ESC = "\x1b";
  const GS = "\x1d";
  let out = "";
  out += ESC + "@"; // init
  out += ESC + "a" + "\x01"; // center
  out += ESC + "!" + "\x30"; // double size
  out += (settings.store_name || "Toko") + "\n";
  out += ESC + "!" + "\x00";
  if (settings.address) out += settings.address + "\n";
  if (settings.phone) out += settings.phone + "\n";
  out += "--------------------------------\n";
  out += ESC + "a" + "\x00";
  out += `No   : ${sale.sale_no}\n`;
  out += `Waktu: ${formatTanggalWaktu(sale.created_at)}\n`;
  out += "--------------------------------\n";
  sale.items.forEach((it) => {
    out += `${it.product_name}\n`;
    out += ` ${it.qty} ${it.unit} x ${rupiah(it.price)}`.padEnd(22) +
      String(rupiah(it.line_total)).padStart(10) + "\n";
    if (it.discount) out += ` Diskon`.padEnd(22) + ("-" + rupiah(it.discount)).padStart(10) + "\n";
  });
  out += "--------------------------------\n";
  out += "Subtotal".padEnd(22) + String(rupiah(sale.subtotal)).padStart(10) + "\n";
  if (sale.global_discount) out += "Diskon".padEnd(22) + ("-" + rupiah(sale.global_discount)).padStart(10) + "\n";
  if (sale.tax) out += `PPN ${sale.tax_percent}%`.padEnd(22) + String(rupiah(sale.tax)).padStart(10) + "\n";
  out += ESC + "!" + "\x08"; // emphasize
  out += "TOTAL".padEnd(22) + String(rupiah(sale.total)).padStart(10) + "\n";
  out += ESC + "!" + "\x00";
  const method = sale.payment_method || "tunai";
  out += (PAYMENT_LABELS[method] || "Tunai").padEnd(22) + String(rupiah(sale.cash_received)).padStart(10) + "\n";
  if (method === "tunai") out += "Kembali".padEnd(22) + String(rupiah(sale.change)).padStart(10) + "\n";
  if (sale.payment_ref) out += `Ref: ${sale.payment_ref}\n`;
  out += "--------------------------------\n";
  out += ESC + "a" + "\x01";
  out += (settings.receipt_footer || "Terima kasih") + "\n\n\n";
  out += GS + "V" + "\x00"; // full cut
  return out;
}

export default function Receipt({ sale, settings, onClose }) {
  const printAreaRef = useRef(null);
  const paperClass = settings?.paper_size === "80mm" ? "paper-80" : "";

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePrint = () => window.print();

  const handleEscPos = () => {
    const txt = buildEscPos(sale, settings || {});
    const blob = new Blob([txt], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sale.sale_no}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Struk Transaksi</h3>
          <button className="btn-ghost p-1.5" onClick={onClose} data-testid="receipt-close-modal-button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 bg-slate-50">
          {sale.offline && (
            <div className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="receipt-offline-note">
              Tersimpan offline. Nomor transaksi resmi diberikan saat data terkirim ke server.
            </div>
          )}
          <div className={`print-area ${paperClass} bg-white mx-auto p-3 font-receipt text-[12px] text-black leading-tight`} style={{ width: settings?.paper_size === "80mm" ? "80mm" : "58mm" }} ref={printAreaRef}>
            <div className="text-center">
              <div className="font-bold text-[14px] uppercase">{settings?.store_name || "Toko"}</div>
              {settings?.address && <div>{settings.address}</div>}
              {settings?.phone && <div>Telp: {settings.phone}</div>}
            </div>
            <div className="border-t border-dashed border-black my-1" />
            <div>No   : {sale.sale_no}</div>
            <div>Waktu: {formatTanggalWaktu(sale.created_at)}</div>
            <div className="border-t border-dashed border-black my-1" />
            {sale.items.map((it, i) => (
              <div key={i} className="mb-0.5">
                <div className="font-bold truncate">{it.product_name}</div>
                <div className="flex justify-between">
                  <span>{it.qty} {it.unit} x {rupiah(it.price)}</span>
                  <span>{rupiah(it.line_total)}</span>
                </div>
                {it.discount > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>Diskon</span><span>-{rupiah(it.discount)}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="border-t border-dashed border-black my-1" />
            <div className="flex justify-between"><span>Subtotal</span><span>{rupiah(sale.subtotal)}</span></div>
            {sale.global_discount > 0 && (
              <div className="flex justify-between"><span>Diskon</span><span>-{rupiah(sale.global_discount)}</span></div>
            )}
            {sale.tax > 0 && (
              <div className="flex justify-between"><span>PPN {sale.tax_percent}%</span><span>{rupiah(sale.tax)}</span></div>
            )}
            <div className="flex justify-between font-bold text-[14px] border-t border-black pt-0.5 mt-0.5">
              <span>TOTAL</span><span>{rupiah(sale.total)}</span>
            </div>
            <div className="flex justify-between" data-testid="receipt-payment-method"><span>{PAYMENT_LABELS[sale.payment_method || "tunai"]}</span><span>{rupiah(sale.cash_received)}</span></div>
            {(sale.payment_method || "tunai") === "tunai" && <div className="flex justify-between"><span>Kembali</span><span>{rupiah(sale.change)}</span></div>}
            {sale.payment_ref && <div>Ref: {sale.payment_ref}</div>}
            <div className="border-t border-dashed border-black my-1" />
            <div className="text-center whitespace-pre-wrap">{settings?.receipt_footer || "Terima kasih"}</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-white">
          <button className="btn-secondary" onClick={handleEscPos} data-testid="receipt-escpos-button">
            <Download className="h-4 w-4" /> Unduh ESC/POS
          </button>
          <button className="btn-primary" onClick={handlePrint} data-testid="receipt-print-dialog-button">
            <Printer className="h-4 w-4" /> Cetak Struk
          </button>
        </div>
      </div>
    </div>
  );
}
