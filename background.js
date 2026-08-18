const ICRM_URL = "https://icrmplus.iconpln.co.id/";
const ALARM_NAME = "icrm-keepalive";
const INTERVAL_MINUTES = 4;
const STORAGE_KEY_ENABLED = "KEEPALIVE_ENABLED";
const STORAGE_KEY_LAST_PING = "KEEPALIVE_LAST_PING";
const STORAGE_KEY_STATUS = "KEEPALIVE_STATUS";

const RADIUS_URL = "http://127.0.0.1:11056/";
const RADIUS_ALARM_NAME = "radius-keepalive";
const RADIUS_STORAGE_KEY_ENABLED = "RADIUS_KEEPALIVE_ENABLED";
const RADIUS_STORAGE_KEY_LAST_PING = "RADIUS_KEEPALIVE_LAST_PING";
const RADIUS_STORAGE_KEY_STATUS = "RADIUS_KEEPALIVE_STATUS";

async function isKeepaliveEnabled() {
  const result = await chrome.storage.local.get(STORAGE_KEY_ENABLED);
  return result[STORAGE_KEY_ENABLED] === true;
}

async function isRadiusKeepaliveEnabled() {
  const result = await chrome.storage.local.get(RADIUS_STORAGE_KEY_ENABLED);
  return result[RADIUS_STORAGE_KEY_ENABLED] === true;
}

async function pingIcrm() {
  try {
    const response = await fetch(ICRM_URL, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });

    const status = response.ok ? "ok" : `http-${response.status}`;
    await chrome.storage.local.set({
      [STORAGE_KEY_LAST_PING]: new Date().toISOString(),
      [STORAGE_KEY_STATUS]: status
    });
  } catch {
    await chrome.storage.local.set({
      [STORAGE_KEY_LAST_PING]: new Date().toISOString(),
      [STORAGE_KEY_STATUS]: "error"
    });
  }
}

async function pingRadius() {
  try {
    const response = await fetch(RADIUS_URL, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });

    const status = response.ok ? "ok" : `http-${response.status}`;
    await chrome.storage.local.set({
      [RADIUS_STORAGE_KEY_LAST_PING]: new Date().toISOString(),
      [RADIUS_STORAGE_KEY_STATUS]: status
    });
  } catch {
    await chrome.storage.local.set({
      [RADIUS_STORAGE_KEY_LAST_PING]: new Date().toISOString(),
      [RADIUS_STORAGE_KEY_STATUS]: "error"
    });
  }
}

async function startKeepalive() {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.1,
    periodInMinutes: INTERVAL_MINUTES
  });
  await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: true });
}

async function stopKeepalive() {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.set({
    [STORAGE_KEY_ENABLED]: false,
    [STORAGE_KEY_STATUS]: "off"
  });
}

async function startRadiusKeepalive() {
  await chrome.alarms.clear(RADIUS_ALARM_NAME);
  await chrome.alarms.create(RADIUS_ALARM_NAME, {
    delayInMinutes: 0.1,
    periodInMinutes: INTERVAL_MINUTES
  });
  await chrome.storage.local.set({ [RADIUS_STORAGE_KEY_ENABLED]: true });
}

async function stopRadiusKeepalive() {
  await chrome.alarms.clear(RADIUS_ALARM_NAME);
  await chrome.storage.local.set({
    [RADIUS_STORAGE_KEY_ENABLED]: false,
    [RADIUS_STORAGE_KEY_STATUS]: "off"
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    const enabled = await isKeepaliveEnabled();
    if (enabled) await pingIcrm();
  } else if (alarm.name === RADIUS_ALARM_NAME) {
    const enabled = await isRadiusKeepaliveEnabled();
    if (enabled) await pingRadius();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "KEEPALIVE_START") {
    startKeepalive().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "KEEPALIVE_STOP") {
    stopKeepalive().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "KEEPALIVE_GET_STATUS") {
    chrome.storage.local
      .get([STORAGE_KEY_ENABLED, STORAGE_KEY_LAST_PING, STORAGE_KEY_STATUS])
      .then((result) => {
        sendResponse({
          ok: true,
          enabled: result[STORAGE_KEY_ENABLED] === true,
          lastPing: result[STORAGE_KEY_LAST_PING] || null,
          status: result[STORAGE_KEY_STATUS] || "off"
        });
      });
    return true;
  }
  if (message?.type === "RADIUS_KEEPALIVE_START") {
    startRadiusKeepalive().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "RADIUS_KEEPALIVE_STOP") {
    stopRadiusKeepalive().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "RADIUS_KEEPALIVE_GET_STATUS") {
    chrome.storage.local
      .get([RADIUS_STORAGE_KEY_ENABLED, RADIUS_STORAGE_KEY_LAST_PING, RADIUS_STORAGE_KEY_STATUS])
      .then((result) => {
        sendResponse({
          ok: true,
          enabled: result[RADIUS_STORAGE_KEY_ENABLED] === true,
          lastPing: result[RADIUS_STORAGE_KEY_LAST_PING] || null,
          status: result[RADIUS_STORAGE_KEY_STATUS] || "off"
        });
      });
    return true;
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const enabled = await isKeepaliveEnabled();
  if (enabled) await startKeepalive();
  const radiusEnabled = await isRadiusKeepaliveEnabled();
  if (radiusEnabled) await startRadiusKeepalive();
});

chrome.runtime.onInstalled.addListener(async () => {
  const enabled = await isKeepaliveEnabled();
  if (enabled) await startKeepalive();
  const radiusEnabled = await isRadiusKeepaliveEnabled();
  if (radiusEnabled) await startRadiusKeepalive();
});
