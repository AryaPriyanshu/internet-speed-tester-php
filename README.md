# ⚡ Pulse — Internet Speed Tester

Pulse is a dependency-free PHP + JavaScript internet speed tester with adaptive throughput testing, live feedback, local history, connection diagnostics, and a polished responsive dashboard. This package contains the completed Phase 2.3 release.

## Phase 2.3 additions

- Download and upload **throughput stability scores** derived from 500 ms buckets inside the sustained post-warm-up measurement window
- Filterable saved history by test type and measurement profile
- Accessible detailed-result dialog for every stored test
- Two-step deletion of an individual saved result
- Stability fields in JSON backups, CSV exports, share text, and result diagnostics
- Production-ready Docker configuration and a free Render Blueprint targeting Singapore
- Hardened Apache runtime settings and dynamic platform-port support

## Phase 2.2 additions

- **Quick**, **Standard**, and **Extended** measurement profiles
- Standard remains the default with the established ~6-second download and upload windows
- Installable Progressive Web App shell with offline access to saved local history
- Explicit offline state that pauses measurements while keeping the dashboard usable
- JSON history backup and validated restore with deduplication and a 2 MB safety limit
- Restored entries are normalized instead of injecting untrusted fields into the interface
- Install icons for desktop and mobile platforms
- Keyboard skip link and improved control focus behavior

## Phase 2.1 foundation

- Loaded-latency sampling during **both download and upload** phases
- Separate download/upload latency increases and a worst-case **bufferbloat grade** from A+ to F
- Ping sample-loss reporting without discarding an otherwise valid test after one missed sample
- Previous-test comparison for download, upload, and ping
- Local-history insights for average download, average upload, best download, and average ping
- Expanded CSV and share-card diagnostics
- Reliable cancellation of active streamed downloads
- Safer two-step local-history clearing
- Lower CPU overhead in the PHP download stream so server-side random generation is less likely to limit results
- Forwarded IP/protocol headers are ignored unless trusted-proxy mode is explicitly enabled

## Features

- Sustained adaptive **download speed** testing with parallel streams and a ~6 second measurement window
- Sustained adaptive **upload speed** testing with a ~6 second measurement window with live upload progress
- Multi-sample **ping / idle latency** measurement
- **Jitter** calculation from latency variation
- **Loaded latency** measurement during download and upload traffic
- Directional latency increase and a worst-case **bufferbloat grade**
- **Ping sample loss** across the idle-latency sample set
- Weighted **connection quality score** and practical use-case assessment
- Live animated speed gauge and test-stage progress
- Automatic localhost/loopback detection so local tests are clearly marked and do not receive a misleading internet-quality score
- Cancel and retry controls
- Three selectable test-duration profiles
- Persistent browser history using `localStorage`
- Native Canvas performance trend chart (no chart library required)
- Previous-result comparison and local average/best history insights
- CSV history export
- Portable JSON history backup and restore
- Shareable result text and downloadable PNG result card
- Browser/network information where available
- Dark and light themes
- Installable, offline-aware PWA shell
- Mobile, tablet, and desktop responsive layout
- PHP endpoint validation, request limits, no-cache headers, and safer defaults
- No analytics, advertising SDKs, third-party IP lookup, or frontend dependencies

## Technology

- PHP 8+
- JavaScript (ES2022+ browser features)
- HTML5
- CSS3
- Fetch API / Streams API
- XMLHttpRequest upload progress
- Canvas API
- Web Share API when supported

## Project structure

```text
internet-speed-tester-php/
├── api/
│   ├── _bootstrap.php
│   ├── download.php
│   ├── health.php
│   ├── network.php
│   ├── ping.php
│   └── upload.php
├── assets/
│   ├── app.js
│   ├── app-icon.svg
│   ├── app-icon-192.png
│   ├── app-icon-512.png
│   ├── favicon.svg
│   └── style.css
├── .dockerignore
├── DEPLOYMENT.md
├── Dockerfile
├── docker-entrypoint-pulse.sh
├── docker-php.ini
├── docker-pulse.conf
├── index.php
├── manifest.webmanifest
├── render.yaml
├── service-worker.js
├── README.md
└── LICENSE
```

## Run locally

From the project directory:

```bash
php -S 127.0.0.1:8000
```

Then open:

```text
http://127.0.0.1:8000
```

The built-in PHP server is ideal for development. For realistic internet-speed measurements, deploy the app to a remote server with sufficient bandwidth rather than testing against `localhost`.

Pulse automatically enters **Local test mode** on `localhost`, `127.0.0.1`, and `::1`. Local results remain useful for checking the application, but they do not receive an internet-quality score or bufferbloat grade.

The **Standard** profile preserves the existing measurement methodology: ~6 seconds each for download and upload with a 0.9-second warm-up excluded. Quick uses ~3.5-second phases for a faster check, while Extended uses ~10-second phases for a more stable sample. The chosen profile is stored in the browser.

## Deployment requirements

- PHP 8.0 or newer recommended
- HTTPS strongly recommended for production
- HTTPS is required for installation and offline support outside localhost
- PHP must be allowed to read request bodies and stream response bodies
- Reverse proxies/CDNs should not cache `api/download.php`, `api/upload.php`, or `api/ping.php`
- Hosting bandwidth limits should be reviewed before publishing a public speed-test service

For the prepared card-free Render option, limitations, and exact steps, see [DEPLOYMENT.md](DEPLOYMENT.md). The included Blueprint uses Docker, the free plan, the Singapore region, and `/api/health.php` as its health check.

By default, `api/network.php` ignores forwarding headers because they can be spoofed when PHP is directly exposed. If the application is behind a reverse proxy that strips client-supplied forwarding headers and sets its own, enable trusted-proxy mode in the PHP environment:

```text
PULSE_TRUST_PROXY=1
```

The download endpoint caps each request at 12 MiB and the upload endpoint caps each request at 4 MiB. The frontend first performs a short calibration pass, then repeatedly transfers adaptive chunks for roughly 6 seconds in each throughput phase. The first 0.9 seconds are treated as warm-up and excluded from the final throughput calculation; live Mbps uses a rolling window so very fast links cannot finish from one tiny burst.

## Measurement notes

Browser-based speed tests are estimates. Results can be influenced by Wi-Fi quality, browser scheduling, device CPU load, VPNs, other network traffic, server capacity, geographic distance, TCP/TLS behavior, proxies, and CDN configuration.

The displayed ping sample-loss percentage is the share of Pulse's ten idle HTTP latency samples that did not return. It is a lightweight browser-level reliability signal, not an ICMP packet-loss certification. Bufferbloat grades are based on the worse of the download- and upload-loaded latency increases relative to idle latency.

Throughput stability is calculated independently for download and upload. Pulse divides the measured portion after warm-up into completed 500 ms buckets, measures variation between those buckets, and converts the coefficient of variation into a 0–100 stability score. At least three completed buckets are required. The score describes consistency during this test; it is not a service-level guarantee.

For cleaner results:

1. Close or pause large downloads and cloud synchronization.
2. Keep the test tab active.
3. Disable a VPN if you want to measure the direct ISP path.
4. Use Ethernet if you want to separate ISP performance from Wi-Fi performance.
5. Run several tests at different times instead of relying on one sample.

## Privacy

Completed test history is stored in the browser's local storage. Pulse does not send test history to a database. JSON restore reads the user-selected file entirely in the browser, validates supported fields, and keeps at most 30 results. The network details panel only uses information exposed by the browser and the IP address visible to the PHP server. It intentionally avoids third-party IP/ISP lookup services.

## Health check

A lightweight endpoint is available at:

```text
/api/health.php
```

A healthy deployment returns a JSON response with `"status": "ok"`.

## License

See [LICENSE](LICENSE).
