function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function extractFieldValueByCaption(captions) {
  const lines = String(document.body?.innerText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedCaptions = captions.map((caption) => normalize(caption));

  for (let i = 0; i < lines.length; i += 1) {
    const normalizedLine = normalize(lines[i]);
    if (!normalizedCaptions.some((caption) => normalizedLine === caption || normalizedLine.includes(caption))) {
      continue;
    }

    for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
      const candidate = lines[j].trim();
      if (!candidate) continue;

      const normalizedCandidate = normalize(candidate);
      if (normalizedCaptions.some((caption) => normalizedCandidate === caption)) continue;
      if (normalizedCandidate === "-" || normalizedCandidate === "--") continue;
      return candidate;
    }
  }

  return "";
}

function getInputLikeValue(el) {
  if (!el) return "";
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
    return (el.value || "").trim();
  }
  return (el.textContent || "").trim();
}

function findByLabelText(labelNeedle) {
  const labels = Array.from(document.querySelectorAll("label"));
  const foundLabel = labels.find((label) => normalize(label.textContent).includes(normalize(labelNeedle)));

  if (foundLabel) {
    const htmlFor = foundLabel.getAttribute("for");
    if (htmlFor) {
      const target = document.getElementById(htmlFor);
      if (target) return target;
    }

    const parent = foundLabel.closest("div, td, th, form, section") || foundLabel.parentElement;
    if (parent) {
      const candidate = parent.querySelector("input, textarea, select");
      if (candidate) return candidate;
    }
  }

  const allCandidates = Array.from(document.querySelectorAll("input, textarea, select"));
  return allCandidates.find((element) => {
    const attrs = [element.name, element.id, element.placeholder, element.getAttribute("aria-label")]
      .filter(Boolean)
      .map(normalize);
    return attrs.some((attr) => attr.includes(normalize(labelNeedle)));
  });
}

function extractRegionFromText() {
  const nearCaption = extractFieldValueByCaption(["REGION", "REGIONAL"]);
  if (nearCaption) return nearCaption;

  const bodyText = normalize(document.body?.innerText || "");
  const knownRegions = [
    "JAKARTA",
    "JAWA BARAT",
    "JAWA TENGAH",
    "JAWA BAGIAN TENGAH",
    "JAWA BAGIAN TENGH",
    "JAWA TIMUR",
    "BALI",
    "SUMATERA BAGIAN UTARA",
    "SUMATERA BAGIAN TENGAH",
    "SUMATERA BAGIAN SELATAN",
    "KALIMANTAN",
    "SULAWESI"
  ];

  for (const region of knownRegions) {
    if (bodyText.includes(region)) return region;
  }

  return "";
}

function extractVlanFromText() {
  const nearCaption = extractFieldValueByCaption(["VLAN"]);
  if (nearCaption) {
    const nearCaptionDigits = nearCaption.match(/\d{1,5}/);
    if (nearCaptionDigits) return nearCaptionDigits[0];
  }

  const bodyText = document.body?.innerText || "";
  const match = bodyText.match(/\bVLAN\b\s*[:\-]?\s*(\d{1,5})/i);
  return match ? match[1] : "";
}

function detectFromPage() {
  const vlanInput = findByLabelText("VLAN");
  const regionInput = findByLabelText("REGION") || findByLabelText("REGIONAL");

  const vlan = getInputLikeValue(vlanInput) || extractVlanFromText();
  const region = getInputLikeValue(regionInput) || extractRegionFromText();

  return {
    vlan: String(vlan || "").replace(/\D/g, ""),
    region: normalize(region)
  };
}

function setInputValue(input, value) {
  if (!input) return false;

  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const tagName = input.tagName;

  if (tagName === "INPUT" && nativeSetter) {
    nativeSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function fillNasBngOnPage({ nas, bng }) {
  const nasInput = findByLabelText("NAS");
  const bngInput = findByLabelText("BNG");

  const nasFilled = nasInput ? setInputValue(nasInput, nas || "") : false;
  const bngFilled = bngInput ? setInputValue(bngInput, bng || "") : false;

  return { nasFilled, bngFilled };
}

function getFieldValue(labelCandidates) {
  for (const label of labelCandidates) {
    const input = findByLabelText(label);
    const value = getInputLikeValue(input);
    if (value) return value;
  }

  const fromText = extractFieldValueByCaption(labelCandidates);
  return fromText || "";
}

function getFormFieldValue(labelCandidates) {
  for (const label of labelCandidates) {
    const input = findByLabelText(label);
    if (!input) continue;

    const value = getInputLikeValue(input);
    if (value && value !== "--Choose--" && value !== "--Choose--") {
      return value;
    }
  }

  return "";
}

function getFieldValueMatchingPattern(labelCandidates, pattern) {
  for (const label of labelCandidates) {
    const input = findByLabelText(label);
    const value = getInputLikeValue(input);
    if (value && pattern.test(String(value))) return value;
  }

  const fromText = extractFieldValueByCaption(labelCandidates);
  if (fromText && pattern.test(String(fromText))) return fromText;

  return "";
}

function getIcrmCustomerData() {
  const applicantName = getFieldValue(["NAMA PEMOHON", "NAMA CUSTOMER", "NAMA PELANGGAN", "PEMOHON"]);
  const sid = getFieldValue(["SID", "ID PA", "IDPEL", "ID PELANGGAN"]);
  const radiusFirstname = getFieldValue(["RADIUS FIRSTNAME", "FIRSTNAME RADIUS", "FIRSTNAME"]);
  const region = getFieldValue(["REGION", "REGIONAL"]);
  const oltEndpoint =
    getFieldValueMatchingPattern(["IP OLT", "OLT", "OLT NAME", "NAMA OLT"], /\d{1,3}(?:\.\d{1,3}){3}\s*-\s*.+OLT-\d+/i) ||
    extractOltEndpointFromLayout();
  const ipRadius = getFieldValue(["IP RADIUS", "RADIUS IP"]);
  const routerNas = getFieldValue(["ROUTER / NAS", "ROUTER/NAS", "NAS"]);
  const serialNumber = getFieldValue(["BRAND - SN", "SN", "SERIAL NUMBER", "SERIAL", "ONT SN"]);
  const ontNumber = getFieldValue(["ONT NUMBER", "ONT", "ONT ID"]);
  const packageName = getFieldValue(["PACKAGE", "PRODUK"]);
  const radiusUsername = getFieldValue(["RADIUS USERNAME", "USERNAME RADIUS"]);
  const radiusPassword = getFieldValue(["RADIUS PASSWORD", "PASSWORD RADIUS"]);
  const password = getFieldValue(["PASSWORD"]);
  const remark = getFieldValue(["REMARK", "CATATAN"]);

  return {
    applicantName,
    sid,
    radiusFirstname,
    region,
    oltEndpoint,
    ipRadius,
    routerNas,
    serialNumber,
    ontNumber,
    packageName,
    radiusUsername,
    radiusPassword,
    password,
    remark
  };
}

function extractOltEndpointFromLayout() {
  const inputCandidates = Array.from(document.querySelectorAll("input, textarea, select"));
  for (const input of inputCandidates) {
    const value = getInputLikeValue(input);
    if (/\d{1,3}(?:\.\d{1,3}){3}\s*-\s*.+OLT-\d+/i.test(value)) {
      return value;
    }
  }

  const lines = String(document.body?.innerText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const radiusTypeIndex = lines.findIndex((line) => normalize(line).includes("RADIUS TYPE"));
  if (radiusTypeIndex > 0) {
    for (let i = radiusTypeIndex - 1; i >= Math.max(0, radiusTypeIndex - 4); i -= 1) {
      const candidate = lines[i];
      if (/\d{1,3}(?:\.\d{1,3}){3}\s*-\s*.+/i.test(candidate)) {
        return candidate;
      }
    }
  }

  const direct = lines.find((line) => /\d{1,3}(?:\.\d{1,3}){3}\s*-\s*.+OLT-\d+/i.test(line));
  return direct || "";
}

function isRadiusEditPage() {
  return window.location.origin === "http://127.0.0.1:11056" && window.location.pathname.startsWith("/customer/user/edit");
}

function getExistingRadiusData() {
  if (!isRadiusEditPage()) {
    return null;
  }

  const name = getFormFieldValue(["NAME", "NAMA"]);
  const sid = getFormFieldValue(["SID"]);
  const region = getFormFieldValue(["REGION"]);
  const ontNumber = getFormFieldValue(["ONT NUMBER", "ONT", "ONT ID"]);
  const packageName = getFormFieldValue(["PACKAGE", "PRODUK"]);
  const nas = getFormFieldValue(["ROUTER / NAS", "ROUTER/NAS", "NAS"]);
  const password = getFormFieldValue(["PASSWORD"]);
  const remark = getFormFieldValue(["REMARK", "CATATAN"]);

  return {
    username: sid || "",
    password,
    name,
    sid,
    region,
    ontNumber,
    packageName,
    nas,
    bng: "",
    remark
  };
}

const REGISTER_STORAGE_KEY = "LAST_GENERATED_RADIUS_DATA";

function isLocalRegisterPage() {
  return window.location.origin === "http://127.0.0.1:11056" && window.location.pathname.startsWith("/customer/register");
}

function getStoredRadiusData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([REGISTER_STORAGE_KEY], (result) => {
      resolve(result?.[REGISTER_STORAGE_KEY] || null);
    });
  });
}

function setSelectValueByText(selectEl, targetText) {
  if (!selectEl || !targetText) return false;

  const target = normalize(targetText);
  const options = Array.from(selectEl.options || []);
  if (!options.length) return false;

  let chosen = options.find((option) => normalize(option.textContent) === target || normalize(option.value) === target);

  if (!chosen) {
    chosen = options.find((option) => {
      const optionText = normalize(option.textContent);
      return optionText.includes(target) || target.includes(optionText);
    });
  }

  if (!chosen) {
    const tokens = target
      .split(/[^A-Z0-9]+/)
      .filter((token) => token.length > 1);

    let bestScore = 0;
    for (const option of options) {
      const optionText = normalize(option.textContent);
      const score = tokens.reduce((acc, token) => (optionText.includes(token) ? acc + 1 : acc), 0);
      if (score > bestScore) {
        bestScore = score;
        chosen = option;
      }
    }

    if (bestScore === 0) {
      chosen = null;
    }
  }

  if (!chosen) return false;

  selectEl.value = chosen.value;
  selectEl.dispatchEvent(new Event("input", { bubbles: true }));
  selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setFieldByLabels(labels, value) {
  if (!value || value === "-") return false;

  for (const label of labels) {
    const field = findByLabelText(label);
    if (!field) continue;

    if (field.tagName === "SELECT") {
      if (setSelectValueByText(field, value)) return true;
      continue;
    }

    if (setInputValue(field, value)) return true;
  }

  return false;
}

function pasteRadiusDataToRegisterForm(data) {
  const results = {
    name: setFieldByLabels(["NAME", "NAMA"], data.name),
    sid: setFieldByLabels(["SID"], data.sid),
    region: setFieldByLabels(["REGION"], data.region),
    nas: setFieldByLabels(["ROUTER / NAS", "ROUTER/NAS", "NAS"], data.nas),
    ontNumber: setFieldByLabels(["ONT NUMBER", "ONT", "ONT ID"], data.ontNumber),
    packageName: setFieldByLabels(["PACKAGE", "PRODUK"], data.packageName),
    password: setFieldByLabels(["PASSWORD"], data.password),
    remark: setFieldByLabels(["REMARK", "CATATAN"], data.remark)
  };

  return Object.values(results).some(Boolean);
}

function createRegisterHelperPanel(data) {
  if (document.getElementById("radius-helper-launcher")) return;

  const launcher = document.createElement("button");
  launcher.id = "radius-helper-launcher";
  launcher.textContent = "Data Tersimpan";
  launcher.style.position = "fixed";
  launcher.style.right = "16px";
  launcher.style.bottom = "16px";
  launcher.style.zIndex = "2147483646";
  launcher.style.padding = "9px 12px";
  launcher.style.borderRadius = "999px";
  launcher.style.border = "1px solid #0ea5e9";
  launcher.style.background = "#082f49";
  launcher.style.color = "#e0f2fe";
  launcher.style.fontWeight = "700";
  launcher.style.cursor = "pointer";

  const panel = document.createElement("div");
  panel.id = "radius-helper-panel";
  panel.style.position = "fixed";
  panel.style.right = "16px";
  panel.style.bottom = "16px";
  panel.style.width = "320px";
  panel.style.maxHeight = "60vh";
  panel.style.overflow = "auto";
  panel.style.zIndex = "2147483647";
  panel.style.background = "#0f172a";
  panel.style.color = "#f8fafc";
  panel.style.border = "1px solid #334155";
  panel.style.borderRadius = "10px";
  panel.style.padding = "10px";
  panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
  panel.style.fontFamily = "Arial, sans-serif";
  panel.style.display = "none";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "8px";

  const title = document.createElement("div");
  title.textContent = "Radius Data Tersimpan";
  title.style.fontWeight = "700";
  title.style.color = "#f8fafc";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.padding = "4px 8px";
  closeBtn.style.borderRadius = "6px";
  closeBtn.style.border = "1px solid #64748b";
  closeBtn.style.background = "#1e293b";
  closeBtn.style.color = "#e2e8f0";
  closeBtn.style.cursor = "pointer";

  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
    launcher.style.display = "block";
  });

  launcher.addEventListener("click", () => {
    panel.style.display = "block";
    launcher.style.display = "none";
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement("pre");
  body.style.whiteSpace = "pre-wrap";
  body.style.wordBreak = "break-word";
  body.style.fontSize = "12px";
  body.style.lineHeight = "1.45";
  body.style.color = "#e2e8f0";
  body.style.margin = "0";
  body.style.padding = "8px";
  body.style.borderRadius = "8px";
  body.style.border = "1px solid #334155";
  body.style.background = "#1e293b";

  if (data) {
    body.textContent = [
      `NAME=${data.name || "-"}`,
      `SID=${data.sid || "-"}`,
      `REGION=${data.region || "-"}`,
      `ONT_NUMBER=${data.ontNumber || "-"}`,
      `PACKAGE=${data.packageName || "-"}`,
      `NAS=${data.nas || "-"}`,
      `PASSWORD=${data.password || "-"}`,
      `REMARK=${data.remark || "-"}`
    ].join("\n");
  } else {
    body.textContent = "Belum ada data generate. Buka iCRM lalu klik Generate Radius Data terlebih dulu.";
  }

  const action = document.createElement("button");
  action.textContent = "Paste Data";
  action.style.marginTop = "8px";
  action.style.width = "100%";
  action.style.padding = "8px 10px";
  action.style.borderRadius = "8px";
  action.style.border = "1px solid #10b981";
  action.style.background = "#059669";
  action.style.color = "#fff";
  action.style.fontWeight = "700";
  action.style.cursor = "pointer";
  action.disabled = !data;
  action.style.opacity = data ? "1" : "0.5";

  action.addEventListener("click", () => {
    if (!data) return;
    const ok = pasteRadiusDataToRegisterForm(data);
    action.textContent = ok ? "Paste Berhasil" : "Sebagian field tidak ditemukan";
  });

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(action);
  document.body.appendChild(launcher);
  document.body.appendChild(panel);
}

async function initRegisterHelper() {
  if (!isLocalRegisterPage()) return;
  const data = await getStoredRadiusData();
  createRegisterHelperPanel(data);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "DETECT_VLAN_REGION") {
    sendResponse({ ok: true, data: detectFromPage() });
    return;
  }

  if (message?.type === "FILL_NAS_BNG") {
    const result = fillNasBngOnPage(message.payload || {});
    sendResponse({ ok: true, data: result });
    return;
  }

  if (message?.type === "GET_ICRM_CUSTOMER_DATA") {
    const result = getIcrmCustomerData();
    sendResponse({ ok: true, data: result });
    return;
  }

  if (message?.type === "GET_EXISTING_RADIUS_DATA") {
    const result = getExistingRadiusData();
    sendResponse({ ok: Boolean(result), data: result || null });
    return;
  }

  if (message?.type === "PASTE_SAVED_RADIUS_DATA") {
    const pasted = pasteRadiusDataToRegisterForm(message.payload || {});
    sendResponse({ ok: true, data: { pasted } });
  }
});

initRegisterHelper();
