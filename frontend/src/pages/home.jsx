import React, { useEffect, useState } from "react";
import Papa from "papaparse";

export default function Home() {
  const [beds, setBeds] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const url = `https://docs.google.com/spreadsheets/d/e/2PACX-1vSmz55GXbaiZ040aPDaLDLpApzFYtjYQ2431Qk9_bRD0bAl50f1zrVrBglOHr6VRj4Vo2SLvnIKBA2B/pub?output=csv&t=${Date.now()}`;

      const res = await fetch(url);
      const text = await res.text();

      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      });

      const cleanData = result.data
  .map((b) => ({
    nomor: (b.nomor || b.Nomor || b["nomor "] || "").trim(),
    kelas: (b.kelas || b.Kelas || "").trim(),
    ruangan: (b.ruangan || "").trim(),
    status: (b.status || "").toLowerCase().trim(),
    lantai: (b.lantai || "").trim(),
    bangsal: (b.bangsal || b["bangsal "] || "").trim(),
    jenis: (b.jenis || "").toLowerCase().trim(),
  }))
  .filter(
    (b) =>
      b.nomor !== "" &&
      b.status !== "" &&
      b.lantai !== "" &&
      b.bangsal !== ""
  );

      setBeds(cleanData);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 STATISTIK
  const kosong = beds.filter((b) => b.status === "kosong").length;
  const terisi = beds.filter((b) => b.status === "terisi").length;

  // 🔥 GROUPING
  const grouped = beds.reduce((acc, bed) => {
    if (!acc[bed.lantai]) acc[bed.lantai] = {};
    if (!acc[bed.lantai][bed.bangsal]) acc[bed.lantai][bed.bangsal] = {};
    if (!acc[bed.lantai][bed.bangsal][bed.jenis]) {
      acc[bed.lantai][bed.bangsal][bed.jenis] = [];
    }

    acc[bed.lantai][bed.bangsal][bed.jenis].push(bed);

    return acc;
  }, {});

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-6">

  {/* HEADER */}
  <div className="mb-8">
    <h1 className="text-3xl font-bold text-gray-800">
      🏥 Monitoring Bed Rumah Sakit
    </h1>
    <p className="text-gray-500 text-sm">
      Update realtime setiap 5 detik
    </p>
  </div>

  {/* STATISTIK */}
  <div className="grid md:grid-cols-3 gap-6 mb-10">
    <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-6 rounded-2xl shadow-lg">
      <p className="text-sm opacity-80">Bed Kosong</p>
      <h2 className="text-3xl font-bold">{kosong}</h2>
    </div>

    <div className="bg-gradient-to-r from-red-400 to-red-600 text-white p-6 rounded-2xl shadow-lg">
      <p className="text-sm opacity-80">Bed Terisi</p>
      <h2 className="text-3xl font-bold">{terisi}</h2>
    </div>

    <div className="bg-gradient-to-r from-blue-400 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
      <p className="text-sm opacity-80">Total Bed</p>
      <h2 className="text-3xl font-bold">{beds.length}</h2>
    </div>
  </div>

  {/* DATA */}
  {Object.keys(grouped).map((lantai) => (
    <div key={lantai} className="mb-12">
      <h2 className="text-2xl font-bold mb-4 text-gray-700">
        🏢 {lantai}
      </h2>

      {Object.keys(grouped[lantai]).map((bangsal) => (
        <div
          key={bangsal}
          className="bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-md mb-6"
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            🛏️ Bangsal {bangsal}
          </h3>

          {Object.keys(grouped[lantai][bangsal]).map((jenis) => (
            <div key={jenis} className="mb-6">
              <p className="mb-3 text-sm font-semibold text-gray-600 capitalize">
                {jenis}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {grouped[lantai][bangsal][jenis].map((bed, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl shadow-md border transition hover:scale-105 ${
                      bed.status === "kosong"
                        ? "bg-green-50 border-green-300"
                        : "bg-red-50 border-red-300"
                    }`}
                  >
                    {/* NOMOR */}
                    <p className="font-bold text-lg text-gray-800">
                      {bed.nomor}
                    </p>

                    {/* KELAS */}
                    <p className="text-xs text-gray-500 mb-2">
                      {bed.kelas}
                    </p>

                    {/* JENIS */}
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full font-semibold mb-2 ${
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
                        className={`px-2 py-1 text-xs rounded-full font-bold ${
                          bed.status === "kosong"
                            ? "bg-green-200 text-green-800"
                            : "bg-red-200 text-red-800"
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
      ))}
    </div>
  ))}
</section>
  );
}