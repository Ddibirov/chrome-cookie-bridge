# 🍪 Chrome Cookie Bridge

**Auto-export Chrome cookies every N minutes — for AI agents, scrapers, and WSL/Linux automation.**

After Chrome 127 (July 2024), Google rolled out [App-Bound Encryption](https://security.googleblog.com/2024/07/improving-chrome-app-bound-encryption.html), which broke every existing cookie decryption tool. Extracting cookies now requires either DLL injection (ABE-Decryption) or... just asking Chrome nicely via its own API.

This extension does the latter. **< 100 lines total.** No hacks, no browser killing, no antivirus triggers.

## Features

- 🔄 **Auto-export every N minutes** — configurable (default: 30 min)
- 🎯 **Domain filter** — export only cookies you need (e.g. `reddit.com`, `github.com`)
- 📦 **Dual format** — JSON (`hermes_cookies.json`) + Netscape (`hermes_cookies.txt`)
- 🐧 **WSL/Linux companion** — `cookie_reader.py` reads exports and outputs curl-ready cookies
- 🎨 **Popup UI** — manual export, domain filter, interval config

## Quick Start

### 1. Install the extension

```
chrome://extensions → Developer mode ON → Load unpacked → select `extension/` folder
```

After loading, the extension immediately exports your cookies to `Downloads/`.

### 2. (Optional) Configure

Click the extension icon → set filter domains (one per line) and interval → **Save & Export Now**.

### 3. Use in WSL/Linux

```bash
# Check if cookies are fresh
python3 wsl/cookie_reader.py --check

# List available domains
python3 wsl/cookie_reader.py --list

# Get Reddit cookies in curl format
python3 wsl/cookie_reader.py reddit.com

# Use directly with curl
curl -b <(python3 wsl/cookie_reader.py reddit.com) https://www.reddit.com/api/me.json
```

## How It Works

```
Chrome Extension                    WSL / Linux
─────────────────                   ───────────
chrome.cookies.getAll()             cookie_reader.py
        │                                  │
        ▼ every N min                      ▼ on demand
  Downloads/                         reads JSON/Netscape
  hermes_cookies.json    ────→      filters by domain
  hermes_cookies.txt                → curl-ready output
```

The extension uses `chrome.cookies` API (read-only, local) — the same API that built-in DevTools uses. No data ever leaves your machine.

## Why Not...

| Approach | Problem |
|----------|---------|
| **DPAPI decryption** | Broken since Chrome 127 (App-Bound Encryption) |
| **ABE-Decryption** | DLL injection, kills browser, PoC-quality, triggers AV |
| **Manual export** | Clicking "Get cookies.txt" every time |
| **CDP (--remote-debugging-port)** | Chrome 148+ blocks debug port on main profile |
| **This extension** | Works with any Chrome version, no hacks |

## Files

```
chrome-cookie-bridge/
├── extension/           # Chrome extension (load unpacked)
│   ├── manifest.json
│   ├── background.js    # Auto-export logic
│   ├── popup.html       # Settings UI
│   ├── popup.js
│   └── icons/
├── wsl/                 # WSL/Linux companion scripts
│   └── cookie_reader.py
├── LICENSE              # MIT
└── README.md
```

## Requirements

- **Chrome / Brave / Edge** (any Chromium, Manifest V3)
- **Python 3.9+** for `cookie_reader.py` (optional — only for WSL/Linux side)

## Security

- All code runs **locally** — no data leaves your machine
- Uses `chrome.cookies` API (READ-ONLY, same as DevTools)
- `downloads` permission only for saving the export file
- No external network requests, no analytics, no trackers
- Source is < 100 lines total — audit it yourself in 2 minutes

## License

MIT — do whatever you want.
