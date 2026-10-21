
import React, { useEffect, useState } from "react";
import Papa from "papaparse";

const SPREADSHEET_URL =
  "https://script.google.com/macros/s/AKfycbwwW9uCPjA6--pTEaCl2m5u3lxf5ZwWrJWOmPXZbq1wKpvapUxVaGkF4mKC01QzxzAt/exec";

export default function Home() {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // AMBIL DATA DARI GOOGLE SPREADSHEET
  useEffect(() => {
    let mounted = true;
    let controller = null;

    const fetchData = async () => {
      if (controller) controller.abort();

      const currentController = new AbortController();
      controller = currentController;

      try {
        const url = `${SPREADSHEET_URL}&t=${Date.now()}`;

        const res = await fetch(url, {
          signal: currentController.signal,
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
            header.replace(/^\uFEFF/, "").trim().toLowerCase(),
        });

        if (result.errors.length > 0) {
          console.warn("Peringatan CSV:", result.errors);
        }

        const cleanData = result.data
          .map((b) => {
            const jumlahRaw = String(
              b.jumlah_bed ?? ""
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

              // Boleh kosong pada baris kedua dan ketiga
              jumlah_bed:
                jumlahRaw === ""
                  ? null
                  : Number(jumlahRaw),
            };
          })
          .filter(
            (b) =>
              b.nomor !== "" &&
              ["kosong", "terisi"].includes(b.status) &&
              b.lantai !== "" &&
              b.bangsal !== "" &&
              (b.jumlah_bed === null ||
                (Number.isInteger(b.jumlah_bed) &&
                  b.jumlah_bed >= 0))
          );

        if (mounted) {
          setBeds(cleanData);
          setError("");
        }
      } catch (err) {
        if (err.name !== "AbortError" && mounted) {
          console.error("Gagal mengambil data:", err);
          setError(
            "Data gagal diperbarui. Menampilkan data terakhir jika tersedia."
          );
        }
      } finally {
        if (
          mounted &&
          controller === currentController
        ) {
          setLoading(false);
        }
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);

      if (controller) {
        controller.abort();
      }
    };
  }, []);

  // STATISTIK
  // 1 BARIS SPREADSHEET = 1 BED
  const kosong = beds.filter(
    (b) => b.status === "kosong"
  ).length;

  const terisi = beds.filter(
    (b) => b.status === "terisi"
  ).length;

  const totalBed = beds.length;

  // GROUPING
  // LANTAI -> BANGSAL -> KAMAR -> BED
  const grouped = beds.reduce((acc, bed) => {
    const { lantai, bangsal, nomor } = bed;

    if (!acc[lantai]) {
      acc[lantai] = {};
    }

    if (!acc[lantai][bangsal]) {
      acc[lantai][bangsal] = {};
    }

    if (!acc[lantai][bangsal][nomor]) {
      acc[lantai][bangsal][nomor] = {
        jumlah_bed: null,
        beds: [],
      };
    }

    const kamar = acc[lantai][bangsal][nomor];

    // Ambil jumlah bed dari baris yang terisi
    if (bed.jumlah_bed !== null) {
      kamar.jumlah_bed = bed.jumlah_bed;
    }

    // Simpan semua baris sebagai bed terpisah
    kamar.beds.push(bed);

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
          Informasi Ketersediaan Tempat Tidur
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

        {/* BED KOSONG */}
        <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-6 rounded-2xl shadow-lg">
          <p className="text-sm opacity-80">
            Bed Kosong
          </p>

          <h2 className="text-3xl font-bold mt-2">
            {kosong}
          </h2>
        </div>

        {/* BED TERISI */}
        <div className="bg-gradient-to-r from-red-400 to-red-600 text-white p-6 rounded-2xl shadow-lg">
          <p className="text-sm opacity-80">
            Bed Terisi
          </p>

          <h2 className="text-3xl font-bold mt-2">
            {terisi}
          </h2>
        </div>

        {/* TOTAL BED */}
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
        Object.entries(grouped).map(
          ([lantai, bangsalList]) => (
            <div key={lantai} className="mb-12">

              {/* NAMA LANTAI */}
              <h2 className="text-2xl font-bold mb-5 text-gray-700">
                🏢 {lantai}
              </h2>

              {/* DATA BANGSAL */}
              {Object.entries(bangsalList).map(
                ([bangsal, kamarList]) => (
                  <div
                    key={bangsal}
                    className="bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-md mb-6"
                  >

                    {/* NAMA BANGSAL */}
                    <h3 className="text-lg font-semibold mb-5 text-gray-800">
                      🛏️ Bangsal {bangsal}
                    </h3>

                    {/* DATA KAMAR */}
                    {Object.entries(kamarList).map(
                      ([nomor, kamar]) => (
                        <div
                          key={nomor}
                          className="mb-8"
                        >

                          {/* INFORMASI KAMAR */}
                          <div className="mb-4">

                            <h4 className="text-lg font-bold text-gray-800">
                              Kamar {nomor}
                            </h4>

                            {/* JUMLAH BED SEKALI SAJA */}
                            <span className="inline-block mt-2 text-sm font-semibold text-blue-700 bg-blue-100 px-4 py-2 rounded-lg">
                              🛏️ Jumlah Bed:{" "}
                              {kamar.jumlah_bed ??
                                kamar.beds.length}
                            </span>

                          </div>

                          {/* GRID BED */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

                            {kamar.beds.map(
                              (bed, index) => (
                                <div
                                  key={`${nomor}-${index}`}
                                  className={`p-4 rounded-xl shadow-md border transition-transform duration-200 hover:scale-[1.03] ${
                                    bed.status === "kosong"
                                      ? "bg-green-50 border-green-300"
                                      : "bg-red-50 border-red-300"
                                  }`}
                                >

                                  {/* NOMOR BED */}
                                  <p className="font-bold text-lg text-gray-800 mb-3">
                                    Bed {index + 1}
                                  </p>

                                  {/* KELAS */}
                                  <p className="text-xs font-semibold text-gray-600 mb-2">
                                    {bed.kelas}
                                  </p>

                                  {/* RUANGAN */}
                                  <p className="text-xs text-gray-500 mb-3">
                                    Ruangan:{" "}
                                    {bed.ruangan || "-"}
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
                              )
                            )}

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )
              )}

            </div>
          )
        )}

      {/* DATA KOSONG */}
      {!loading && beds.length === 0 && (
        <div className="text-center text-gray-500 py-10">
          Belum ada data bed yang dapat ditampilkan.
        </div>
      )}

    </section>
  );
}
