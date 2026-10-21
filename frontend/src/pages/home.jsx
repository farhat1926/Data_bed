import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

// Sumber data tetap memakai Google Spreadsheet dari aplikasi sebelumnya.
const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmz55GXbaiZ040aPDaLDLpApzFYtjYQ2431Qk9_bRD0bAl50f1zrVrBglOHr6VRj4Vo2SLvnIKBA2B/pub?output=csv";
const REFRESH_MS = 30000;
const SLIDE_MS = 9000;
const ROOMS_PER_PAGE = 6;

// Normalisasi teks agar Ar Rahim dan Ar-Rahim dianggap bangsal yang sama.
function normalKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Kolom lantai pada spreadsheet berisi kode bed, misalnya Lantai 3D1.
// Ambil lantai bangunannya saja: Lantai 3.
function floorLabel(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/lantai\s*(\d+)/i);
  return match ? `Lantai ${match[1]}` : raw || "Lokasi belum tercatat";
}

function normalizeRow(row) {
  const raw = String(row.jumlah_bed ?? "").trim();
  const num = raw === "" ? null : Number(raw);
  const status = String(row.status ?? "").trim().toLowerCase();
  return {
    id: String(row.id ?? "").trim(),
    nomor: String(row.nomor ?? "").trim(),
    lantai: String(row.lantai ?? "").trim(),
    bangsal: String(row.bangsal ?? "").trim(),
    kelas: String(row.kelas ?? "").trim(),
    ruangan: String(row.ruangan ?? "").trim(),
    jenis: String(row.jenis ?? "").trim().toLowerCase(),
    status: status === "kosong" || status === "terisi" ? status : "unknown",
    capacity: Number.isInteger(num) && num > 0 ? num : null,
  };
}

function buildRooms(rows) {
  const map = new Map();
  rows.forEach((r) => {
    if (!r.nomor || !r.bangsal) return;
    const lantai = floorLabel(r.lantai);
    const key = JSON.stringify([normalKey(lantai), normalKey(r.bangsal), normalKey(r.nomor)]);
    if (!map.has(key)) {
      map.set(key, {
        key, nomor: r.nomor, lantai, bangsal: r.bangsal,
        kelas: r.kelas, capacity: null, rows: [],
      });
    }
    const room = map.get(key);
    if (r.capacity !== null) room.capacity = r.capacity;
    if (!room.kelas && r.kelas) room.kelas = r.kelas;
    room.rows.push(r);
  });

  return Array.from(map.values()).map((room) => {
    // Baris status tetap mengikuti urutan spreadsheet; satu baris = satu bed.
    // Kapasitas diambil hanya dari kolom jumlah_bed, sekali per kamar.
    const capacity = room.capacity;
    const beds = Array.from({ length: capacity ?? 0 }, (_, i) => ({
      number: i + 1,
      id: room.rows[i]?.id || null,
      status: room.rows[i]?.status ?? "unknown",
    }));
    const available = beds.filter((b) => b.status === "kosong").length;
    const occupied = beds.filter((b) => b.status === "terisi").length;
    const unknown = beds.filter((b) => b.status === "unknown").length;
    const needsReview = capacity === null || room.rows.length !== capacity || unknown > 0;
    return {
      ...room, beds, available, occupied, unknown, needsReview,
      // Jangan pernah menganggap kapasitas 0 atau tidak diketahui sebagai PENUH.
      displayStatus: available > 0 ? `${available} TERSEDIA` :
        needsReview ? "PERLU VERIFIKASI" :
        occupied === capacity && capacity > 0 ? "PENUH" : "PERLU VERIFIKASI",
    };
  });
}

function Metric({ label, value, accent, unit }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm flex items-center justify-between gap-4">
      <div>
        <p className="text-[clamp(13px,1.15vw,22px)] font-semibold text-slate-600">{label}</p>
        <p className="text-[clamp(12px,0.85vw,16px)] text-slate-400">{unit}</p>
      </div>
      <span className={`text-[clamp(36px,4vw,76px)] leading-none font-black tabular-nums ${accent}`}>
        {value}
      </span>
    </div>
  );
}

function RoomCard({ room }) {
  const isAvailable = room.available > 0;
  const needsReview = room.needsReview;
  return (
    <article className={`h-full min-h-0 overflow-hidden rounded-2xl border-2 bg-white shadow-sm flex flex-col ${
      isAvailable ? "border-emerald-300" : needsReview ? "border-amber-300" : "border-rose-300"
    }`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="min-w-0">
          <p className="text-[clamp(10px,0.9vw,16px)] font-semibold text-slate-500 truncate">
            {room.lantai} • Bangsal {room.bangsal}
          </p>
          <h3 className="text-[clamp(18px,1.75vw,34px)] font-extrabold tracking-tight text-slate-900 truncate">
            Kamar {room.nomor}
          </h3>
        </div>
        <span className={`shrink-0 rounded-xl px-3 py-2 text-center font-extrabold text-[clamp(11px,1.05vw,18px)] ${
          isAvailable ? "bg-emerald-100 text-emerald-800" : needsReview ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
        }`}>
          {room.displayStatus}
        </span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-center px-4 py-3 gap-3">
        <div className="flex items-center justify-between gap-2 text-[clamp(12px,1vw,18px)]">
          <span className="text-slate-600 truncate">{room.kelas || "Kelas belum dicatat"}</span>
          <span className="shrink-0 font-semibold text-slate-800">Kapasitas {room.capacity ?? "—"} bed</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {room.beds.length ? room.beds.map((bed) => (
            <div key={bed.number} className={`rounded-xl border px-2 py-2 flex flex-col items-center justify-center gap-1 ${
              bed.status === "kosong" ? "bg-emerald-50 border-emerald-300" : bed.status === "terisi" ? "bg-rose-50 border-rose-300" : "bg-amber-50 border-amber-300"
            }`}>
              <span className="text-[clamp(11px,1vw,18px)] font-bold text-slate-800">Bed {bed.number}</span>
              <span className={`text-[clamp(10px,0.9vw,16px)] font-extrabold ${
                bed.status === "kosong" ? "text-emerald-700" : bed.status === "terisi" ? "text-rose-700" : "text-amber-700"
              }`}>
                {bed.status === "kosong" ? "● Kosong" : bed.status === "terisi" ? "● Terisi" : "● Belum ada data"}
              </span>
            </div>
          )) : <span className="col-span-3 text-amber-800 font-semibold text-sm">Kapasitas kamar belum tersedia.</span>}
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastCheck, setLastCheck] = useState(null);
  const [page, setPage] = useState(0);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let controller = null;
    const load = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const response = await fetch(`${SPREADSHEET_URL}&t=${Date.now()}`, {
          signal: current.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csv = await response.text();
        const parsed = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.replace(/^\uFEFF/, "").trim().toLowerCase(),
        });
        if (!Array.isArray(parsed.data)) throw new Error("Format CSV tidak sesuai");
        const data = parsed.data.map(normalizeRow).filter((r) => r.nomor && r.lantai && r.bangsal);
        if (active && controller === current) {
          setRows(data);
          setLastCheck(new Date());
          setError("");
        }
      } catch (e) {
        if (active && e.name !== "AbortError") {
          console.error("Sinkronisasi data bed:", e);
          setError("Koneksi data terganggu — konfirmasi ketersediaan ke petugas.");
        }
      } finally {
        if (active && controller === current) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(interval);
      controller?.abort();
    };
  }, []);

  const rooms = useMemo(() => buildRooms(rows), [rows]);
  const total = rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
  const available = rooms.reduce((sum, r) => sum + r.available, 0);
  const occupied = rooms.reduce((sum, r) => sum + r.occupied, 0);
  const unknown = rooms.reduce((sum, r) => sum + r.unknown, 0);
  const reviewCount = rooms.filter((r) => r.needsReview).length;
  const pageCount = Math.max(1, Math.ceil(rooms.length / ROOMS_PER_PAGE));
  const currentPage = page % pageCount;
  const currentRooms = rooms.slice(currentPage * ROOMS_PER_PAGE, (currentPage + 1) * ROOMS_PER_PAGE);

  useEffect(() => {
    if (pageCount <= 1) return;
    const interval = setInterval(() => setPage((p) => (p + 1) % pageCount), SLIDE_MS);
    return () => clearInterval(interval);
  }, [pageCount]);

  return (
    <main className="h-screen w-full overflow-hidden bg-[#f3f7fc] text-slate-900 flex flex-col p-[clamp(12px,1.6vw,30px)] gap-[clamp(10px,1.1vw,20px)]">
      <header className="shrink-0 bg-gradient-to-r from-[#174e94] via-[#2268b8] to-[#2580bf] rounded-2xl text-white px-[clamp(18px,2.4vw,46px)] py-[clamp(12px,1.3vw,26px)] flex justify-between items-center gap-4">
        <div className="min-w-0">
          <p className="text-[clamp(11px,1vw,20px)] font-semibold tracking-widest text-blue-100 uppercase">RS UMS A.R. Fachrudin</p>
          <h1 className="text-[clamp(22px,2.5vw,48px)] font-black leading-tight">Informasi Ketersediaan Kamar Rawat Inap</h1>
          <p className="text-[clamp(12px,1vw,19px)] text-blue-100">Pantau kapasitas dan status tempat tidur pada setiap kamar</p>
        </div>
        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-[clamp(22px,2.1vw,40px)] leading-none font-black tabular-nums">{clock.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
          <p className="text-[clamp(11px,1vw,18px)] text-blue-100 mt-2">{clock.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </header>

      <section className="shrink-0 grid grid-cols-3 gap-[clamp(8px,1vw,20px)]" aria-label="Ringkasan ketersediaan tempat tidur">
        <Metric label="TEMPAT TIDUR TERSEDIA" value={available} unit="Status kosong" accent="text-emerald-600" />
        <Metric label="TEMPAT TIDUR TERISI" value={occupied} unit="Sedang digunakan" accent="text-rose-600" />
        <Metric label="TOTAL KAPASITAS" value={total} unit="Sesuai jumlah_bed" accent="text-blue-700" />
      </section>

      <section className="flex-1 min-h-0 flex flex-col gap-2" aria-label="Daftar kamar rawat inap">
        <div className="shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-black text-[clamp(17px,1.55vw,28px)]">Status Setiap Kamar</h2>
            <span className="text-[clamp(11px,0.9vw,16px)] text-slate-500">{rooms.length} kamar tercatat</span>
          </div>
          <div className="shrink-0 text-[clamp(11px,0.95vw,17px)] font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full">
            Halaman {currentPage + 1} / {pageCount} • berganti otomatis
          </div>
        </div>
        {loading ? (
          <div className="flex-1 grid place-items-center text-xl font-semibold text-slate-500">Memuat informasi kamar...</div>
        ) : rooms.length === 0 ? (
          <div className="flex-1 grid place-items-center text-xl font-semibold text-slate-500">Belum ada data kamar untuk ditampilkan</div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-2 gap-[clamp(8px,1vw,20px)]">
            {currentRooms.map((room) => <RoomCard key={room.key} room={room} />)}
          </div>
        )}
      </section>

      <footer className="shrink-0 flex justify-between items-center gap-4 border-t border-slate-200 pt-2 text-[clamp(11px,0.85vw,16px)] text-slate-600">
        <div className="flex gap-4 font-semibold">
          <span className="text-emerald-700">● Hijau: Tersedia</span>
          <span className="text-rose-700">● Merah: Terisi</span>
          <span className="text-amber-700">● Kuning: Belum ada data</span>
        </div>
        <div className="text-right">
          {error ? <strong className="text-amber-700">{error}</strong> :
            <span>{unknown > 0 || reviewCount > 0 ? `⚠️ ${unknown} bed tanpa status • ${reviewCount} kamar perlu dicek · ` : ""}Diperiksa: {lastCheck ? lastCheck.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>}
          <span className="ml-2">• Konfirmasi ketersediaan kepada petugas</span>
        </div>
      </footer>
    </main>
  );
}
