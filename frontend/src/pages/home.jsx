
import React, { useEffect, useState } from "react";
import Papa from "papaparse";

const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmz55GXbaiZ040aPDaLDLpApzFYtjYQ2431Qk9_bRD0bAl50f1zrVrBglOHr6VRj4Vo2SLvnIKBA2B/pub?output=csv";

export default function Home() {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    let controller = null;

    const fetchData = async () => {
      // Hindari request yang menumpuk
      if (controller) controller.abort();
      controller = new AbortController();

      try {
        const url = `${SPREADSHEET_URL}&t=${Date.now()}`;

        const res = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const text = await res.text();

        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) =>
            header.trim().toLowerCase(),
        });

        if (result.errors.length > 0) {
          console.warn("Peringatan CSV:", result.errors);
        }

        const cleanData = result.data
          .map((b) => {
            const jumlahRaw = String(
              b.jumlah_bed ?? "1"
            ).trim();

            return {
              nomor: String(b.nomor ?? "").trim(),
              kelas: String(b.kelas ?? "").trim(),
              ruangan: String(b.ruangan ?? "").trim(),
              status: String(b.status ?? "")
                .toLowerCase()
                .trim(),
              lantai: String(b.lantai ?? "").trim(),
              bangsal: String(b.bangsal ?? "").trim(),
              jenis: String(b.jenis ?? "")
                .toLowerCase()
                .trim(),
              jumlah_bed:
                jumlahRaw === ""
                  ? NaN
                  : Number(jumlahRaw),
            };
          })
          .filter(
            (b) =>
              b.nomor !== "" &&
              ["kosong", "terisi"].includes(b.status) &&
              b.lantai !== "" &&
              b.bangsal !== "" &&
              Number.isInteger(b.jumlah_bed) &&
              b.jumlah_bed >= 0
          );

        if (mounted) {
          setBeds(cleanData);
          setError("");
        }
      } catch (err) {
        if (err.name !== "AbortError" && mounted) {
          console.error("Gagal mengambil data:", err);
          setError(
            "Data gagal diperbarui. Menampilkan data terakhir yang tersedia."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (controller) controller.abort();
    };
  }, []);

  // STATISTIK BERDASARKAN JUMLAH BED
  const kosong = beds
    .filter((b) => b.status === "kosong")
    .reduce((total, b) => total + b.jumlah_bed, 0);

  const terisi = beds
    .filter((b) => b.status === "terisi")
    .reduce((total, b) => total + b.jumlah_bed, 0);

  const totalBed = kosong + terisi;

  // GROUPING BERDASARKAN LANTAI, BANGSAL, JENIS
  const grouped = beds.reduce((acc, bed) => {
    if (!acc[bed.lantai]) {
      acc[bed.lantai] = {};
    }

    if (!acc[bed.lantai][bed.bangsal]) {
      acc[bed.lantai][bed.bangsal] = {};
    }

    const jenis = bed.jenis || "umum";

    if (!acc[bed.lantai][bed.bangsal][jenis]) {
      acc[bed.lantai][bed.bangsal][jenis] = [];
    }

    acc[bed.lantai][bed.bangsal][jenis].push(bed);

    return acc;
  }, {});

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-6">

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          🏥 Monitoring Bed Rumah Sakit
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Informasi ketersediaan tempat tidur
        </p>
      </div>

      {/* NOTIFIKASI ERROR */}
      {error && (
        <div className="mb-5 p-4 bg-yellow-50 border border-yellow-300 rounded-xl text-yellow-800 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* STATISTIK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

        <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-6 rounded-2xl shadow-lg">
          <p className="text-sm opacity-80">
            Bed Kosong
          </p>
          <h2 className="text-3xl font-bold mt-2">
            {kosong}
          </h2>
        </div>

        <div className="bg-gradient-to-r from-red-400 to-red-600 text-white p-6 rounded-2xl shadow-lg">
          <p className="text-sm opacity-80">
            Bed Terisi
          </p>
          <h2 className="text-3xl font-bold mt-2">
            {terisi}
          </h2>
        </div>

        <div className="bg-gradient-to-r from-blue-400 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
          <p className="text-sm opacity-80">
            Total Bed
          </p>
          <h2 className="text-3xl font-bold mt-2">
            {totalBed}
          </h2>
        </div>

      </div>

      {/* LOADING */}
      {loading && (
        <div className="text-center text-gray-500 py-10">
          Memuat data tempat tidur...
        </div>
      )}

      {/* DATA BERDASARKAN LANTAI */}
      {!loading &&
        Object.keys(grouped).map((lantai) => (
          <div key={lantai} className="mb-12">

            {/* JUDUL LANTAI */}
            <h2 className="text-2xl font-bold mb-5 text-gray-700">
              🏢 {lantai}
            </h2>

            {/* BANGSAL */}
            {Object.keys(grouped[lantai]).map((bangsal) => (
              <div
                key={bangsal}
                className="bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-md mb-6"
              >

                <h3 className="text-lg font-semibold mb-5 text-gray-800">
                  🛏️ Bangsal {bangsal}
                </h3>

                {/* JENIS */}
                {Object.keys(grouped[lantai][bangsal]).map(
                  (jenis) => (
                    <div key={jenis} className="mb-6">

                      <p className="mb-4 text-sm font-semibold text-gray-600 capitalize">
                        {jenis}
                      </p>

                      {/* GRID NOMOR KAMAR */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">

                        {grouped[lantai][bangsal][jenis].map(
                          (bed, i) => (
                            <div
                              key={`${bed.nomor}-${i}`}
                              className="flex flex-col gap-2"
                            >

                              {/* NOMOR DAN JUMLAH BED */}
                              {/* DITAMPILKAN DI LUAR KOTAK */}
                              <div className="px-1">

                                <p className="font-bold text-lg text-gray-800">
                                  Nomor {bed.nomor}
                                </p>

                                <p className="text-sm font-semibold text-blue-600 mt-1">
                                  🛏️ Jumlah Bed: {bed.jumlah_bed}
                                </p>

                              </div>

                              {/* KOTAK INFORMASI BED */}
                              <div
                                className={`p-4 rounded-xl shadow-md border transition-transform duration-200 hover:scale-[1.03] ${
                                  bed.status === "kosong"
                                    ? "bg-green-50 border-green-300"
                                    : "bg-red-50 border-red-300"
                                }`}
                              >

                                {/* KELAS */}
                                <p className="text-xs font-semibold text-gray-600 mb-2">
                                  {bed.kelas}
                                </p>

                                {/* RUANGAN */}
                                <p className="text-xs text-gray-500 mb-3">
                                  Ruangan: {bed.ruangan || "-"}
                                </p>

                                {/* JENIS */}
                                <span
                                  className={`inline-block px-2 py-1 text-xs rounded-full font-semibold mb-3 ${
                                    bed.jenis === "laki-laki"
                                      ? "bg-blue-100 text-blue-600"
                                      : bed.jenis === "perempuan"
                                      ? "bg-pink-100 text-pink-600"
                                      : "bg-yellow-100 text-yellow-600"
                                  }`}
                                >
                                  {bed.jenis || "umum"}
                                </span>

                                {/* STATUS */}
                                <div>
                                  <span
                                    className={`inline-block px-3 py-1 text-xs rounded-full font-bold capitalize ${
                                      bed.status === "kosong"
                                        ? "bg-green-200 text-green-800"
                                        : "bg-red-200 text-red-800"
                                    }`}
                                  >
                                    {bed.status}
                                  </span>
                                </div>

                              </div>
                            </div>
                          )
                        )}

                      </div>
                    </div>
                  )
                )}

              </div>
            ))}
          </div>
        ))}

      {/* DATA KOSONG */}
      {!loading && beds.length === 0 && (
        <div className="text-center text-gray-500 py-10">
          Belum ada data bed yang dapat ditampilkan.
        </div>
      )}

    </section>
  );
}
