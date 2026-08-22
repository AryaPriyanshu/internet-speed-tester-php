<?php
declare(strict_types=1);


header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#07111f">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="description" content="A privacy-friendly browser internet speed test for ping, jitter, packet loss, download, upload and bufferbloat diagnostics.">
    <title>Pulse — Internet Speed Test</title>
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="assets/app-icon-192.png">
    <link rel="manifest" href="manifest.webmanifest">
    <link rel="stylesheet" href="assets/style.css?v=2.3.0">
</head>
<body>
    <a class="skip-link" href="#mainContent">Skip to speed test</a>
    <div class="ambient ambient-one" aria-hidden="true"></div>
    <div class="ambient ambient-two" aria-hidden="true"></div>

    <div class="app-shell">
        <nav class="topbar" aria-label="Primary navigation">
            <a class="brand" href="./" aria-label="Pulse home">
                <span class="brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 32 32" role="img"><path d="M4 17h5l3-8 5 15 4-11 2 4h5"/></svg>
                </span>
                <span>Pulse</span>
            </a>

            <div class="top-actions">
                <button class="privacy-chip install-button hidden" id="installApp" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11M7.5 10 12 14.5 16.5 10"/><path d="M5 20h14"/></svg>
                    Install app
                </button>
                <button class="privacy-chip history-shortcut" id="historyShortcut" type="button" aria-label="Jump to local test history" title="View test history stored in this browser">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Z"/><path d="m9.5 12 1.6 1.6 3.5-3.7"/></svg>
                    Local history
                </button>
                <button class="icon-button" id="themeToggle" type="button" aria-label="Switch theme" title="Switch theme">
                    <svg class="theme-icon moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8.2 8.2 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>
                    <svg class="theme-icon sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                </button>
            </div>
        </nav>

        <div class="offline-banner hidden" id="offlineBanner" role="status">
            You are offline. Saved history is still available, but a speed test needs a connection to this server.
        </div>

        <main id="mainContent">
            <section class="hero" aria-labelledby="pageTitle">
                <div class="eyebrow"><span class="status-dot"></span> Browser-based network diagnostics</div>
                <h1 id="pageTitle">Know what your connection can really do.</h1>
                <p>Measure latency, jitter, download and upload speed with adaptive testing, then see what those numbers mean for everyday use.</p>
            </section>

            <section class="tester-card" aria-label="Internet speed test">
                <div class="test-grid">
                    <div class="gauge-column">
                        <div class="stage-label" id="stageLabel">READY</div>

                        <fieldset class="profile-selector" id="profileSelector">
                            <legend>Test profile</legend>
                            <label>
                                <input type="radio" name="testProfile" value="quick">
                                <span>Quick <small>~8 sec</small></span>
                            </label>
                            <label>
                                <input type="radio" name="testProfile" value="standard" checked>
                                <span>Standard <small>~14 sec</small></span>
                            </label>
                            <label>
                                <input type="radio" name="testProfile" value="extended">
                                <span>Extended <small>~22 sec</small></span>
                            </label>
                        </fieldset>

                        <div class="gauge" id="speedGauge" aria-live="polite">
                            <svg class="gauge-svg" viewBox="0 0 300 190" aria-hidden="true">
                                <path class="gauge-track" pathLength="100" d="M28 160 A132 132 0 0 1 272 160"/>
                                <path class="gauge-progress" id="gaugeProgress" pathLength="100" d="M28 160 A132 132 0 0 1 272 160"/>
                            </svg>
                            <div class="gauge-readout">
                                <span class="gauge-value" id="gaugeValue">0.00</span>
                                <span class="gauge-unit" id="gaugeUnit">Mbps</span>
                                <span class="gauge-caption" id="gaugeCaption">Ready to test</span>
                            </div>
                        </div>

                        <div class="test-progress-wrap" aria-hidden="true">
                            <div class="test-progress" id="testProgress"></div>
                        </div>

                        <div class="control-row">
                            <button class="primary-button" id="startTest" type="button">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 1 2.1 5"/><path d="M5 7v5h5"/></svg>
                                <span>Start speed test</span>
                            </button>
                            <button class="secondary-button danger-button hidden" id="cancelTest" type="button">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>
                                Cancel
                            </button>
                        </div>
                        <p class="status-message" id="status" role="status">No test running. This usually takes several seconds.</p>
                    </div>

                    <div class="metrics-column">
                        <article class="metric-card latency-card">
                            <div class="metric-heading">
                                <span class="metric-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h3l2-5 4 10 2-5h5"/></svg></span>
                                <span>Ping</span>
                            </div>
                            <div><strong id="latency">—</strong> <span class="metric-unit">ms</span></div>
                            <small>Idle latency</small>
                        </article>

                        <article class="metric-card">
                            <div class="metric-heading">
                                <span class="metric-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/></svg></span>
                                <span>Download</span>
                            </div>
                            <div><strong id="download">—</strong> <span class="metric-unit">Mbps</span></div>
                            <small>Incoming throughput</small>
                        </article>

                        <article class="metric-card">
                            <div class="metric-heading">
                                <span class="metric-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V8M7 13l5-5 5 5"/><path d="M5 3h14"/></svg></span>
                                <span>Upload</span>
                            </div>
                            <div><strong id="upload">—</strong> <span class="metric-unit">Mbps</span></div>
                            <small>Outgoing throughput</small>
                        </article>

                        <article class="metric-card">
                            <div class="metric-heading">
                                <span class="metric-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h3M17 12h3M12 4v3M12 17v3"/><circle cx="12" cy="12" r="5"/></svg></span>
                                <span>Jitter</span>
                            </div>
                            <div><strong id="jitter">—</strong> <span class="metric-unit">ms</span></div>
                            <small>Latency consistency</small>
                        </article>
                    </div>
                </div>
            </section>

            <section class="result-section hidden" id="resultSection" aria-labelledby="resultHeading">
                <div class="section-heading split-heading">
                    <div>
                        <span class="section-kicker">TEST ANALYSIS</span>
                        <h2 id="resultHeading">Connection report</h2>
                    </div>
                    <div class="result-actions">
                        <button class="secondary-button compact" id="shareResult" type="button">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></svg>
                            Share
                        </button>
                        <button class="secondary-button compact" id="saveResultCard" type="button">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
                            Save card
                        </button>
                    </div>
                </div>

                <div class="analysis-grid">
                    <article class="quality-card">
                        <div class="quality-score" id="qualityScore">—</div>
                        <div>
                            <span class="quality-label" id="qualityLabel">Not tested</span>
                            <p id="qualitySummary">Run a test to receive a connection-quality assessment.</p>
                        </div>
                    </article>

                    <article class="diagnostic-card">
                        <div class="diagnostic-row"><span>Download loaded latency</span><strong id="downloadLoadedLatency">—</strong></div>
                        <div class="diagnostic-row"><span>Upload loaded latency</span><strong id="uploadLoadedLatency">—</strong></div>
                        <div class="diagnostic-row"><span>Worst latency increase</span><strong id="bufferbloat">—</strong></div>
                        <div class="diagnostic-row"><span>Bufferbloat grade</span><strong class="grade-value" id="bufferbloatGrade">—</strong></div>
                        <div class="diagnostic-row"><span>Ping sample loss</span><strong id="packetLoss">—</strong></div>
                        <div class="diagnostic-row"><span>Download stability</span><strong id="downloadStability">—</strong></div>
                        <div class="diagnostic-row"><span>Upload stability</span><strong id="uploadStability">—</strong></div>
                        <div class="diagnostic-row"><span>Test duration</span><strong id="duration">—</strong></div>
                    </article>
                </div>

                <div class="use-case-grid" id="useCases" aria-label="Connection suitability"></div>

                <div class="comparison-block" id="comparisonBlock" aria-live="polite">
                    <div class="comparison-heading">
                        <span class="section-kicker">SINCE YOUR LAST TEST</span>
                        <span id="comparisonContext">A previous result is needed for comparison.</span>
                    </div>
                    <div class="comparison-grid" id="comparisonGrid"></div>
                </div>
            </section>

            <section class="dashboard-grid">
                <article class="panel network-panel">
                    <div class="section-heading">
                        <span class="section-kicker">NETWORK</span>
                        <h2>Connection details</h2>
                    </div>
                    <dl class="network-list">
                        <div><dt>IP address</dt><dd id="ipAddress">Detecting…</dd></div>
                        <div><dt>Connection</dt><dd id="connectionType">—</dd></div>
                        <div><dt>Browser estimate</dt><dd id="browserEstimate">—</dd></div>
                        <div><dt>Protocol</dt><dd id="protocol">—</dd></div>
                    </dl>
                    <p class="panel-note">Network details use information exposed by your browser and this server. No third-party tracking or IP lookup service is used.</p>
                </article>

                <article class="panel chart-panel">
                    <div class="section-heading split-heading">
                        <div>
                            <span class="section-kicker">TREND</span>
                            <h2>Recent performance</h2>
                        </div>
                        <div class="chart-legend" aria-hidden="true"><span class="legend-download"></span> Download <span class="legend-upload"></span> Upload</div>
                    </div>
                    <div class="chart-wrap">
                        <canvas id="historyChart" aria-label="Download and upload speed history chart"></canvas>
                        <div class="empty-chart" id="emptyChart">Run at least one test to build your trend chart.</div>
                    </div>
                </article>

                <article class="panel insights-panel">
                    <div class="section-heading split-heading">
                        <div>
                            <span class="section-kicker">INSIGHTS</span>
                            <h2>History at a glance</h2>
                        </div>
                        <span class="insight-sample" id="insightSample">No completed tests</span>
                    </div>
                    <div class="insight-grid">
                        <div class="insight-stat"><span>Average download</span><strong id="averageDownload">—</strong><small>Mbps</small></div>
                        <div class="insight-stat"><span>Average upload</span><strong id="averageUpload">—</strong><small>Mbps</small></div>
                        <div class="insight-stat"><span>Best download</span><strong id="bestDownload">—</strong><small>Mbps</small></div>
                        <div class="insight-stat"><span>Average ping</span><strong id="averagePing">—</strong><small>ms</small></div>
                    </div>
                </article>
            </section>

            <section class="panel history-panel" id="historySection" tabindex="-1" aria-labelledby="historyHeading">
                <div class="section-heading split-heading">
                    <div>
                        <span class="section-kicker">HISTORY</span>
                        <h2 id="historyHeading">Recent tests</h2>
                    </div>
                    <div class="history-actions">
                        <button class="text-button" id="exportHistory" type="button" disabled>Export CSV</button>
                        <button class="text-button" id="backupHistory" type="button" disabled>Backup JSON</button>
                        <label class="text-button file-button" for="restoreHistory">Restore</label>
                        <input class="visually-hidden" id="restoreHistory" type="file" accept="application/json,.json">
                        <button class="text-button destructive" id="clearHistory" type="button" disabled>Clear history</button>
                    </div>
                </div>

                <div class="history-toolbar" aria-label="History filters">
                    <label>
                        Test type
                        <select id="historyTypeFilter">
                            <option value="all">All tests</option>
                            <option value="internet">Internet only</option>
                            <option value="local">Local only</option>
                        </select>
                    </label>
                    <label>
                        Profile
                        <select id="historyProfileFilter">
                            <option value="all">All profiles</option>
                            <option value="quick">Quick</option>
                            <option value="standard">Standard</option>
                            <option value="extended">Extended</option>
                        </select>
                    </label>
                    <span id="historyFilterSummary" aria-live="polite">Showing all results</span>
                </div>

                <div class="history-table-wrap">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Ping</th>
                                <th>Download</th>
                                <th>Upload</th>
                                <th>Bufferbloat</th>
                                <th>Quality</th>
                                <th aria-label="Actions"></th>
                            </tr>
                        </thead>
                        <tbody id="historyBody"></tbody>
                    </table>
                    <div class="history-empty" id="historyEmpty">
                        <span class="empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg></span>
                        <strong id="historyEmptyTitle">No test history yet</strong>
                        <span id="historyEmptyText">Your completed tests will be stored locally in this browser.</span>
                    </div>
                </div>
            </section>

            <section class="info-strip" aria-label="Measurement notice">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>
                <p><strong>For the cleanest result:</strong> pause large downloads, disconnect unnecessary VPNs, keep this tab active, and test over Ethernet if you want to isolate Wi-Fi performance.</p>
            </section>
        </main>

        <footer class="site-footer">
            <span>Pulse Internet Speed Test · Phase 2.3</span>
            <span>Browser measurements are estimates, not ISP-grade certification.</span>
        </footer>
    </div>

    <canvas id="shareCanvas" width="1200" height="630" hidden></canvas>
    <dialog class="history-dialog" id="historyDialog" aria-labelledby="historyDialogTitle">
        <div class="dialog-heading">
            <div>
                <span class="section-kicker">SAVED RESULT</span>
                <h2 id="historyDialogTitle">Test details</h2>
                <p id="historyDialogDate"></p>
            </div>
            <form method="dialog">
                <button class="dialog-close" type="submit" aria-label="Close result details">×</button>
            </form>
        </div>
        <div class="dialog-metrics" id="historyDialogMetrics"></div>
        <div class="dialog-actions">
            <button class="secondary-button destructive-button" id="deleteHistoryResult" type="button">Delete result</button>
            <form method="dialog"><button class="secondary-button" type="submit">Close</button></form>
        </div>
    </dialog>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>

    <script src="assets/app.js?v=2.3.0"></script>
</body>
</html>
