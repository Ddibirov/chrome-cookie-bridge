// Chrome Cookie Bridge v2.0.0 — Background Service Worker
// POSTs cookies to WSL HTTP endpoint instead of chrome.downloads.download

const ALARM_NAME = 'cookie-export';
const DEFAULT_INTERVAL_MIN = 1440;
const PRE_REFRESH_TIMEOUT_SEC = 15;
const WSL_ENDPOINT = 'http://localhost:9487/cookies';

(async () => {
  const { intervalMin = DEFAULT_INTERVAL_MIN } = await chrome.storage.local.get('intervalMin');
  const effectiveInterval = intervalMin < 30 ? DEFAULT_INTERVAL_MIN : intervalMin;
  if (effectiveInterval !== intervalMin)
    await chrome.storage.local.set({ intervalMin: effectiveInterval });
  console.log(`[Cookie Bridge v2] interval=${effectiveInterval}min`);
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: effectiveInterval });
  runExport();
})();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runExport();
});

async function getPreRefreshDomains(filterDomains) {
  if (filterDomains.length > 0)
    return filterDomains.map(d => d.toLowerCase().trim()).filter(Boolean);
  try {
    const tabs = await chrome.tabs.query({});
    const hostnames = new Set();
    for (const t of tabs) {
      if (!t.url || !t.url.startsWith('http')) continue;
      try { hostnames.add(new URL(t.url).hostname.toLowerCase()); } catch {}
    }
    return [...hostnames];
  } catch (err) {
    console.error('[Cookie Bridge] tabs.query failed:', err);
    return [];
  }
}

async function preRefreshDomains(domains) {
  if (!domains || domains.length === 0) return;
  for (const domain of domains) {
    const url = `https://${domain}`;
    let tab;
    try {
      tab = await chrome.tabs.create({ url, active: false });
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, PRE_REFRESH_TIMEOUT_SEC * 1000);
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    } catch (err) {
      console.error(`[Cookie Bridge] pre-refresh ${url}:`, err);
    } finally {
      if (tab?.id) try { chrome.tabs.remove(tab.id); } catch {}
    }
  }
}

async function runExport() {
  try {
    const { filterDomains = [], preRefresh = true } = await chrome.storage.local.get(['filterDomains', 'preRefresh']);
    if (preRefresh) {
      const domains = await getPreRefreshDomains(filterDomains);
      if (domains.length > 0) await preRefreshDomains(domains);
    }
    let allCookies = await chrome.cookies.getAll({});
    if (filterDomains.length > 0) {
      const filters = filterDomains.map(d => d.toLowerCase().trim()).filter(Boolean);
      allCookies = allCookies.filter(c => {
        const d = (c.domain || '').toLowerCase();
        return filters.some(f => d === f || d.endsWith('.' + f));
      });
    }
    const clean = allCookies.map(c => ({
      domain: c.domain, name: c.name, value: c.value, path: c.path,
      secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
      expirationDate: c.expirationDate
    }));
    const response = await fetch(WSL_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean)
    });
    if (!response.ok) throw new Error(`WSL endpoint ${response.status}: ${await response.text()}`);
    const result = await response.json();
    console.log(`[Cookie Bridge v2] Exported ${result.count} cookies → ${result.files?.join(', ')}`);
    await chrome.storage.local.set({ lastExport: Date.now(), cookieCount: clean.length });
  } catch (err) {
    console.error('[Cookie Bridge v2] Export failed:', err);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'export') {
    runExport().then(() => {
      chrome.storage.local.get(['lastExport', 'cookieCount'], (data) => {
        chrome.runtime.sendMessage({ action: 'exportDone', ...data });
      });
    });
  }
});
