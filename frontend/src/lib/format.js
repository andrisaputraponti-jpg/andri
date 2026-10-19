export const PAYMENT_LABELS = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer Bank" };

// Format Rupiah: Rp10.000 (no decimals, dot thousand separator)
export const rupiah = (v) => {
  const n = Math.round(Number(v) || 0);
  return "Rp" + n.toLocaleString("id-ID");
};

// Parse string like "10.000" or "10000" -> integer
export const parseRupiahInput = (s) => {
  if (s === null || s === undefined) return 0;
  const digits = String(s).replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

// Format: Rabu, 29 Januari 2026 • 14:35
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export const formatTanggalLengkap = (d = new Date()) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${HARI[dt.getDay()]}, ${dt.getDate()} ${BULAN[dt.getMonth()]} ${dt.getFullYear()}`;
};

export const formatJam = (d = new Date()) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

export const formatTanggalWaktu = (d) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
