import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import Layout from "@/components/Layout";
import Beranda from "@/pages/Beranda";
import Kasir from "@/pages/Kasir";
import Barang from "@/pages/Barang";
import Kategori from "@/pages/Kategori";
import Persediaan from "@/pages/Persediaan";
import Pembelian from "@/pages/Pembelian";
import Riwayat from "@/pages/Riwayat";
import Laporan from "@/pages/Laporan";
import Pengaturan from "@/pages/Pengaturan";
import Cadangkan from "@/pages/Cadangkan";
import LabelBarcode from "@/pages/LabelBarcode";

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Beranda />} />
            <Route path="kasir" element={<Kasir />} />
            <Route path="barang" element={<Barang />} />
            <Route path="kategori" element={<Kategori />} />
            <Route path="persediaan" element={<Persediaan />} />
            <Route path="pembelian" element={<Pembelian />} />
            <Route path="label" element={<LabelBarcode />} />
            <Route path="riwayat" element={<Riwayat />} />
            <Route path="laporan" element={<Laporan />} />
            <Route path="pengaturan" element={<Pengaturan />} />
            <Route path="cadangkan" element={<Cadangkan />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}
