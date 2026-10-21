
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method tidak diizinkan",
    });
  }

  try {
    const API_URL = process.env.APPS_SCRIPT_URL;

    if (!API_URL) {
      throw new Error("APPS_SCRIPT_URL belum diatur");
    }

    const url = new URL(API_URL);
    url.searchParams.set("t", Date.now().toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(
        `Apps Script HTTP ${response.status}`
      );
    }

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        "Apps Script tidak mengembalikan JSON"
      );
    }

    if (
      result.success !== true ||
      !Array.isArray(result.data)
    ) {
      throw new Error(
        result.error || "Format data tidak valid"
      );
    }

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json(result);

  } catch (error) {
    console.error("API Beds Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
