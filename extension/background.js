// Chrome Cookie Bridge — Background Service Worker
// Auto-exports Chrome cookies on a schedule. Domain filtering optional.

const ALARM_NAME = 'cookie-export';
const DEFAULT_INTERVAL_MIN = 30;
const EXPORT_FILENAME = 'hermes_cookies.json';
const NETSACPE_FILENAME = 'hermes_cookies.txt';

// --- Startup ---
(async () => {
  const { intervalMin = DEFAULT_INTERVAL_MIN } = await chrome.storage.local.get('intervalMin');
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMin });
  runExport();
})();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runExport();
});

// --- Export logic ---
async function runExport() {
  try {
    const { filterDomains = [] } = await chrome.storage.local.get('filterDomains');
    const { format = 'json' } = await chrome.storage.local.get('format');

    let allCookies = await chrome.cookies.getAll({});

    // Apply domain filter
    if (filterDomains.length > 0) {
      const filters = filterDomains.map(d => d.toLowerCase().trim()).filter(Boolean);
      allCookies = allCookies.filter(c => {
        const d = (c.domain || '').toLowerCase();
        return filters.some(f => d === f || d.endsWith('.' + f));
      });
    }

    const clean = allCookies.map(c => ({
      domain: c.domain,
      name: c.name,
      value: c.value,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      expirationDate: c.expirationDate
    }));

    // JSON export
    const json = JSON.stringify(clean, null, 2);
    await download(json, EXPORT_FILENAME, 'application/json');

    // Netscape export
    const netscape = toNetscape(clean);
    await download(netscape, NETSACPE_FILENAME, 'text/plain');

    await chrome.storage.local.set({
      lastExport: Date.now(),
      cookieCount: clean.length
    });

    console.log(`[Cookie Bridge] Exported ${clean.length} cookies`);
  } catch (err) {
    console.error('[Cookie Bridge] Export failed:', err);
  }
}

async function download(content, filename, mime) {
  const dataUrl = `data:${mime};charset=utf-8,` + encodeURIComponent(content);
  await chrome.downloads.download({
    url: dataUrl,
    filename,
    conflictAction: 'overwrite',
    saveAs: false
  });
}

// --- Message handling (popup triggers) ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'export') {
    runExport().then(() => {
      chrome.storage.local.get(['lastExport', 'cookieCount'], (data) => {
        chrome.runtime.sendMessage({ action: 'exportDone', ...data });
      });
    });
  }
});

function toNetscape(cookies) {
  const lines = ['# Netscape HTTP Cookie File', '# Exported by Chrome Cookie Bridge', ''];
  for (const c of cookies) {
    const domain = (c.domain || '').startsWith('.') ? c.domain : '.' + (c.domain || '');
    const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = c.path || '/';
    const secure = c.secure ? 'TRUE' : 'FALSE';
    const expiry = c.expirationDate ? String(Math.round(c.expirationDate)) : '0';
    const name = c.name || '';
    const value = c.value || '';
    lines.push(`${domain}\t${flag}\t${path}\t${secure}\t${expiry}\t${name}\t${value}`);
  }
  return lines.join('\n');
}
