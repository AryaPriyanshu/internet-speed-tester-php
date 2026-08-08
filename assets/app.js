const startButton = document.getElementById("startTest");
const statusText = document.getElementById("status");

const latencyEl = document.getElementById("latency");
const downloadEl = document.getElementById("download");
const uploadEl = document.getElementById("upload");
const qualityEl = document.getElementById("quality");
const historyEl = document.getElementById("history");

function classifyConnection(download, latency) {
    if (download >= 100 && latency < 40) return "Excellent";
    if (download >= 50 && latency < 70) return "Good";
    if (download >= 20 && latency < 120) return "Fair";
    return "Poor";
}

async function measureLatency() {
    const samples = [];

    for (let i = 0; i < 5; i++) {
        const start = performance.now();

        await fetch(`api/ping.php?t=${Date.now()}`, {
            cache: "no-store"
        });

        const end = performance.now();
        samples.push(end - start);
    }

    return samples.reduce((a, b) => a + b, 0) / samples.length;
}

async function measureDownload() {
    const start = performance.now();

    const response = await fetch(`api/download.php?t=${Date.now()}`, {
        cache: "no-store"
    });

    const blob = await response.blob();

    const end = performance.now();
    const seconds = (end - start) / 1000;

    const bits = blob.size * 8;
    return bits / seconds / 1_000_000;
}

async function measureUpload() {
    const payloadSize = 1_000_000;
    const payload = new Blob([new Uint8Array(payloadSize)]);

    const start = performance.now();

    await fetch("api/upload.php", {
        method: "POST",
        body: payload,
        cache: "no-store"
    });

    const end = performance.now();
    const seconds = (end - start) / 1000;

    const bits = payloadSize * 8;
    return bits / seconds / 1_000_000;
}

function addHistoryItem(result) {
    if (historyEl.querySelector("p")) {
        historyEl.innerHTML = "";
    }

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
        <strong>${new Date().toLocaleTimeString()}</strong><br>
        Latency: ${result.latency.toFixed(1)} ms |
        Download: ${result.download.toFixed(2)} Mbps |
        Upload: ${result.upload.toFixed(2)} Mbps |
        Quality: ${result.quality}
    `;

    historyEl.prepend(item);
}

startButton.addEventListener("click", async () => {
    startButton.disabled = true;

    latencyEl.textContent = "-- ms";
    downloadEl.textContent = "-- Mbps";
    uploadEl.textContent = "-- Mbps";
    qualityEl.textContent = "Testing...";

    try {
        statusText.textContent = "Measuring latency...";
        const latency = await measureLatency();
        latencyEl.textContent = `${latency.toFixed(1)} ms`;

        statusText.textContent = "Measuring download speed...";
        const download = await measureDownload();
        downloadEl.textContent = `${download.toFixed(2)} Mbps`;

        statusText.textContent = "Measuring upload speed...";
        const upload = await measureUpload();
        uploadEl.textContent = `${upload.toFixed(2)} Mbps`;

        const quality = classifyConnection(download, latency);
        qualityEl.textContent = quality;

        addHistoryItem({
            latency,
            download,
            upload,
            quality
        });

        statusText.textContent = "Speed test completed.";
    } catch (error) {
        console.error(error);
        statusText.textContent = "The speed test could not be completed.";
        qualityEl.textContent = "Error";
    } finally {
        startButton.disabled = false;
    }
});
