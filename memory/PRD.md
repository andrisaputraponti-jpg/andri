# Kasir Toko Serba Ada — PRD

## Original request
Indonesian POS app for a general store: fast checkout, barcode scanner, thermal printing, stock, cost/profit, local data, backup. Originally Electron/SQLite for Windows; user chose a web version (React + FastAPI + MongoDB).

## User choices
- Web version, no login, receipt printing via browser dialog AND ESC/POS (.bin download), sample categories/products (removable), user sets store info in Pengaturan.

## Implemented (2026-06)
- Backend: categories, products (unique code/barcode), barcode lookup, sales (stock check, below-cost guard, PPN, change, COGS/gross profit, TRX-YYYYMMDD-#### numbers), stock adjust + movements, purchases (pending/received, weighted average cost), dashboard, sales report (by category), settings, JSON backup export/import, seed data.
- Frontend (Indonesian): Beranda, Kasir (scanner autofocus, F2/F4/F9, Enter to checkout, quick cash, discounts, receipt modal), Daftar Barang, Kategori, Persediaan, Pembelian, Riwayat, Laporan (CSV), Pengaturan, Cadangkan Data.
- Tested: iteration_2 — all core flows pass; bugs found then fixed (purchase received=true didn't add stock, regex search 500, report discount total, layout issues).

## Iteration 2 (2026-06)
- Offline mode: service worker caches the app (works on reload offline), product/settings cached locally, offline sales queued in browser storage and auto-synced (on reconnect + every 20s); idempotent via client_id (unique index); 5xx retried, 4xx moved to "failed" with Kirim ulang button.
- Payments: Tunai / QRIS / Transfer Bank at checkout (records method + optional ref; static store QRIS image + bank info in Pengaturan). Breakdown per method in Laporan, Riwayat, CSV, dashboard API.
- Label Barcode page: generate internal EAN-13 (prefix 20) for items without barcode, print sticker sheets (38x25 / 50x30 / 60x40 mm, name/price toggles).
- Tested iteration_3: all flows pass; fixes applied after (chart bars, SW precache on first visit, race-safe sync, retry UI).

## Backlog
- P1: Product CSV import/export, flag negative stock after offline sync, low-stock badge in sidebar
- P2: Shift/cash drawer closing, receipt logo, multiple payment methods (QRIS), barcode label printing
