
import React, { useEffect, useState } from "react";
import Papa from "papaparse";

const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmz55GXbaiZ040aPDaLDLpApzFYtjYQ2431Qk9_bRD0bAl50f1zrVrBglOHr6VRj4Vo2SLvnIKBA2B/pub?output=csv";

export default function Home() {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // MENGAMBIL DATA SPREADSHEET
  useEffect(() => {
    let active = true;
    let controller = null;

    const fetchData = async () => {
      if (controller) controller.abort();

      const request = new AbortController();
      controller = request;

      try {
        const url = `${SPREADSHEET_URL}&t=${Date.now()}`;

        const response = await fetch(url, {
          signal: request.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Gagal mengambil data Spreadsheet");
        }

        const csv = await response.text();

        const result = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) =>
            h.replace(/^\uFEFF/, "").trim().toLowerCase(),
        });

        const cleanData = result.data
          .map((b) => {
            const raw = String(
              b.jumlah_bed ?? ""
            ).trim();

            return {
              nomor: String(b.nomor ?? "").trim(),
              kelas: String(b.kelas ?? "").trim(),
              ruangan: String(b.ruangan ?? "").trim(),
              status: String(b.status ?? "")
                .trim()
                .toLowerCase(),
              lantai: String(b.lantai ?? "").trim(),
              bangsal: String(b.bangsal ?? "").trim(),
              jenis: String(b.jenis ?? "")
                .trim()
                .toLowerCase(),

              // KAPASITAS BED DARI SPREADSHEET
              jumlah_bed:
                raw === "" ? null : Number(raw),
            };
          })
          .filter(
            (b) =>
              b.nomor &&
              b.lantai &&
              b.bangsal &&
              (b.jumlah_bed === null ||
                (Number.isInteger(b.jumlah_bed) &&
                  b.jumlah_bed >= 0))
          );

        if (active) {
          setBeds(cleanData);
          setError("");
        }
      } catch (err) {
        if (err.name !== "AbortError" && active) {
          console.error(err);
          setError(
            "Gagal memperbarui data Spreadsheet."
          );
        }
      } finally {
        if (active && controller === request) {
          setLoading(false);
        }
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => {
      active = false;
      clearInterval(interval);
      if (controller) controller.abort();
    };
  }, []);

  // GROUPING LANTAI -> BANGSAL -> KAMAR
  const grouped = beds.reduce((acc, bed) => {
    const { lantai, bangsal, nomor } = bed;

    if (!acc[lantai]) acc[lantai] = {};

    if (!acc[lantai][bangsal]) {
      acc[lantai][bangsal] = {};
    }

    if (!acc[lantai][bangsal][nomor]) {
      acc[lantai][bangsal][nomor] = {
        jumlah_bed: null,
        rows: [],
      };
    }

    const kamar = acc[lantai][bangsal][nomor];

    // CUKUP AMBIL JUMLAH BED SEKALI
    if (bed.jumlah_bed !== null) {
      kamar.jumlah_bed = bed.jumlah_bed;
    }

    kamar.rows.push(bed);

    return acc;
  }, {});

  // BANGUN DATA KAMAR DARI KAPASITAS JUMLAH_BED
  const semuaKamar = [];

  Object.entries(grouped).forEach(
    ([lantai, bangsalList]) => {
      Object.entries(bangsalList).forEach(
        ([bangsal, kamarList]) => {
          Object.entries(kamarList).forEach(
            ([nomor, kamar]) => {
              // Jumlah bed ditentukan dari kolom
              // jumlah_bed, bukan jumlah baris
              const kapasitas = kamar.jumlah_bed ?? 0;

              const bedList = Array.from(
                { length: kapasitas },
                (_, index) => {
                  const row = kamar.rows[index];

                  return {
                    index: index + 1,
                    kelas: row?.kelas ||
                      kamar.rows[0]?.kelas || "",
                    ruangan: row?.ruangan ||
                      kamar.rows[0]?.ruangan || "",
                    jenis: row?.jenis ||
                      kamar.rows[0]?.jenis || "umum",
                    status:
                      row?.status === "kosong" ||
                      row?.status === "terisi"
                        ? row.status
                        : "belum ada data",
                  };
                }
              );

              semuaKamar.push({
                lantai,
                bangsal,
                nomor,
                kapasitas,
                beds: bedList,
                lebihBaris:
                  kamar.rows.length > kapasitas,
              });
            }
          );
        }
      );
    }
  );

  // STATISTIK BERDASARKAN KAPASITAS
  const totalBed = semuaKamar.reduce(
    (total, kamar) => total + kamar.kapasitas,
    0
  );

  const semuaBed = semuaKamar.flatMap(
    (kamar) => kamar.beds
  );

  const kosong = semuaBed.filter(
    (bed) => bed.status === "kosong"
  ).length;

  const terisi = semuaBed.filter(
    (bed) => bed.status === "terisi"
  ).length;

  const belumAdaData = semuaBed.filter(
    (bed) => bed.status === "belum ada data"
  ).length;

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

      {/* ERROR */}
      {error && (
        <div className="mb-5 bg-yellow-50 border border-yellow-300 text-yellow-800 p-4 rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {/* STATISTIK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">

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

      {/* PERINGATAN STATUS BELUM LENGKAP */}
      {belumAdaData > 0 && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          ⚠️ {belumAdaData} bed belum memiliki data status.
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <p className="text-center py-10 text-gray-500">
          Memuat data tempat tidur...
        </p>
      )}

      {/* DATA LANTAI */}
      {!loading &&
        Object.entries(grouped).map(
          ([lantai, bangsalList]) => (
            <div key={lantai} className="mb-12">

              <h2 className="text-2xl font-bold mb-5 text-gray-700">
                🏢 {lantai}
              </h2>

              {/* DATA BANGSAL */}
              {Object.entries(bangsalList).map(
                ([bangsal]) => {
                  const kamarDiBangsal = semuaKamar.filter(
                    (k) =>
                      k.lantai === lantai &&
                      k.bangsal === bangsal
                  );

                  return (
                    <div
                      key={bangsal}
                      className="bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-md mb-6"
                    >

                      <h3 className="text-lg font-semibold mb-6 text-gray-800">
                        🛏️ Bangsal {bangsal}
                      </h3>

                      {/* DATA KAMAR */}
                      {kamarDiBangsal.map((kamar) => (
                        <div
                          key={kamar.nomor}
                          className="mb-8"
                        >

                          <div className="mb-4">

                            <h4 className="text-lg font-bold text-gray-800">
                              Kamar {kamar.nomor}
                            </h4>

                            <span className="inline-block mt-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold">
                              🛏️ Jumlah Bed: {kamar.kapasitas}
                            </span>

                          </div>

                          {kamar.lebihBaris && (
                            <p className="mb-3 text-sm text-red-600">
                              ⚠️ Jumlah baris melebihi kapasitas
                              bed yang tercatat.
                            </p>
                          )}

                          {/* GRID BED */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

                            {kamar.beds.map((bed) => (
                              <div
                                key={bed.index}
                                className={`p-4 rounded-xl border shadow-md transition hover:scale-[1.03] ${
                                  bed.status === "kosong"
                                    ? "bg-green-50 border-green-300"
                                    : bed.status === "terisi"
                                    ? "bg-red-50 border-red-300"
                                    : "bg-yellow-50 border-yellow-300"
                                }`}
                              >

                                <p className="text-lg font-bold text-gray-800 mb-3">
                                  Bed {bed.index}
                                </p>

                                <p className="text-xs font-semibold text-gray-600 mb-2">
                                  {bed.kelas}
                                </p>

                                <p className="text-xs text-gray-500 mb-3">
                                  Ruangan: {bed.ruangan || "-"}
                                </p>

                                <span
                                  className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mb-3 ${
                                    bed.jenis === "laki-laki"
                                      ? "bg-blue-100 text-blue-600"
                                      : bed.jenis === "perempuan"
                                      ? "bg-pink-100 text-pink-600"
                                      : "bg-yellow-100 text-yellow-600"
                                  }`}
                                >
                                  {bed.jenis}
                                </span>

                                <div>
                                  <span
                                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold capitalize ${
                                      bed.status === "kosong"
                                        ? "bg-green-200 text-green-800"
                                        : bed.status === "terisi"
                                        ? "bg-red-200 text-red-800"
                                        : "bg-yellow-200 text-yellow-800"
                                    }`}
                                  >
                                    {bed.status}
                                  </span>
                                </div>

                              </div>
                            ))}

                          </div>

                        </div>
                      ))}

                    </div>
                  );
                }
              )}

            </div>
          )
        )}

      {!loading && beds.length === 0 && (
        <p className="text-center text-gray-500 py-10">
          Belum ada data tempat tidur.
        </p>
      )}

    </section>
  );
}
