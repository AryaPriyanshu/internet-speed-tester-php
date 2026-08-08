<?php
session_start();

if (!isset($_SESSION['history'])) {
    $_SESSION['history'] = [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Internet Speed Tester</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>⚡ Internet Speed Tester</h1>
            <p>Measure browser-based connection performance and view your recent test history.</p>
        </header>

        <section class="panel">
            <div class="metric-grid">
                <div class="metric-card">
                    <span>Latency</span>
                    <strong id="latency">-- ms</strong>
                </div>

                <div class="metric-card">
                    <span>Download Speed</span>
                    <strong id="download">-- Mbps</strong>
                </div>

                <div class="metric-card">
                    <span>Upload Speed</span>
                    <strong id="upload">-- Mbps</strong>
                </div>

                <div class="metric-card">
                    <span>Connection Quality</span>
                    <strong id="quality">Not tested</strong>
                </div>
            </div>

            <button id="startTest">Start Speed Test</button>

            <div id="status">Ready to test your connection.</div>
        </section>

        <section class="panel">
            <h2>Recent Tests</h2>

            <div id="history">
                <p>No tests recorded in this browser session yet.</p>
            </div>
        </section>

        <footer>
            Portfolio demonstration project. Browser-based measurements may vary and should not be treated as ISP-grade diagnostics.
        </footer>
    </div>

    <script src="assets/app.js"></script>
</body>
</html>
