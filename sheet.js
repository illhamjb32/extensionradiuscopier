export const SHEET_ID = "1XYkB8jX4X321SUYiQ7jMj2Mvra44VWT54AQh0-X2iEA";
export const SHEET_NAME = "Sheet1";

export const REGION_MAP = {
  RJKT: "JAKARTA",
  RJBB: "JAWA BARAT",
  RJBTG: "JAWA TENGAH",
  RJBT: "JAWA TIMUR",
  RBNT: "BALI",
  RSBU: "SUMATERA BAGIAN UTARA",
  RSBT: "SUMATERA BAGIAN TENGAH",
  RSBS: "SUMATERA BAGIAN SELATAN",
  RKAL: "KALIMANTAN",
  RINT: "SULAWESI"
};

const NORMALIZED_REGION_LOOKUP = Object.entries(REGION_MAP).reduce((acc, [code, name]) => {
  acc[normalize(name)] = code;
  acc[normalize(code)] = code;
  return acc;
}, {});

const REGION_ALIASES = {
  "JAWA BAGIAN TENGAH": "RJBTG",
  "JAWA BAGIAN TENGH": "RJBTG",
  "JAWA TENGH": "RJBTG",
  "JABAR": "RJBB",
  "JATENG": "RJBTG",
  "JATIM": "RJBT",
  "SUMBAGUT": "RSBU",
  "SUMBAGTENG": "RSBT",
  "SUMBAGSEL": "RSBS"
};

function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function getAllRegions() {
  return Object.entries(REGION_MAP).map(([code, name]) => ({ code, name }));
}

export function resolveRegionCode(rawRegion) {
  const key = normalize(rawRegion);
  if (!key) return null;

  if (NORMALIZED_REGION_LOOKUP[key]) {
    return NORMALIZED_REGION_LOOKUP[key];
  }

  if (REGION_ALIASES[key]) {
    return REGION_ALIASES[key];
  }

  if (key.includes("JAWA") && (key.includes("TENGAH") || key.includes("TENGH"))) {
    return "RJBTG";
  }

  if (key.includes("JAWA") && key.includes("BARAT")) {
    return "RJBB";
  }

  if (key.includes("JAWA") && key.includes("TIMUR")) {
    return "RJBT";
  }

  if (key.includes("SUMATERA") && key.includes("UTARA")) {
    return "RSBU";
  }

  if (key.includes("SUMATERA") && key.includes("TENGAH")) {
    return "RSBT";
  }

  if (key.includes("SUMATERA") && key.includes("SELATAN")) {
    return "RSBS";
  }

  if (key.includes("JAKARTA")) {
    return "RJKT";
  }

  if (key.includes("BALI")) {
    return "RBNT";
  }

  if (key.includes("KALIMANTAN")) {
    return "RKAL";
  }

  if (key.includes("SULAWESI")) {
    return "RINT";
  }

  return null;
}

function parseGvizResponse(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Format respon Google Sheet tidak dikenali.");
  }

  const json = JSON.parse(text.slice(start, end + 1));
  return json.table;
}

function pickHeaderIndex(headers, candidateNames) {
  const normalizedHeaders = headers.map((header) => normalize(header));
  const normalizedCandidates = candidateNames.map((name) => normalize(name));

  for (let i = 0; i < normalizedHeaders.length; i += 1) {
    if (normalizedCandidates.some((candidate) => normalizedHeaders[i].includes(candidate))) {
      return i;
    }
  }

  return -1;
}

function getCellValue(cell) {
  if (!cell) return "";
  if (typeof cell.f === "string" && cell.f.trim()) return cell.f.trim();
  if (cell.v === null || cell.v === undefined) return "";
  return String(cell.v).trim();
}

export async function fetchNasBngByRegionVlan(regionCode, vlan) {
  const safeRegionCode = resolveRegionCode(regionCode);
  if (!safeRegionCode) {
    throw new Error("Region tidak valid.");
  }

  const cleanVlan = String(vlan || "").trim();
  if (!/^\d+$/.test(cleanVlan)) {
    throw new Error("VLAN harus berupa angka.");
  }

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Gagal ambil data sheet ${SHEET_NAME}.`);
  }

  const text = await res.text();
  const table = parseGvizResponse(text);

  const headers = (table.cols || []).map((col) => col?.label || "");
  const regionIndex = pickHeaderIndex(headers, ["REGION"]);
  const vlanIndex = pickHeaderIndex(headers, ["VLAN"]);
  const nasIndex = pickHeaderIndex(headers, ["NAS"]);
  const bngIndex = pickHeaderIndex(headers, ["BNG"]);

  if ([regionIndex, vlanIndex, nasIndex, bngIndex].some((index) => index < 0)) {
    throw new Error(`Kolom REGION/VLAN/NAS/BNG tidak ditemukan di sheet ${SHEET_NAME}.`);
  }

  const rows = table.rows || [];

  for (const row of rows) {
    const cells = row.c || [];
    const currentRegionRaw = getCellValue(cells[regionIndex]);
    const currentRegionCode = resolveRegionCode(currentRegionRaw) || normalize(currentRegionRaw);
    const currentVlan = getCellValue(cells[vlanIndex]).replace(/\D/g, "");

    if (currentRegionCode === safeRegionCode && currentVlan === cleanVlan) {
      return {
        regionCode: safeRegionCode,
        regionName: REGION_MAP[safeRegionCode],
        vlan: cleanVlan,
        nas: getCellValue(cells[nasIndex]) || "-",
        bng: getCellValue(cells[bngIndex]) || "-"
      };
    }
  }

  return null;
}
