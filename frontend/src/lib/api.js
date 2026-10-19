import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({ baseURL: API });

export const api = {
  // Categories
  listCategories: () => http.get("/categories").then((r) => r.data),
  createCategory: (d) => http.post("/categories", d).then((r) => r.data),
  updateCategory: (id, d) => http.put(`/categories/${id}`, d).then((r) => r.data),
  deleteCategory: (id) => http.delete(`/categories/${id}`).then((r) => r.data),

  // Products
  listProducts: (params = {}) => http.get("/products", { params }).then((r) => r.data),
  productByBarcode: (bc) => http.get(`/products/by-barcode/${encodeURIComponent(bc)}`).then((r) => r.data),
  createProduct: (d) => http.post("/products", d).then((r) => r.data),
  updateProduct: (id, d) => http.put(`/products/${id}`, d).then((r) => r.data),
  generateBarcode: (id) => http.post(`/products/${id}/generate-barcode`).then((r) => r.data),
  deleteProduct: (id) => http.delete(`/products/${id}`).then((r) => r.data),

  // Stock
  listMovements: (params = {}) => http.get("/stock/movements", { params }).then((r) => r.data),
  adjustStock: (d) => http.post("/stock/adjust", d).then((r) => r.data),

  // Sales
  createSale: (d) => http.post("/sales", d).then((r) => r.data),
  listSales: (params = {}) => http.get("/sales", { params }).then((r) => r.data),
  getSale: (id) => http.get(`/sales/${id}`).then((r) => r.data),

  // Purchases
  createPurchase: (d) => http.post("/purchases", d).then((r) => r.data),
  receivePurchase: (id) => http.post(`/purchases/${id}/receive`).then((r) => r.data),
  listPurchases: () => http.get("/purchases").then((r) => r.data),
  getPurchase: (id) => http.get(`/purchases/${id}`).then((r) => r.data),
  deletePurchase: (id) => http.delete(`/purchases/${id}`).then((r) => r.data),

  // Dashboard & reports
  dashboard: (params = {}) => http.get("/dashboard", { params }).then((r) => r.data),
  reportSales: (params = {}) => http.get("/reports/sales", { params }).then((r) => r.data),

  // Settings
  getSettings: () => http.get("/settings").then((r) => r.data),
  updateSettings: (d) => http.put("/settings", d).then((r) => r.data),

  // Backup
  backupExport: () => http.get("/backup/export").then((r) => r.data),
  backupImport: (d) => http.post("/backup/import", d).then((r) => r.data),
};
