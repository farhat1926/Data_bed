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

      const cleanData = result.data.map((b) => ({
  nomor: (b.nomor || b.Nomor || b["nomor "] || "").trim(),
  kelas: (b.kelas || b.Kelas || "").trim(),
  ruangan: (b.ruangan || "").trim(),
  status: (b.status || "").toLowerCase().trim(),

  lantai: (b.lantai || "").trim(),
  bangsal: (b.bangsal || b["bangsal "] || "").trim(),
  jenis: (b.jenis || "").trim(),
}));

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
    <section className="min-h-screen bg-gray-50 p-6">

      {/* HEADER */}
      <h1 className="text-2xl font-bold mb-2">
        Monitoring Ketersediaan Tempat Tidur
      </h1>

      {/* STATISTIK */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-green-100 p-4 rounded-xl">
          <p>Bed Kosong</p>
          <h2 className="text-2xl font-bold">{kosong}</h2>
        </div>

        <div className="bg-red-100 p-4 rounded-xl">
          <p>Bed Terisi</p>
          <h2 className="text-2xl font-bold">{terisi}</h2>
        </div>

        <div className="bg-blue-100 p-4 rounded-xl">
          <p>Total</p>
          <h2 className="text-2xl font-bold">{beds.length}</h2>
        </div>
      </div>

      {/* 🔥 RENDER DINAMIS */}
      {Object.keys(grouped).map((lantai) => (
        <div key={lantai} className="mb-10">
          <h2 className="text-xl font-bold mb-4">{lantai}</h2>

          {Object.keys(grouped[lantai]).map((bangsal) => (
            <div key={bangsal} className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                Bangsal {bangsal}
              </h3>

              {Object.keys(grouped[lantai][bangsal]).map((jenis) => (
                <div key={jenis} className="mb-4">
                  <p className="font-medium mb-2">{jenis}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {grouped[lantai][bangsal][jenis].map((bed, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded border ${
                          bed.status === "kosong"
                            ? "bg-green-100 border-green-400"
                            : "bg-red-100 border-red-400"
                        }`}
                      >
                        <p className="font-semibold">{bed.nomor}</p>
                        <p className="text-sm text-gray-600">
                          {bed.kelas}
                        </p>
                        <span className="text-xs">
                          {bed.status}
                        </span>
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