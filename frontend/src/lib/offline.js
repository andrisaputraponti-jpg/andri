import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const QUEUE = "kasir_sale_queue";
const FAILED = "kasir_sale_failed";

export const cache = {
  get: (k, def = null) => {
    try { const v = localStorage.getItem(`kasir_${k}`); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set: (k, v) => { try { localStorage.setItem(`kasir_${k}`, JSON.stringify(v)); } catch { /* storage full */ } },
};

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
const write = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event("queue-changed")); };

export const isNetworkError = (e) => !e?.response;
export const newClientId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const queueSale = (payload) => write(QUEUE, [...read(QUEUE), payload]);
export const retryFailed = () => {
  const failed = read(FAILED).map(({ error, ...rest }) => rest);
  write(FAILED, []);
  write(QUEUE, [...read(QUEUE), ...failed]);
  return syncQueue();
};

export const queueCounts = () => ({ pending: read(QUEUE).length, failed: read(FAILED).length });

let syncing = false;
export async function syncQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    let q = read(QUEUE);
    while (q.length) {
      const item = q[0];
      try {
        await api.createSale({ ...item, offline: true });
      } catch (e) {
        const status = e?.response?.status;
        if (isNetworkError(e) || status >= 500 || status === 408 || status === 429) break;
        write(FAILED, [...read(FAILED), { ...item, error: e?.response?.data?.detail || "Gagal" }]);
      }
      q = q.slice(1);
      write(QUEUE, q);
    }
  } finally {
    syncing = false;
  }
}

export function useConnection() {
  const [online, setOnline] = useState(navigator.onLine);
  const [counts, setCounts] = useState(queueCounts());
  useEffect(() => {
    const on = () => { setOnline(true); syncQueue(); };
    const off = () => setOnline(false);
    const qc = () => setCounts(queueCounts());
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("queue-changed", qc);
    syncQueue();
    const t = setInterval(syncQueue, 20000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("queue-changed", qc);
      clearInterval(t);
    };
  }, []);
  return { online, ...counts };
}
