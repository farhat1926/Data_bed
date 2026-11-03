import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

// Tetap memakai sumber Google Sheets yang sama dengan aplikasi sebelumnya.
const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmz55GXbaiZ040aPDaLDLpApzFYtjYQ2431Qk9_bRD0bAl50f1zrVrBglOHr6VRj4Vo2SLvnIKBA2B/pub?output=csv";
const REFRESH_MS = 30000;

const KEY = (v) => String(v ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");
const CLASS_ORDER = ["VVIP", "VIP", "Kelas 1", "Kelas 2", "Kelas 3", "Isolasi", "Non-Kelas"];
const CLASS_LABEL = (s) => {
  const k = KEY(s);
  if (k === "vvip") return "VVIP";
  if (k === "vip") return "VIP";
  if (k === "kelas1" || k === "kelas i") return "Kelas 1";
  if (k === "kelas2") return "Kelas 2";
  if (k === "kelas3") return "Kelas 3";
  if (k === "isolasi") return "Isolasi";
  if (k === "nonkelas") return "Non-Kelas";
  return String(s || "Lainnya").trim();
};

const normalizeRow = (row) => ({
  nomor: String(row.nomor ?? "").trim(),
  bangsal: String(row.bangsal ?? "").trim(),
  kelas: CLASS_LABEL(row.kelas),
  ruangan: String(row.ruangan ?? "").trim(),
  status: KEY(row.status) === "kosong" ? "kosong" : KEY(row.status) === "terisi" ? "terisi" : "unknown",
});

// Khusus ruang intensif, pemisahan ICU / ICU-ISO / PICU / NICU mengikuti kolom ruangan.
function groupLabel(row) {
  const ruangan = KEY(row.ruangan);
  const nomor = KEY(row.nomor);
  if (["icu", "icuiso", "picu", "nicu"].includes(ruangan)) {
    return { name: row.ruangan.toUpperCase(), cls: "Intensif" };
  }
  if (["icu", "icuiso", "picu", "nicu"].includes(nomor)) {
    return { name: row.nomor.toUpperCase(), cls: "Intensif" };
  }
  const raw = row.bangsal.trim();
  const k = KEY(raw);
  const aliases = { arrahim: "AR-RAHIM", alkarim: "AL-KARIIM", alkariim: "AL-KARIIM", almalik: "AL-MALIK", annur: "AN-NUR" };
  return { name: aliases[k] || raw.toUpperCase(), cls: row.kelas };
}

function createGroups(rows) {
  const groups = new Map();
  rows.forEach((r) => {
    if (!r.nomor || !r.bangsal) return;
    const { name, cls } = groupLabel(r);
    const key = `${KEY(name)}::${KEY(cls)}`;
    if (!groups.has(key)) groups.set(key, { key, name, cls, available: 0, occupied: 0, unknown: 0 });
    groups.get(key)[r.status === "kosong" ? "available" : r.status === "terisi" ? "occupied" : "unknown"] += 1;
  });
  return [...groups.values()].sort((a, b) => {
    const aa = CLASS_ORDER.indexOf(a.cls);
    const bb = CLASS_ORDER.indexOf(b.cls);
    if (aa !== bb) return (aa < 0 ? 99 : aa) - (bb < 0 ? 99 : bb);
    return a.name.localeCompare(b.name, "id");
  });
}

function CountCard({ group }) {
  const hasAvailable = group.available > 0;
  return (
    <div className="rs-card">
      <div className="rs-card-head">{group.name}</div>
      <div className="rs-card-body">
        <span className="rs-class">{group.cls}</span>
        <span className={`rs-count ${hasAvailable ? "rs-count-open" : "rs-count-zero"}`}>{group.available}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let controller;
    const load = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const response = await fetch(`${SPREADSHEET_URL}&t=${Date.now()}`, {
          cache: "no-store", signal: current.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csv = await response.text();
        const parsed = Papa.parse(csv, {
          header: true, skipEmptyLines: true,
          transformHeader: (h) => h.replace(/^\uFEFF/, "").trim().toLowerCase(),
        });
        if (!Array.isArray(parsed.data) || !parsed.meta.fields?.includes("status")) {
          throw new Error("Format CSV tidak sesuai");
        }
        const data = parsed.data.map(normalizeRow).filter((r) => r.nomor && r.bangsal);
        if (active && controller === current) {
          setRows(data);
          setUpdated(new Date());
          setError("");
        }
      } catch (e) {
        if (active && e.name !== "AbortError") setError("Koneksi data terganggu, silakan konfirmasi kepada petugas.");
      } finally {
        if (active && controller === current) setLoaded(true);
      }
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(interval); controller?.abort(); };
  }, []);

  const groups = useMemo(() => createGroups(rows), [rows]);
  const available = groups.reduce((n, g) => n + g.available, 0);
  const occupied = groups.reduce((n, g) => n + g.occupied, 0);
  const unknown = groups.reduce((n, g) => n + g.unknown, 0);
  const total = available + occupied + unknown;

  return (
    <main className="rs-screen">
      <style>{`
        *{box-sizing:border-box}
        html,body,#root{margin:0;min-height:100%;width:100%}
        body{font-family:Arial,Helvetica,sans-serif}
        .rs-screen{min-height:100vh;background:#142333;color:#f8fafc;padding:clamp(14px,1.5vw,28px);display:flex;flex-direction:column;gap:clamp(12px,1.4vw,23px)}
        .rs-header{display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:2px solid #385063;padding:0 4px 18px}
        .rs-eyebrow{font-size:clamp(13px,1vw,18px);letter-spacing:2px;color:#9eb9d0;font-weight:700;margin:0 0 6px}
        .rs-title{font-size:clamp(25px,2.6vw,49px);line-height:1.1;margin:0;font-weight:900}
        .rs-clock{text-align:right;white-space:nowrap;color:#e2e8f0}
        .rs-clock strong{font-size:clamp(24px,2.3vw,42px);display:block}
        .rs-clock small{font-size:clamp(12px,1vw,18px);color:#a9b9c8}
        .rs-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .rs-metric{background:#223749;border:1px solid #385367;border-radius:12px;padding:15px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .rs-metric span{font-weight:800;color:#d1dfeb;font-size:clamp(12px,1.15vw,21px)}
        .rs-metric strong{font-size:clamp(27px,3.2vw,60px);line-height:1}
        .rs-metric .green{color:#42e2a4}.rs-metric .red{color:#ff8b8b}.rs-metric .blue{color:#74bdff}
        .rs-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(10px,1.1vw,20px);align-content:start;flex:1}
        .rs-card{border:1px solid #466173;background:#233544;min-width:0;border-radius:7px;overflow:hidden;box-shadow:0 4px 14px #0002}
        .rs-card-head{background:#00a66f;color:white;text-align:center;font-size:clamp(12px,1.05vw,20px);font-weight:900;padding:10px 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rs-card-body{display:flex;align-items:stretch;min-height:clamp(56px,5vw,100px)}
        .rs-class{flex:1;display:flex;align-items:center;justify-content:center;font-size:clamp(12px,1.15vw,21px);font-weight:750;white-space:nowrap;padding:6px}
        .rs-count{width:32%;display:flex;align-items:center;justify-content:center;font-size:clamp(27px,3vw,59px);font-weight:900;font-variant-numeric:tabular-nums}
        .rs-count-open{background:#1596da;color:white}.rs-count-zero{background:#e65d5d;color:white}
        .rs-footer{border-top:1px solid #405668;padding-top:12px;color:#c2d1df;font-size:clamp(12px,1vw,18px);display:flex;justify-content:space-between;gap:10px}
        .rs-note{color:#fbd16b}
        @media(max-width:1050px){.rs-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
        @media(max-width:650px){.rs-header{align-items:start}.rs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rs-summary{grid-template-columns:1fr}.rs-clock small{display:none}.rs-metric{padding:9px 13px}.rs-screen{min-height:100vh}.rs-footer{display:block}}
      `}</style>
      <header className="rs-header">
        <div>
          <p className="rs-eyebrow">RS UMS A.R. FACHRUDIN</p>
          <h1 className="rs-title">INFORMASI KETERSEDIAAN TEMPAT TIDUR</h1>
        </div>
        <div className="rs-clock">
          <strong>{clock.toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit",hour12:false})}</strong>
          <small>{clock.toLocaleDateString("id-ID", {day:"numeric",month:"long",year:"numeric"})}</small>
        </div>
      </header>
      <section className="rs-summary" aria-label="Ringkasan bed">
        <div className="rs-metric"><span>BED TERSEDIA</span><strong className="green">{available}</strong></div>
        <div className="rs-metric"><span>BED TERISI</span><strong className="red">{occupied}</strong></div>
        <div className="rs-metric"><span>TOTAL BED TERCATAT</span><strong className="blue">{total}</strong></div>
      </section>
      {!loaded ? <p>Memuat data tempat tidur...</p> : groups.length === 0 ? <p>Data belum tersedia. Periksa tautan Google Sheets.</p> : (
        <section className="rs-grid" aria-label="Jumlah bed tersedia per bangsal dan kelas">
          {groups.map((g) => <CountCard key={g.key} group={g} />)}
        </section>
      )}
      <footer className="rs-footer">
        <span><b className="rs-note">Keterangan:</b> Angka yang ditampilkan adalah jumlah tempat tidur yang tersedia (status kosong).</span>
        <span>{error ? error : `Diperbarui: ${updated ? updated.toLocaleTimeString("id-ID") : "—"}${unknown ? ` • ${unknown} status perlu verifikasi` : ""}`}</span>
      </footer>
    </main>
  );
}
