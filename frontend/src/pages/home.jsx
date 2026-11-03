import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

// ==========================================
// KONFIGURASI GOOGLE SHEETS
// ==========================================

const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmz55GXbaiZ040aPDaLDLpApzFYtjYQ2431Qk9_bRD0bAl50f1zrVrBglOHr6VRj4Vo2SLvnIKBA2B/pub?output=csv";

const REFRESH_MS = 30000;

// ==========================================
// NORMALISASI DATA
// ==========================================

const KEY = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const CLASS_ORDER = [
  "VVIP",
  "VIP",
  "Kelas 1",
  "Kelas 2",
  "Kelas 3",
  "Isolasi",
  "Intensif",
  "Non-Kelas",
];

function CLASS_LABEL(value) {
  const key = KEY(value);

  if (key === "vvip") return "VVIP";
  if (key === "vip") return "VIP";
  if (key === "kelas1") return "Kelas 1";
  if (key === "kelas2") return "Kelas 2";
  if (key === "kelas3") return "Kelas 3";
  if (key === "isolasi") return "Isolasi";
  if (key === "nonkelas") return "Non-Kelas";

  return String(value || "Lainnya").trim();
}

function normalizeRow(row) {
  const status = KEY(row.status);

  return {
    nomor: String(row.nomor ?? "").trim(),
    bangsal: String(row.bangsal ?? "").trim(),
    kelas: CLASS_LABEL(row.kelas),
    ruangan: String(row.ruangan ?? "").trim(),
    status:
      status === "kosong"
        ? "kosong"
        : status === "terisi"
        ? "terisi"
        : "unknown",
  };
}

// ==========================================
// PENGELOMPOKAN BANGSAL
// ==========================================

function groupLabel(row) {
  const ruangan = KEY(row.ruangan);
  const nomor = KEY(row.nomor);

  const intensiveRooms = [
    "icu",
    "icuiso",
    "picu",
    "nicu",
  ];

  if (intensiveRooms.includes(ruangan)) {
    return {
      name: row.ruangan.toUpperCase(),
      cls: "Intensif",
    };
  }

  if (intensiveRooms.includes(nomor)) {
    return {
      name: row.nomor.toUpperCase(),
      cls: "Intensif",
    };
  }

  const raw = row.bangsal.trim();
  const key = KEY(raw);

  const aliases = {
    arrahim: "AR-RAHIM",
    alkarim: "AL-KARIIM",
    alkariim: "AL-KARIIM",
    almalik: "AL-MALIK",
    annur: "AN-NUR",
  };

  return {
    name: aliases[key] || raw.toUpperCase(),
    cls: row.kelas,
  };
}

function createGroups(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    if (!row.nomor || !row.bangsal) return;

    const { name, cls } = groupLabel(row);

    const key = `${KEY(name)}::${KEY(cls)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        cls,
        available: 0,
        occupied: 0,
        unknown: 0,
      });
    }

    const group = groups.get(key);

    if (row.status === "kosong") {
      group.available++;
    } else if (row.status === "terisi") {
      group.occupied++;
    } else {
      group.unknown++;
    }
  });

  return [...groups.values()].sort((a, b) => {
    const indexA = CLASS_ORDER.indexOf(a.cls);
    const indexB = CLASS_ORDER.indexOf(b.cls);

    const orderA = indexA < 0 ? 99 : indexA;
    const orderB = indexB < 0 ? 99 : indexB;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.name.localeCompare(b.name, "id");
  });
}

// ==========================================
// KOMPONEN RINGKASAN
// ==========================================

function SummaryCard({ title, value, type }) {
  const styles = {
    available: {
      border: "border-emerald-200",
      background: "bg-emerald-50",
      text: "text-emerald-700",
    },

    occupied: {
      border: "border-rose-200",
      background: "bg-rose-50",
      text: "text-rose-600",
    },

    total: {
      border: "border-blue-200",
      background: "bg-blue-50",
      text: "text-blue-700",
    },
  };

  const style = styles[type];

  return (
    <div
      className={`
        flex items-center justify-between
        rounded-2xl border-2
        px-5 py-4
        shadow-sm
        ${style.border}
        ${style.background}
      `}
    >
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-slate-600 lg:text-lg">
          {title}
        </p>

        <p className="mt-1 text-xs text-slate-500 lg:text-sm">
          Informasi tempat tidur
        </p>
      </div>

      <strong
        className={`
          text-4xl font-black tabular-nums
          lg:text-5xl xl:text-6xl
          ${style.text}
        `}
      >
        {value}
      </strong>
    </div>
  );
}

// ==========================================
// KOMPONEN KARTU BANGSAL
// ==========================================

function CountCard({ group }) {
  const hasAvailable = group.available > 0;

  return (
    <article
      className="
        flex min-w-0 flex-col
        overflow-hidden rounded-xl
        border border-slate-200
        bg-white shadow-sm
        transition-shadow duration-200
        hover:shadow-md
      "
    >
      {/* Nama bangsal */}

      <div
        className="
          bg-emerald-600
          px-3 py-3
          text-center
        "
      >
        <h3
          className="
            truncate text-sm
            font-extrabold uppercase
            tracking-wide text-white
            lg:text-lg xl:text-xl
          "
        >
          {group.name}
        </h3>
      </div>

      {/* Kelas dan jumlah */}

      <div className="flex min-h-24 flex-1 items-stretch">
        <div
          className="
            flex min-w-0 flex-1
            items-center justify-center
            bg-white px-3 py-4
          "
        >
          <span
            className="
              text-center text-base
              font-bold text-slate-700
              lg:text-xl
            "
          >
            {group.cls}
          </span>
        </div>

        <div
          className={`
            flex w-2/5
            items-center justify-center
            px-2
            ${
              hasAvailable
                ? "bg-sky-500"
                : "bg-rose-500"
            }
          `}
        >
          <span
            className="
              text-4xl font-black
              tabular-nums text-white
              lg:text-5xl xl:text-6xl
            "
          >
            {group.available}
          </span>
        </div>
      </div>
    </article>
  );
}

// ==========================================
// KOMPONEN UTAMA
// ==========================================

export default function Home() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);
  const [clock, setClock] = useState(new Date());

  // ========================================
  // JAM REALTIME
  // ========================================

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // ========================================
  // FETCH GOOGLE SHEETS
  // ========================================

  useEffect(() => {
    let active = true;
    let controller;

    const load = async () => {
      controller?.abort();

      const current = new AbortController();
      controller = current;

      try {
        const response = await fetch(
          `${SPREADSHEET_URL}&t=${Date.now()}`,
          {
            cache: "no-store",
            signal: current.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const csv = await response.text();

        const parsed = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) =>
            header
              .replace(/^\uFEFF/, "")
              .trim()
              .toLowerCase(),
        });

        const requiredFields = [
          "nomor",
          "bangsal",
          "kelas",
          "ruangan",
          "status",
        ];

        if (
          !Array.isArray(parsed.data) ||
          !requiredFields.every((field) =>
            parsed.meta.fields?.includes(field)
          )
        ) {
          throw new Error("Format CSV tidak sesuai");
        }

        const data = parsed.data
          .map(normalizeRow)
          .filter(
            (row) => row.nomor && row.bangsal
          );

        if (active && controller === current) {
          setRows(data);
          setUpdated(new Date());
          setError("");
        }
      } catch (err) {
        if (
          active &&
          err.name !== "AbortError"
        ) {
          console.error(
            "Gagal sinkronisasi data:",
            err
          );

          setError(
            "Koneksi data terganggu. Silakan konfirmasi kepada petugas."
          );
        }
      } finally {
        if (active && controller === current) {
          setLoaded(true);
        }
      }
    };

    load();

    const interval = setInterval(
      load,
      REFRESH_MS
    );

    return () => {
      active = false;
      clearInterval(interval);
      controller?.abort();
    };
  }, []);

  // ========================================
  // PERHITUNGAN DATA
  // ========================================

  const groups = useMemo(
    () => createGroups(rows),
    [rows]
  );

  const available = groups.reduce(
    (sum, group) => sum + group.available,
    0
  );

  const occupied = groups.reduce(
    (sum, group) => sum + group.occupied,
    0
  );

  const unknown = groups.reduce(
    (sum, group) => sum + group.unknown,
    0
  );

  const total = available + occupied + unknown;

  // ========================================
  // FORMAT WAKTU
  // ========================================

  const formattedTime = clock.toLocaleTimeString(
    "id-ID",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );

  const formattedDate = clock.toLocaleDateString(
    "id-ID",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  // ========================================
  // TAMPILAN DASHBOARD
  // ========================================

  return (
    <main
      className="
        flex min-h-screen
        w-full flex-col
        gap-5 bg-slate-50
        p-4 text-slate-900
        md:p-6 xl:p-8
      "
    >
      {/* HEADER */}

      <header
        className="
          flex flex-wrap
          items-center justify-between
          gap-4 rounded-2xl
          bg-blue-600
          px-6 py-5
          text-white shadow-md
          lg:px-8
        "
      >
        <div className="min-w-0 flex-1">
          <p
            className="
              text-sm font-bold
              uppercase tracking-widest
              text-blue-100
              lg:text-lg
            "
          >
            RS UMS A.R. FACHRUDIN
          </p>

          <h1
            className="
              mt-2 text-2xl
              font-black uppercase
              leading-tight
              lg:text-3xl xl:text-4xl
            "
          >
            Informasi Ketersediaan
            Tempat Tidur
          </h1>

          <p
            className="
              mt-2 text-sm
              text-blue-100
              lg:text-base
            "
          >
            Informasi jumlah tempat tidur
            berdasarkan bangsal dan kelas
            perawatan
          </p>
        </div>

        <div className="text-right">
          <strong
            className="
              block text-3xl
              font-black tabular-nums
              lg:text-4xl
            "
          >
            {formattedTime}
          </strong>

          <p
            className="
              mt-1 text-xs
              font-medium text-blue-100
              lg:text-sm
            "
          >
            {formattedDate}
          </p>
        </div>
      </header>

      {/* RINGKASAN TEMPAT TIDUR */}

      <section
        className="
          grid grid-cols-1
          gap-4 sm:grid-cols-3
        "
        aria-label="Ringkasan tempat tidur"
      >
        <SummaryCard
          title="Bed Tersedia"
          value={available}
          type="available"
        />

        <SummaryCard
          title="Bed Terisi"
          value={occupied}
          type="occupied"
        />

        <SummaryCard
          title="Total Bed Tercatat"
          value={total}
          type="total"
        />
      </section>

      {/* JUDUL DAFTAR */}

      <div
        className="
          flex flex-wrap
          items-center justify-between
          gap-3
        "
      >
        <div>
          <h2
            className="
              text-xl font-extrabold
              text-slate-800
              lg:text-2xl
            "
          >
            Ketersediaan Tempat Tidur
          </h2>

          <p
            className="
              mt-1 text-sm
              text-slate-500
            "
          >
            Jumlah bed kosong pada setiap
            bangsal dan kelas
          </p>
        </div>

        <div
          className="
            rounded-full
            border border-emerald-200
            bg-emerald-50
            px-4 py-2
            text-sm font-bold
            text-emerald-700
          "
        >
          {groups.length} Kelompok Perawatan
        </div>
      </div>

      {/* GRID KETERSEDIAAN BED */}

      {!loaded ? (
        <div
          className="
            flex flex-1
            items-center justify-center
            rounded-xl bg-white
            p-10 text-lg
            font-semibold text-slate-500
          "
        >
          Memuat data tempat tidur...
        </div>
      ) : groups.length === 0 ? (
        <div
          className="
            flex flex-1
            items-center justify-center
            rounded-xl bg-white
            p-10 text-center
            font-semibold text-slate-500
          "
        >
          Data belum tersedia.
          Periksa koneksi Google Sheets.
        </div>
      ) : (
        <section
          className="
            grid flex-1
            grid-cols-2
            content-start
            gap-3
            md:grid-cols-3
            lg:grid-cols-4
            xl:grid-cols-5
          "
          aria-label="Jumlah tempat tidur tersedia"
        >
          {groups.map((group) => (
            <CountCard
              key={group.key}
              group={group}
            />
          ))}
        </section>
      )}

      {/* FOOTER */}

      <footer
        className="
          mt-auto flex
          flex-wrap items-center
          justify-between
          gap-3 border-t
          border-slate-200
          pt-4 text-sm
          text-slate-600
        "
      >
        <div className="flex flex-wrap gap-4">
          <span className="font-semibold">
            Keterangan:
          </span>

          <span className="flex items-center gap-2">
            <span
              className="
                h-3 w-3 rounded-full
                bg-sky-500
              "
            />
            Tersedia
          </span>

          <span className="flex items-center gap-2">
            <span
              className="
                h-3 w-3 rounded-full
                bg-rose-500
              "
            />
            Tidak tersedia
          </span>

          {unknown > 0 && (
            <span className="font-semibold text-amber-700">
              {unknown} status perlu verifikasi
            </span>
          )}
        </div>

        <div className="text-right">
          {error ? (
            <span className="font-semibold text-amber-700">
              {error}
            </span>
          ) : (
            <span>
              Update terakhir:{" "}
              <strong>
                {updated
                  ? updated.toLocaleTimeString("id-ID")
                  : "—"}
              </strong>
            </span>
          )}
        </div>
      </footer>
    </main>
  );
}