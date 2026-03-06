import { fetchNasBngByRegionVlan, getAllRegions, resolveRegionCode, REGION_MAP } from "./sheet.js";

const detectBtn = document.getElementById("detectBtn");
const searchBtn = document.getElementById("searchBtn");
const generateBtn = document.getElementById("generateBtn");
const copyRadiusBtn = document.getElementById("copyRadiusBtn");
const showSavedBtn = document.getElementById("showSavedBtn");
const regionSelect = document.getElementById("regionSelect");
const vlanInput = document.getElementById("vlanInput");
const nasValue = document.getElementById("nasValue");
const bngValue = document.getElementById("bngValue");
const radiusSection = document.getElementById("radiusSection");
const radiusOutput = document.getElementById("radiusOutput");
const savedSection = document.getElementById("savedSection");
const savedOutput = document.getElementById("savedOutput");
const statusText = document.getElementById("status");
const STORAGE_KEY = "LAST_GENERATED_RADIUS_DATA";

let latestResult = null;

const RADIUS_NAS_CANONICAL = [
  "BALI",
  "GARUT",
  "JABAR - BANDUNG",
  "JAKARTA",
  "JAKARTA - CAWANG",
  "JATENG - SEMARANG",
  "JATIM - MALANG",
  "JATIM - SURABAYA",
  "JOGJA - KENTUNGAN",
  "KALBAR - PONTIANAK",
  "NTB - MATARAM",
  "RIT - MAKASSAR",
  "RKAL - BANJARMASIN",
  "SULUT - MANADO",
  "SUMBAGSEL - JAMBI",
  "SUMBAGTENG - PAUHLIMO",
  "SUMBAGTENG - PEKANBARU",
  "SUMBAGUT - MEDAN",
  "UIK - ACEH"
];

const NAS_ALIAS_RULES = [
  { tokens: ["AURDURI", "JAMBI"], canonical: "SUMBAGSEL - JAMBI" },
  { tokens: ["SUMBAGSEL", "JAMBI"], canonical: "SUMBAGSEL - JAMBI" },
  { tokens: ["PEKANBARU"], canonical: "SUMBAGTENG - PEKANBARU" },
  { tokens: ["PAUHLIMO"], canonical: "SUMBAGTENG - PAUHLIMO" },
  { tokens: ["MEDAN"], canonical: "SUMBAGUT - MEDAN" },
  { tokens: ["ACEH"], canonical: "UIK - ACEH" },
  { tokens: ["MAKASSAR"], canonical: "RIT - MAKASSAR" },
  { tokens: ["BANJARMASIN"], canonical: "RKAL - BANJARMASIN" },
  { tokens: ["MANADO"], canonical: "SULUT - MANADO" },
  { tokens: ["MALANG"], canonical: "JATIM - MALANG" },
  { tokens: ["SURABAYA"], canonical: "JATIM - SURABAYA" },
  { tokens: ["SEMARANG"], canonical: "JATENG - SEMARANG" },
  { tokens: ["PONTIANAK"], canonical: "KALBAR - PONTIANAK" },
  { tokens: ["MATARAM"], canonical: "NTB - MATARAM" },
  { tokens: ["BANDUNG"], canonical: "JABAR - BANDUNG" },
  { tokens: ["GARUT"], canonical: "GARUT" },
  { tokens: ["CAWANG"], canonical: "JAKARTA - CAWANG" },
  { tokens: ["JAKARTA"], canonical: "JAKARTA" },
  { tokens: ["BALI"], canonical: "BALI" }
];

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#dc2626" : "inherit";
}

function populateRegions() {
  regionSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Pilih REGION --";
  regionSelect.appendChild(placeholder);

  getAllRegions().forEach(({ code, name }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} - ${name}`;
    regionSelect.appendChild(option);
  });

  regionSelect.value = "";
}

function updateResult(result) {
  latestResult = result;
  nasValue.textContent = result?.nas || "-";
  bngValue.textContent = result?.bng || "-";
}

function normalizeNasForRadius(rawNas) {
  const text = String(rawNas || "").trim().toUpperCase();
  if (!text || text === "-") return "-";

  const canonicalDirect = RADIUS_NAS_CANONICAL.find((item) => text === item);
  if (canonicalDirect) return canonicalDirect;

  for (const rule of NAS_ALIAS_RULES) {
    if (rule.tokens.every((token) => text.includes(token))) {
      return rule.canonical;
    }
  }

  return text;
}

function normalizePackageForRadius(rawPackage) {
  const text = String(rawPackage || "").trim().toUpperCase();
  if (!text || text === "-") return "-";

  const speedMatch = text.match(/(\d+)\s*(G|GB|GBPS|M|MB|MBPS)/);
  const speedValue = speedMatch ? speedMatch[1] : "";
  const speedUnit = speedMatch ? speedMatch[2] : "";

  if (!speedValue) {
    return text.replace(/\s+/g, " ").trim();
  }

  const normalizedUnit = speedUnit.startsWith("G") ? "GB" : "MB";

  if (text.includes("BIZ")) {
    return `ICONNETBIZ ${speedValue}${normalizedUnit}`;
  }

  if (text.includes("QRET")) {
    return `QRET-${speedValue}${normalizedUnit}`;
  }

  if (text.includes("JUNIPER")) {
    return `JUNIPER-${speedValue}${normalizedUnit}`;
  }

  return `PAKET-${speedValue}${normalizedUnit}`;
}

async function saveGeneratedRadiusData(payload) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      ...payload,
      savedAt: new Date().toISOString()
    }
  });
}

async function getSavedRadiusData() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result?.[STORAGE_KEY] || null;
}

function formatSavedData(data) {
  if (!data) return "Belum ada data tersimpan.";

  return [
    `USERNAME=${data.username || "-"}`,
    `PASSWORD=${data.password || "-"}`,
    `NAME=${data.name || "-"}`,
    `SID=${data.sid || "-"}`,
    `REGION=${data.region || "-"}`,
    `ONT_NUMBER=${data.ontNumber || "-"}`,
    `PACKAGE=${data.packageName || "-"}`,
    `NAS=${data.nas || "-"}`,
    `BNG=${data.bng || "-"}`,
    `REMARK=${data.remark || "-"}`
  ].join("\n");
}

async function detectRegionVlanFromPage() {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return { regionCode: "", vlan: "" };
  }

  const response = await chrome.tabs.sendMessage(tabId, { type: "DETECT_VLAN_REGION" });
  if (!response?.ok) {
    return { regionCode: "", vlan: "" };
  }

  const regionCode = resolveRegionCode(response.data?.region) || "";
  const vlan = String(response.data?.vlan || "").replace(/\D/g, "");
  return { regionCode, vlan };
}

async function getNasBngForRadiusData(customer) {
  let nas = latestResult?.nas || customer.routerNas || "-";
  let bng = latestResult?.bng || "-";

  let regionCode = resolveRegionCode(customer.region) || regionSelect.value || "";
  let vlan = String(vlanInput.value || "").replace(/\D/g, "");

  if (!regionCode || !vlan) {
    const detected = await detectRegionVlanFromPage();
    regionCode = regionCode || detected.regionCode;
    vlan = vlan || detected.vlan;
  }

  if (regionCode && /^\d+$/.test(vlan)) {
    const sheetResult = await fetchNasBngByRegionVlan(regionCode, vlan);
    if (sheetResult) {
      nas = sheetResult.nas || nas;
      bng = sheetResult.bng || bng;
    }
  }

  return { nas, bng };
}

function extractOltName(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text || text === "-") return "";

  const splitByDash = text.match(/^\s*(?:\d{1,3}(?:\.\d{1,3}){3})\s*-\s*(.+)$/);
  if (splitByDash && splitByDash[1]) {
    return splitByDash[1].trim();
  }

  const withoutIp = text.replace(/^\s*\d{1,3}(?:\.\d{1,3}){3}\s*/, "").replace(/^[-:_\s]+/, "").trim();
  const candidate = withoutIp || text;

  const looksValid =
    /[A-Z]/i.test(candidate) &&
    candidate.length >= 8 &&
    !/^\d+$/.test(candidate) &&
    (candidate.includes("OLT") || candidate.includes("-") || candidate.includes("."));

  return looksValid ? candidate : "";
}

function normalizeOntNumber(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text || text === "-") return "-";

  const noLeadingDash = text.replace(/^[-\s]+/, "").trim();
  const splitByDash = noLeadingDash.split(/\s*-\s*/).map((part) => part.trim()).filter(Boolean);

  if (splitByDash.length >= 2) {
    return splitByDash[splitByDash.length - 1];
  }

  return noLeadingDash;
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function detectFromActivePage() {
  const tabId = await getActiveTabId();
  if (!tabId) throw new Error("Tab aktif tidak ditemukan.");

  const response = await chrome.tabs.sendMessage(tabId, { type: "DETECT_VLAN_REGION" });
  if (!response?.ok) throw new Error("Gagal baca data dari halaman.");

  const { vlan, region } = response.data || {};
  if (vlan) vlanInput.value = vlan;

  const regionCode = resolveRegionCode(region);
  if (regionCode) {
    regionSelect.value = regionCode;
  } else {
    regionSelect.value = "";
  }

  if (!vlan && !regionCode) {
    setStatus("VLAN/REGION belum terdeteksi otomatis.", true);
  } else {
    setStatus(`Terdeteksi: VLAN ${vlan || "-"}, REGION ${regionCode ? REGION_MAP[regionCode] : "-"}.`);
  }
}

async function searchData() {
  const regionCode = regionSelect.value;
  const vlan = vlanInput.value.trim();

  if (!regionCode) {
    setStatus("Pilih REGION dulu.", true);
    return;
  }

  if (!/^\d+$/.test(vlan)) {
    setStatus("VLAN harus angka.", true);
    return;
  }

  setStatus("Mencari data NAS/BNG...");

  const result = await fetchNasBngByRegionVlan(regionCode, vlan);
  if (!result) {
    updateResult(null);
    setStatus(`Data tidak ditemukan di sheet ${regionCode} untuk VLAN ${vlan}.`, true);
    return;
  }

  updateResult(result);
  setStatus(`Ditemukan: NAS ${result.nas}, BNG ${result.bng}.`);
}

async function generateRadiusData() {
  radiusSection.classList.remove("is-hidden");

  const tabId = await getActiveTabId();
  if (!tabId) {
    setStatus("Tab aktif tidak ditemukan.", true);
    return;
  }

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "GET_ICRM_CUSTOMER_DATA"
  });

  if (!response?.ok) {
    setStatus("Gagal ambil data iCRM dari halaman.", true);
    return;
  }

  const customer = response.data || {};
  const { nas, bng } = await getNasBngForRadiusData(customer);
  const radiusNas = normalizeNasForRadius(nas);
  const radiusRegion = radiusNas;
  const radiusPackage = normalizePackageForRadius(customer.packageName);
  const sid = customer.radiusFirstname || customer.sid || "-";
  const ontNumber = normalizeOntNumber(customer.serialNumber || customer.ontNumber || "-");
  const oltName = extractOltName(customer.oltEndpoint || "");
  const remark = sid !== "-" && oltName ? `${sid}_${oltName}` : (customer.remark || "-");

  const output = [
    `USERNAME=${customer.radiusUsername || "-"}`,
    `PASSWORD=${customer.radiusPassword || customer.password || "-"}`,
    `NAME=${customer.applicantName || "-"}`,
    `SID=${sid}`,
    `REGION=${radiusRegion}`,
    `ONT_NUMBER=${ontNumber}`,
    `PACKAGE=${radiusPackage}`,
    `NAS=${radiusNas}`,
    `BNG=${bng}`,
    `REMARK=${remark}`
  ].join("\n");

  const payload = {
    username: customer.radiusUsername || "-",
    password: customer.radiusPassword || customer.password || "-",
    name: customer.applicantName || "-",
    sid,
    region: radiusRegion,
    ontNumber,
    packageName: radiusPackage,
    nas: radiusNas,
    bng: bng || "-",
    remark
  };

  radiusOutput.value = output;
  await saveGeneratedRadiusData(payload);
  setStatus("Radius data berhasil di-generate dan disimpan.");
}

async function showSavedData() {
  const savedData = await getSavedRadiusData();
  savedSection.classList.remove("is-hidden");
  savedOutput.value = formatSavedData(savedData);
  setStatus(savedData ? "Data tersimpan ditampilkan." : "Belum ada data tersimpan.", !savedData);
}

async function copyRadiusFromExistingPage() {
  const tabId = await getActiveTabId();
  if (!tabId) {
    setStatus("Tab aktif tidak ditemukan.", true);
    return;
  }

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "GET_EXISTING_RADIUS_DATA"
  });

  if (!response?.ok || !response?.data) {
    setStatus("Buka halaman /customer/user/edit?id=... lalu klik Copy Radius.", true);
    return;
  }

  const rawNas = String(response.data.nas || "").trim().toUpperCase();
  const invalidNas = !rawNas || rawNas === "-" || rawNas === "FUP" || rawNas === "--CHOOSE--";
  const radiusNas = normalizeNasForRadius(invalidNas ? (response.data.region || "-") : response.data.nas || "-");
  const copiedPayload = {
    username: response.data.username || "-",
    password: response.data.password || "-",
    name: response.data.name || "-",
    sid: response.data.sid || "-",
    region: radiusNas,
    ontNumber: normalizeOntNumber(response.data.ontNumber || "-"),
    packageName: response.data.packageName || "-",
    nas: radiusNas,
    bng: response.data.bng || "-",
    remark: response.data.remark || "-"
  };

  await saveGeneratedRadiusData(copiedPayload);
  savedSection.classList.remove("is-hidden");
  savedOutput.value = formatSavedData(copiedPayload);
  setStatus("Data radius existing berhasil di-copy dan disimpan.");
}

populateRegions();

detectBtn.addEventListener("click", async () => {
  try {
    await detectFromActivePage();
  } catch (error) {
    setStatus(error.message || "Gagal deteksi dari halaman.", true);
  }
});

searchBtn.addEventListener("click", async () => {
  try {
    await searchData();
  } catch (error) {
    setStatus(error.message || "Terjadi kesalahan saat mencari.", true);
  }
});

generateBtn.addEventListener("click", async () => {
  try {
    await generateRadiusData();
  } catch (error) {
    setStatus(error.message || "Terjadi kesalahan saat generate data.", true);
  }
});

copyRadiusBtn.addEventListener("click", async () => {
  try {
    await copyRadiusFromExistingPage();
  } catch (error) {
    setStatus(error.message || "Terjadi kesalahan saat copy radius.", true);
  }
});

showSavedBtn.addEventListener("click", async () => {
  try {
    await showSavedData();
  } catch (error) {
    setStatus(error.message || "Terjadi kesalahan saat menampilkan data.", true);
  }
});

(async () => {
  try {
    await detectFromActivePage();
  } catch {
    setStatus('Klik "Deteksi dari halaman" atau isi manual VLAN/REGION.');
  }
})();
