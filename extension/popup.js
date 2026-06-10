// Chrome Cookie Bridge — Popup
// v1.1.0 — added pre-refresh toggle

const statusEl = document.getElementById('status');
const dotEl = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const filterEl = document.getElementById('filterDomains');
const intervalEl = document.getElementById('intervalMin');
const preRefreshEl = document.getElementById('preRefresh');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');

// Load current settings
(async () => {
  const { filterDomains = [], intervalMin = 1440, preRefresh = true, lastExport = null, cookieCount = 0 } =
    await chrome.storage.local.get(['filterDomains', 'intervalMin', 'preRefresh', 'lastExport', 'cookieCount']);

  filterEl.value = filterDomains.join('\n');
  intervalEl.value = intervalMin;
  preRefreshEl.checked = preRefresh;
  updateStatus(lastExport, cookieCount);
})();

function updateStatus(lastExport, cookieCount) {
  if (!lastExport) {
    statusEl.className = 'status warn';
    dotEl.className = 'dot warn';
    statusText.textContent = 'No exports yet — click Save & Export';
  } else {
    const ago = Math.round((Date.now() - lastExport) / 60000);
    statusEl.className = ago > 60 ? 'status warn' : 'status ok';
    dotEl.className = ago > 60 ? 'dot warn' : 'dot ok';
    statusText.textContent = `${cookieCount} cookies · ${ago}m ago`;
  }
}

saveBtn.addEventListener('click', async () => {
  const filterDomains = filterEl.value.split('\n').map(s => s.trim()).filter(Boolean);
  const intervalMin = Math.max(5, Math.min(1440, parseInt(intervalEl.value) || 1440));
  const preRefresh = preRefreshEl.checked;

  await chrome.storage.local.set({ filterDomains, intervalMin, preRefresh });

  // Restart alarm with new interval
  await chrome.alarms.clear('cookie-export');
  chrome.alarms.create('cookie-export', { periodInMinutes: intervalMin });

  // Trigger immediate export via background
  chrome.runtime.sendMessage({ action: 'export' });

  saveBtn.textContent = '✅ Saved!';
  setTimeout(() => { saveBtn.textContent = '💾 Save & Export Now'; }, 1500);

  // Refresh status
  setTimeout(async () => {
    const { lastExport, cookieCount } = await chrome.storage.local.get(['lastExport', 'cookieCount']);
    updateStatus(lastExport, cookieCount);
  }, 2000);
});

exportBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'export' });
  exportBtn.textContent = '⏳ Exporting…';
  setTimeout(() => { exportBtn.textContent = '📥 Export Now (without saving)'; }, 2000);
});

// Listen for export completion from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'exportDone') {
    updateStatus(msg.lastExport, msg.cookieCount);
  }
});
