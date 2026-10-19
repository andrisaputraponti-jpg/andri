# Kasir Toko Serba Ada — PRD

## Original request
Indonesian POS app for a general store: fast checkout, barcode scanner, thermal printing, stock, cost/profit, local data, backup. Originally Electron/SQLite for Windows; user chose a web version (React + FastAPI + MongoDB).

## User choices
- Web version, no login, receipt printing via browser dialog AND ESC/POS (.bin download), sample categories/products (removable), user sets store info in Pengaturan.

## Implemented (2026-06)
- Backend: categories, products (unique code/barcode), barcode lookup, sales (stock check, below-cost guard, PPN, change, COGS/gross profit, TRX-YYYYMMDD-#### numbers), stock adjust + movements, purchases (pending/received, weighted average cost), dashboard, sales report (by category), settings, JSON backup export/import, seed data.
- Frontend (Indonesian): Beranda, Kasir (scanner autofocus, F2/F4/F9, Enter to checkout, quick cash, discounts, receipt modal), Daftar Barang, Kategori, Persediaan, Pembelian, Riwayat, Laporan (CSV), Pengaturan, Cadangkan Data.
- Tested: iteration_2 — all core flows pass; bugs found then fixed (purchase received=true didn't add stock, regex search 500, report discount total, layout issues).

## Backlog
- P1: Product CSV import/export, PWA offline mode, low-stock badge in sidebar
- P2: Shift/cash drawer closing, receipt logo, multiple payment methods (QRIS), barcode label printing
