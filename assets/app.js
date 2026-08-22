"use strict";

const $ = (id) => document.getElementById(id);

const els = {
    startButton: $("startTest"),
    cancelButton: $("cancelTest"),
    themeToggle: $("themeToggle"),
    installApp: $("installApp"),
    offlineBanner: $("offlineBanner"),
    profileSelector: $("profileSelector"),
    historyShortcut: $("historyShortcut"),
    historySection: $("historySection"),
    status: $("status"),
    stageLabel: $("stageLabel"),
    gaugeValue: $("gaugeValue"),
    gaugeUnit: $("gaugeUnit"),
    gaugeCaption: $("gaugeCaption"),
    testProgress: $("testProgress"),
    latency: $("latency"),
    download: $("download"),
    upload: $("upload"),
    jitter: $("jitter"),
    resultSection: $("resultSection"),
    qualityScore: $("qualityScore"),
    qualityLabel: $("qualityLabel"),
    qualitySummary: $("qualitySummary"),
    downloadLoadedLatency: $("downloadLoadedLatency"),
    uploadLoadedLatency: $("uploadLoadedLatency"),
    bufferbloat: $("bufferbloat"),
    bufferbloatGrade: $("bufferbloatGrade"),
    packetLoss: $("packetLoss"),
    downloadStability: $("downloadStability"),
    uploadStability: $("uploadStability"),
    duration: $("duration"),
    useCases: $("useCases"),
    comparisonBlock: $("comparisonBlock"),
    comparisonContext: $("comparisonContext"),
    comparisonGrid: $("comparisonGrid"),
    ipAddress: $("ipAddress"),
    connectionType: $("connectionType"),
    browserEstimate: $("browserEstimate"),
    protocol: $("protocol"),
    historyBody: $("historyBody"),
    historyEmpty: $("historyEmpty"),
    historyEmptyTitle: $("historyEmptyTitle"),
    historyEmptyText: $("historyEmptyText"),
    historyTypeFilter: $("historyTypeFilter"),
    historyProfileFilter: $("historyProfileFilter"),
    historyFilterSummary: $("historyFilterSummary"),
    historyDialog: $("historyDialog"),
    historyDialogDate: $("historyDialogDate"),
    historyDialogMetrics: $("historyDialogMetrics"),
    deleteHistoryResult: $("deleteHistoryResult"),
    historyChart: $("historyChart"),
    emptyChart: $("emptyChart"),
    clearHistory: $("clearHistory"),
    exportHistory: $("exportHistory"),
    backupHistory: $("backupHistory"),
    restoreHistory: $("restoreHistory"),
    insightSample: $("insightSample"),
    averageDownload: $("averageDownload"),
    averageUpload: $("averageUpload"),
    bestDownload: $("bestDownload"),
    averagePing: $("averagePing"),
    shareResult: $("shareResult"),
    saveResultCard: $("saveResultCard"),
    shareCanvas: $("shareCanvas"),
    toast: $("toast"),
};

const STORAGE_KEY = "pulse-speed-history-v2";
const LOCAL_TEST_MODE = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname.toLowerCase());
const THEME_KEY = "pulse-theme";
const PROFILE_KEY = "pulse-test-profile";
const HISTORY_LIMIT = 30;
const PING_SAMPLES = 10;
const LIVE_THROUGHPUT_WINDOW_MS = 1400;
const STABILITY_BUCKET_MS = 500;
const MIN_SUCCESSFUL_PINGS = 6;
const TEST_PROFILES = Object.freeze({
    quick: Object.freeze({ id: "quick", downloadMs: 3500, uploadMs: 3500, warmupMs: 700 }),
    standard: Object.freeze({ id: "standard", downloadMs: 6000, uploadMs: 6000, warmupMs: 900 }),
    extended: Object.freeze({ id: "extended", downloadMs: 10000, uploadMs: 10000, warmupMs: 1200 }),
});

let activeAbortController = null;
let activeUploadRequests = [];
let running = false;
let currentResult = null;
let toastTimer = null;
let chartResizeTimer = null;
let clearHistoryTimer = null;
let activeProfileId = "standard";
let installPromptEvent = null;
let serverReachable = null;
let selectedHistoryKey = null;
let deleteResultTimer = null;

const profileInputs = Array.from(document.querySelectorAll('input[name="testProfile"]'));

class TestCancelledError extends Error {
    constructor() {
        super("Speed test cancelled.");
        this.name = "TestCancelledError";
    }
}

function getActiveProfile() {
    return TEST_PROFILES[activeProfileId] || TEST_PROFILES.standard;
}

function applyTestProfile(profileId, persist = true) {
    const normalized = Object.hasOwn(TEST_PROFILES, profileId) ? profileId : "standard";
    activeProfileId = normalized;
    profileInputs.forEach((input) => {
        input.checked = input.value === normalized;
    });

    if (persist) {
        try {
            localStorage.setItem(PROFILE_KEY, normalized);
        } catch {
            // Profile persistence is optional.
        }
    }
}

function initializeTestProfile() {
    let saved = "standard";
    try {
        saved = localStorage.getItem(PROFILE_KEY) || "standard";
    } catch {
        // Use the default profile when storage is restricted.
    }
    applyTestProfile(saved, false);
}

function setProfileControlsDisabled(disabled) {
    profileInputs.forEach((input) => {
        input.disabled = disabled;
    });
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
    if (values.length < 2) return 0;
    const mean = average(values);
    const variance = average(values.map((value) => (value - mean) ** 2));
    return Math.sqrt(variance);
}

function calculateJitter(samples) {
    if (samples.length < 2) return 0;
    const deltas = [];
    for (let i = 1; i < samples.length; i += 1) {
        deltas.push(Math.abs(samples[i] - samples[i - 1]));
    }
    return average(deltas);
}

function formatSpeed(value) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 1000) return value.toFixed(0);
    if (value >= 100) return value.toFixed(1);
    return value.toFixed(2);
}

function formatLatency(value) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 100) return value.toFixed(0);
    return value.toFixed(1);
}

function formatPercent(value, digits = 1) {
    if (!Number.isFinite(value)) return "—";
    return `${value.toFixed(digits)}%`;
}

function formatStability(value) {
    if (!Number.isFinite(value)) return "Unavailable";
    const label = value >= 90 ? "Excellent" : value >= 75 ? "Good" : value >= 50 ? "Variable" : "Unstable";
    return `${value.toFixed(0)}% · ${label}`;
}

function getOverallStability(result) {
    const values = [result.downloadStability, result.uploadStability].filter(Number.isFinite);
    return values.length ? Math.min(...values) : null;
}

function getDownloadLoadedLatency(result) {
    return Number.isFinite(result.downloadLoadedLatency) ? result.downloadLoadedLatency : result.loadedLatency;
}

function getUploadLoadedLatency(result) {
    return Number.isFinite(result.uploadLoadedLatency) ? result.uploadLoadedLatency : null;
}

function gradeBufferbloat(increase) {
    if (!Number.isFinite(increase)) return "—";
    if (increase <= 5) return "A+";
    if (increase <= 15) return "A";
    if (increase <= 30) return "B";
    if (increase <= 60) return "C";
    if (increase <= 100) return "D";
    return "F";
}

function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
}

function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function setProgress(percent) {
    els.testProgress.style.width = `${clamp(percent, 0, 100)}%`;
}

function setGauge(value, unit = "Mbps", caption = "") {
    const numeric = Number.isFinite(value) ? Math.max(0, value) : 0;
    const normalized = unit === "ms"
        ? clamp((Math.log10(numeric + 1) / Math.log10(301)) * 100, 0, 100)
        : clamp((Math.log10(numeric + 1) / Math.log10(1001)) * 100, 0, 100);

    document.documentElement.style.setProperty("--gauge-value", normalized.toFixed(2));
    const displayValue = unit === "ms" ? formatLatency(numeric) : formatSpeed(numeric);
    els.gaugeValue.textContent = displayValue;
    els.gaugeValue.dataset.magnitude = unit === "Mbps" && numeric >= 100000
        ? "six-digit"
        : unit === "Mbps" && numeric >= 10000
            ? "five-digit"
            : "normal";
    els.gaugeUnit.textContent = unit;
    els.gaugeCaption.textContent = caption;
}

function setStage(label, status, progress) {
    els.stageLabel.textContent = label.toUpperCase();
    els.status.textContent = status;
    setProgress(progress);
}

function resetMetrics() {
    els.latency.textContent = "—";
    els.download.textContent = "—";
    els.upload.textContent = "—";
    els.jitter.textContent = "—";
    setGauge(0, "Mbps", "Preparing test");
    currentResult = null;
}

function ensureNotCancelled() {
    if (activeAbortController?.signal.aborted) throw new TestCancelledError();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    ensureNotCancelled();
    const requestController = new AbortController();
    let timedOut = false;
    const cancelSignal = activeAbortController?.signal;
    const cancelHandler = () => requestController.abort();

    if (cancelSignal) {
        if (cancelSignal.aborted) throw new TestCancelledError();
        cancelSignal.addEventListener("abort", cancelHandler, { once: true });
    }

    const timeout = window.setTimeout(() => {
        timedOut = true;
        requestController.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, { ...options, signal: requestController.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`);
        return response;
    } catch (error) {
        if (cancelSignal?.aborted) throw new TestCancelledError();
        if (timedOut || error?.name === "AbortError") throw new Error("A network request timed out.");
        throw error;
    } finally {
        window.clearTimeout(timeout);
        cancelSignal?.removeEventListener("abort", cancelHandler);
    }
}

async function pingOnce(timeoutMs = 3000) {
    const start = performance.now();
    const response = await fetchWithTimeout(`api/ping.php?t=${Date.now()}-${Math.random()}`, {}, timeoutMs);
    await response.json();
    return performance.now() - start;
}

async function measureIdleLatency() {
    // Warm up the connection so DNS/TLS/session setup does not dominate ping.
    await pingOnce();
    const samples = [];
    let failedSamples = 0;

    for (let i = 0; i < PING_SAMPLES; i += 1) {
        ensureNotCancelled();
        try {
            const value = await pingOnce();
            samples.push(value);
            const live = median(samples);
            els.latency.textContent = formatLatency(live);
            setGauge(live, "ms", `Ping sample ${i + 1} of ${PING_SAMPLES}`);
        } catch (error) {
            if (error instanceof TestCancelledError) throw error;
            failedSamples += 1;
            els.gaugeCaption.textContent = `Ping sample ${i + 1} did not return`;
        }
        setProgress(4 + ((i + 1) / PING_SAMPLES) * 18);
        await new Promise((resolve) => window.setTimeout(resolve, 45));
    }

    if (samples.length < MIN_SUCCESSFUL_PINGS) {
        throw new Error("Too few latency samples returned. Check the server connection and try again.");
    }

    let trimmed = samples;
    if (samples.length > 4) {
        const minIndex = samples.indexOf(Math.min(...samples));
        const maxIndex = samples.lastIndexOf(Math.max(...samples));
        trimmed = samples.filter((_, index) => index !== minIndex && index !== maxIndex);
    }

    return {
        latency: median(trimmed),
        jitter: calculateJitter(trimmed),
        samples: trimmed,
        packetLoss: (failedSamples / PING_SAMPLES) * 100,
    };
}

async function streamDownload(bytes, streamId, onProgress) {
    const startedAt = performance.now();
    const requestController = new AbortController();
    const cancelSignal = activeAbortController?.signal;
    const cancelHandler = () => requestController.abort();
    let timedOut = false;
    let reader = null;

    cancelSignal?.addEventListener("abort", cancelHandler, { once: true });
    const timeout = window.setTimeout(() => {
        timedOut = true;
        requestController.abort();
    }, 30000);

    try {
        const response = await fetch(
            `api/download.php?bytes=${bytes}&stream=${streamId}&t=${Date.now()}-${Math.random()}`,
            { signal: requestController.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`);

        let received = 0;
        if (!response.body || !response.body.getReader) {
            const blob = await response.blob();
            received = blob.size;
            onProgress(received);
        } else {
            reader = response.body.getReader();
            while (true) {
                ensureNotCancelled();
                const { done, value } = await reader.read();
                if (done) break;
                received += value.byteLength;
                onProgress(received);
            }
        }

        const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
        return { bytes: received, seconds };
    } catch (error) {
        await reader?.cancel().catch(() => {});
        if (cancelSignal?.aborted) throw new TestCancelledError();
        if (timedOut || error?.name === "AbortError") throw new Error("A download stream timed out.");
        throw error;
    } finally {
        window.clearTimeout(timeout);
        cancelSignal?.removeEventListener("abort", cancelHandler);
    }
}

async function calibrateDownload() {
    const bytes = 768 * 1024;
    const startedAt = performance.now();
    const result = await streamDownload(bytes, "calibration", () => {});
    const seconds = Math.max((performance.now() - startedAt) / 1000, result.seconds, 0.001);
    return (result.bytes * 8) / seconds / 1_000_000;
}

function chooseDownloadPlan(calibratedMbps) {
    if (calibratedMbps < 4) return { bytes: 256 * 1024, streams: 1 };
    if (calibratedMbps < 12) return { bytes: 512 * 1024, streams: 2 };
    if (calibratedMbps < 40) return { bytes: 1024 * 1024, streams: 2 };
    if (calibratedMbps < 120) return { bytes: 2 * 1024 * 1024, streams: 3 };
    if (calibratedMbps < 350) return { bytes: 4 * 1024 * 1024, streams: 3 };
    if (calibratedMbps < 900) return { bytes: 8 * 1024 * 1024, streams: 4 };
    return { bytes: 12 * 1024 * 1024, streams: 4 };
}

function createThroughputTracker(startedAt, warmupMs) {
    let measuredBytes = 0;
    const recent = [];
    const stabilityBuckets = new Map();
    const measuredFrom = startedAt + warmupMs;

    const trimRecent = (now) => {
        const cutoff = now - LIVE_THROUGHPUT_WINDOW_MS;
        while (recent.length && recent[0].time < cutoff) recent.shift();
    };

    return {
        record(bytes, now = performance.now()) {
            if (!Number.isFinite(bytes) || bytes <= 0) return;
            recent.push({ time: now, bytes });
            trimRecent(now);
            if (now >= measuredFrom) {
                measuredBytes += bytes;
                const bucket = Math.floor((now - measuredFrom) / STABILITY_BUCKET_MS);
                stabilityBuckets.set(bucket, (stabilityBuckets.get(bucket) || 0) + bytes);
            }
        },
        liveMbps(now = performance.now()) {
            trimRecent(now);
            if (!recent.length) return 0;
            const bytes = recent.reduce((sum, sample) => sum + sample.bytes, 0);
            const oldest = recent[0].time;
            const seconds = Math.max((now - oldest) / 1000, 0.2);
            return (bytes * 8) / seconds / 1_000_000;
        },
        finalMbps(endedAt = performance.now()) {
            const seconds = Math.max((endedAt - measuredFrom) / 1000, 0.001);
            return (measuredBytes * 8) / seconds / 1_000_000;
        },
        stability(endedAt = performance.now()) {
            const completedBuckets = Math.floor((endedAt - measuredFrom) / STABILITY_BUCKET_MS);
            if (completedBuckets < 3) return null;
            const samples = Array.from({ length: completedBuckets }, (_, index) => {
                const bytes = stabilityBuckets.get(index) || 0;
                return (bytes * 8) / (STABILITY_BUCKET_MS / 1000) / 1_000_000;
            });
            const mean = average(samples);
            if (mean <= 0) return null;
            const coefficientOfVariation = standardDeviation(samples) / mean;
            return clamp(100 - coefficientOfVariation * 100, 0, 100);
        },
    };
}

async function measureDownloadSpeed(onLoadedLatency = () => {}) {
    const calibrated = await calibrateDownload();
    ensureNotCancelled();
    const plan = chooseDownloadPlan(calibrated);
    const profile = getActiveProfile();
    const testMs = profile.downloadMs;
    const warmupMs = profile.warmupMs;
    const startedAt = performance.now();
    const deadline = startedAt + testMs;
    const tracker = createThroughputTracker(startedAt, warmupMs);
    let pingLoopActive = true;
    const loadedPings = [];

    els.gaugeCaption.textContent = `Sustained test · ${plan.streams} stream${plan.streams === 1 ? "" : "s"} · ~${testMs / 1000}s`;

    const pingLoop = (async () => {
        while (pingLoopActive) {
            try {
                const ping = await pingOnce(2500);
                if (performance.now() - startedAt >= warmupMs) {
                    loadedPings.push(ping);
                    onLoadedLatency(median(loadedPings));
                }
            } catch (error) {
                if (error instanceof TestCancelledError) throw error;
            }
            if (pingLoopActive) await new Promise((resolve) => window.setTimeout(resolve, 180));
        }
    })();

    const update = () => {
        const now = performance.now();
        const mbps = tracker.liveMbps(now);
        const elapsedRatio = clamp((now - startedAt) / testMs, 0, 1);
        els.download.textContent = formatSpeed(mbps);
        setGauge(mbps, "Mbps", "Live download throughput");
        setProgress(30 + elapsedRatio * 34);
    };

    const worker = async (index) => {
        let iteration = 0;
        while (performance.now() < deadline) {
            ensureNotCancelled();
            let previousReceived = 0;
            const result = await streamDownload(plan.bytes, `${index}-${iteration}`, (received) => {
                const delta = Math.max(0, received - previousReceived);
                previousReceived = received;
                tracker.record(delta);
                update();
            });
            if (previousReceived < result.bytes) {
                tracker.record(result.bytes - previousReceived);
                update();
            }
            if (result.bytes <= 0) break;
            iteration += 1;
        }
    };

    try {
        await Promise.all(Array.from({ length: plan.streams }, (_, index) => worker(index)));
        const endedAt = performance.now();
        const speed = tracker.finalMbps(endedAt);
        const stability = tracker.stability(endedAt);
        els.download.textContent = formatSpeed(speed);
        setProgress(64);
        return {
            speed,
            stability,
            loadedLatency: loadedPings.length ? median(loadedPings) : null,
            plan,
            measurementSeconds: Math.max((endedAt - startedAt) / 1000, 0),
        };
    } finally {
        pingLoopActive = false;
        await pingLoop.catch(() => {});
    }
}

function xhrUpload(payload, streamId, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeUploadRequests.push(xhr);
        const startedAt = performance.now();

        xhr.open("POST", `api/upload.php?stream=${streamId}&t=${Date.now()}-${Math.random()}`, true);
        xhr.responseType = "json";
        xhr.timeout = 30000;
        xhr.setRequestHeader("Cache-Control", "no-store");

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress(event.loaded);
        };

        xhr.onload = () => {
            activeUploadRequests = activeUploadRequests.filter((item) => item !== xhr);
            if (xhr.status >= 200 && xhr.status < 300) {
                const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
                resolve({ bytes: payload.size, seconds });
            } else {
                reject(new Error(`Upload failed with HTTP ${xhr.status}.`));
            }
        };

        xhr.onerror = () => {
            activeUploadRequests = activeUploadRequests.filter((item) => item !== xhr);
            reject(new Error("Upload request failed."));
        };

        xhr.ontimeout = () => {
            activeUploadRequests = activeUploadRequests.filter((item) => item !== xhr);
            reject(new Error("Upload request timed out."));
        };

        xhr.onabort = () => {
            activeUploadRequests = activeUploadRequests.filter((item) => item !== xhr);
            reject(new TestCancelledError());
        };

        xhr.send(payload);
    });
}

async function calibrateUpload() {
    ensureNotCancelled();
    const size = 256 * 1024;
    const payload = new Blob([new Uint8Array(size)]);
    const startedAt = performance.now();
    await xhrUpload(payload, "calibration", () => {});
    const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
    return (size * 8) / seconds / 1_000_000;
}

function chooseUploadPlan(calibratedMbps) {
    if (calibratedMbps < 3) return { bytes: 128 * 1024, streams: 1 };
    if (calibratedMbps < 10) return { bytes: 256 * 1024, streams: 2 };
    if (calibratedMbps < 35) return { bytes: 512 * 1024, streams: 2 };
    if (calibratedMbps < 100) return { bytes: 1024 * 1024, streams: 2 };
    if (calibratedMbps < 300) return { bytes: 1536 * 1024, streams: 3 };
    return { bytes: 2 * 1024 * 1024, streams: 3 };
}

async function measureUploadSpeed(onLoadedLatency = () => {}) {
    const calibrated = await calibrateUpload();
    ensureNotCancelled();
    const plan = chooseUploadPlan(calibrated);
    const profile = getActiveProfile();
    const testMs = profile.uploadMs;
    const warmupMs = profile.warmupMs;
    const payload = new Blob([new Uint8Array(plan.bytes)]);
    const startedAt = performance.now();
    const deadline = startedAt + testMs;
    const tracker = createThroughputTracker(startedAt, warmupMs);
    let pingLoopActive = true;
    const loadedPings = [];

    els.gaugeCaption.textContent = `Sustained test · ${plan.streams} stream${plan.streams === 1 ? "" : "s"} · ~${testMs / 1000}s`;

    const pingLoop = (async () => {
        while (pingLoopActive) {
            try {
                const ping = await pingOnce(2500);
                if (performance.now() - startedAt >= warmupMs) {
                    loadedPings.push(ping);
                    onLoadedLatency(median(loadedPings));
                }
            } catch (error) {
                if (error instanceof TestCancelledError) throw error;
            }
            if (pingLoopActive) await new Promise((resolve) => window.setTimeout(resolve, 180));
        }
    })();

    const update = () => {
        const now = performance.now();
        const mbps = tracker.liveMbps(now);
        const elapsedRatio = clamp((now - startedAt) / testMs, 0, 1);
        els.upload.textContent = formatSpeed(mbps);
        setGauge(mbps, "Mbps", "Live upload throughput");
        setProgress(70 + elapsedRatio * 25);
    };

    const worker = async (index) => {
        let iteration = 0;
        while (performance.now() < deadline) {
            ensureNotCancelled();
            let previousUploaded = 0;
            const result = await xhrUpload(payload, `${index}-${iteration}`, (uploaded) => {
                const delta = Math.max(0, uploaded - previousUploaded);
                previousUploaded = uploaded;
                tracker.record(delta);
                update();
            });
            if (previousUploaded < result.bytes) {
                tracker.record(result.bytes - previousUploaded);
                update();
            }
            iteration += 1;
        }
    };

    try {
        await Promise.all(Array.from({ length: plan.streams }, (_, index) => worker(index)));
        const endedAt = performance.now();
        const speed = tracker.finalMbps(endedAt);
        const stability = tracker.stability(endedAt);
        els.upload.textContent = formatSpeed(speed);
        setProgress(95);
        return {
            speed,
            stability,
            loadedLatency: loadedPings.length ? median(loadedPings) : null,
            plan,
            measurementSeconds: Math.max((endedAt - startedAt) / 1000, 0),
        };
    } finally {
        pingLoopActive = false;
        await pingLoop.catch(() => {});
    }
}

function scoreConnection(result) {
    const downloadScore = clamp((Math.log10(result.download + 1) / Math.log10(301)) * 100, 0, 100);
    const uploadScore = clamp((Math.log10(result.upload + 1) / Math.log10(101)) * 100, 0, 100);
    const latencyScore = clamp(100 - ((result.latency - 8) / 1.6), 0, 100);
    const jitterScore = clamp(100 - (result.jitter * 6), 0, 100);
    const bloatScore = Number.isFinite(result.bufferbloat)
        ? clamp(100 - Math.max(0, result.bufferbloat) * 1.2, 0, 100)
        : 55;
    const lossScore = clamp(100 - ((result.packetLoss || 0) * 20), 0, 100);

    const score = Math.round(
        downloadScore * 0.32 +
        uploadScore * 0.18 +
        latencyScore * 0.18 +
        jitterScore * 0.12 +
        bloatScore * 0.12 +
        lossScore * 0.08,
    );

    if (score >= 88) return { score, label: "Excellent", summary: "Fast, responsive and stable. This connection should comfortably handle demanding everyday workloads." };
    if (score >= 74) return { score, label: "Very good", summary: "Strong performance for streaming, calls, gaming and multiple active devices." };
    if (score >= 58) return { score, label: "Good", summary: "Solid general-purpose connectivity, with only heavier or latency-sensitive workloads likely to expose limits." };
    if (score >= 40) return { score, label: "Fair", summary: "Usable for everyday tasks, but high-resolution streaming or real-time applications may be inconsistent." };
    return { score, label: "Limited", summary: "The connection is likely to feel constrained. Check Wi-Fi signal, background traffic, VPN use or your ISP link." };
}

function evaluateUseCases(result) {
    const entries = [
        {
            name: "4K streaming",
            good: result.download >= 35,
            ok: result.download >= 18,
        },
        {
            name: "Video calls",
            good: result.download >= 10 && result.upload >= 5 && result.latency < 100 && result.jitter < 20 && result.packetLoss < 1,
            ok: result.download >= 5 && result.upload >= 2.5 && result.latency < 180 && result.packetLoss < 3,
        },
        {
            name: "Online gaming",
            good: result.latency < 50 && result.jitter < 10 && Number.isFinite(result.bufferbloat) && result.bufferbloat < 40 && result.packetLoss < 1,
            ok: result.latency < 100 && result.jitter < 20 && result.packetLoss < 3,
        },
        {
            name: "Large uploads",
            good: result.upload >= 25,
            ok: result.upload >= 8,
        },
    ];

    return entries.map((entry) => {
        const level = entry.good ? "good" : entry.ok ? "ok" : "poor";
        const status = entry.good ? "Great" : entry.ok ? "Usable" : "Limited";
        return { ...entry, level, status };
    });
}

function renderComparison(result) {
    const previous = loadHistory().find((item) => Boolean(item.localTest) === Boolean(result.localTest));
    if (!previous) {
        els.comparisonContext.textContent = "A previous result is needed for comparison.";
        els.comparisonGrid.innerHTML = `
            <div class="comparison-empty">Your next completed test will show changes in download, upload and ping.</div>
        `;
        return;
    }

    const previousDate = new Date(previous.timestamp);
    els.comparisonContext.textContent = `Compared with ${previousDate.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;

    const speedComparison = (label, current, prior) => {
        const change = prior > 0 ? ((current - prior) / prior) * 100 : 0;
        const state = Math.abs(change) < 1 ? "neutral" : change > 0 ? "positive" : "negative";
        const prefix = change > 0 ? "+" : "";
        return { label, value: `${prefix}${change.toFixed(1)}%`, state };
    };
    const pingChange = result.latency - previous.latency;
    const comparisons = [
        speedComparison("Download", result.download, previous.download),
        speedComparison("Upload", result.upload, previous.upload),
        {
            label: "Ping",
            value: `${pingChange > 0 ? "+" : ""}${formatLatency(pingChange)} ms`,
            state: Math.abs(pingChange) < 1 ? "neutral" : pingChange < 0 ? "positive" : "negative",
        },
    ];

    els.comparisonGrid.innerHTML = comparisons.map((item) => `
        <div class="comparison-card ${item.state}">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
        </div>
    `).join("");
}

function renderResult(result) {
    if (result.localTest) {
        result.quality = "Local test";
        result.score = null;
        els.qualityScore.textContent = "LOCAL";
        els.qualityScore.classList.add("local-score");
        els.qualityLabel.textContent = "Local test mode";
        els.qualitySummary.textContent = "This server is running on your device. These speeds measure local loopback performance, not your internet connection.";
        els.useCases.classList.add("hidden");
        els.useCases.innerHTML = "";
    } else {
        const quality = scoreConnection(result);
        result.quality = quality.label;
        result.score = quality.score;
        els.qualityScore.textContent = quality.score;
        els.qualityScore.classList.remove("local-score");
        els.qualityLabel.textContent = quality.label;
        els.qualitySummary.textContent = quality.summary;
        els.useCases.classList.remove("hidden");
        els.useCases.innerHTML = evaluateUseCases(result).map((item) => `
            <div class="use-case ${item.level}">
                <span>${item.name}</span>
                <span class="use-case-status">${item.status}</span>
            </div>
        `).join("");
    }

    const downloadLoadedLatency = getDownloadLoadedLatency(result);
    const uploadLoadedLatency = getUploadLoadedLatency(result);
    const grade = result.localTest ? "Not scored" : result.bufferbloatGrade || gradeBufferbloat(result.bufferbloat);
    els.downloadLoadedLatency.textContent = Number.isFinite(downloadLoadedLatency) ? `${formatLatency(downloadLoadedLatency)} ms` : "Unavailable";
    els.uploadLoadedLatency.textContent = Number.isFinite(uploadLoadedLatency) ? `${formatLatency(uploadLoadedLatency)} ms` : "Unavailable";
    els.bufferbloat.textContent = Number.isFinite(result.bufferbloat) ? `${result.bufferbloat >= 0 ? "+" : ""}${formatLatency(result.bufferbloat)} ms` : "Unavailable";
    els.bufferbloatGrade.textContent = grade;
    els.bufferbloatGrade.dataset.grade = result.localTest ? "local" : grade.replace("+", "plus").toLowerCase();
    els.packetLoss.textContent = Number.isFinite(result.packetLoss) ? formatPercent(result.packetLoss) : "Unavailable";
    els.downloadStability.textContent = formatStability(result.downloadStability);
    els.uploadStability.textContent = formatStability(result.uploadStability);
    els.duration.textContent = `${result.duration.toFixed(1)} s`;
    renderComparison(result);
    els.resultSection.classList.remove("hidden");
}

function optionalNumber(value, min = -Infinity, max = Infinity) {
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function sanitizeHistoryItem(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    if (typeof item.timestamp !== "string" || !Number.isFinite(Date.parse(item.timestamp))) return null;

    const latency = optionalNumber(item.latency, 0, 600000);
    const jitter = optionalNumber(item.jitter, 0, 600000);
    const download = optionalNumber(item.download, 0, 10000000);
    const upload = optionalNumber(item.upload, 0, 10000000);
    if (latency === null || jitter === null || download === null || upload === null) return null;

    const downloadLoadedLatency = optionalNumber(getDownloadLoadedLatency(item), 0, 600000);
    const uploadLoadedLatency = optionalNumber(getUploadLoadedLatency(item), 0, 600000);
    const calculatedIncreases = [
        downloadLoadedLatency === null ? null : downloadLoadedLatency - latency,
        uploadLoadedLatency === null ? null : uploadLoadedLatency - latency,
    ].filter(Number.isFinite);
    const suppliedBloat = optionalNumber(item.bufferbloat, -600000, 600000);
    const bufferbloat = suppliedBloat ?? (calculatedIncreases.length ? Math.max(...calculatedIncreases) : null);
    const localTest = item.localTest === true;
    const profile = Object.hasOwn(TEST_PROFILES, item.profile) ? item.profile : "standard";
    const allowedQuality = ["Excellent", "Very good", "Good", "Fair", "Limited", "Local test"];

    return {
        timestamp: new Date(item.timestamp).toISOString(),
        latency,
        jitter,
        packetLoss: optionalNumber(item.packetLoss, 0, 100) ?? 0,
        download,
        upload,
        downloadStability: optionalNumber(item.downloadStability, 0, 100),
        uploadStability: optionalNumber(item.uploadStability, 0, 100),
        downloadLoadedLatency,
        uploadLoadedLatency,
        loadedLatency: downloadLoadedLatency,
        downloadBufferbloat: downloadLoadedLatency === null ? null : downloadLoadedLatency - latency,
        uploadBufferbloat: uploadLoadedLatency === null ? null : uploadLoadedLatency - latency,
        bufferbloat,
        bufferbloatGrade: localTest ? null : gradeBufferbloat(bufferbloat),
        quality: localTest ? "Local test" : allowedQuality.includes(item.quality) ? item.quality : undefined,
        score: localTest ? null : optionalNumber(item.score, 0, 100),
        profile,
        duration: optionalNumber(item.duration, 0, 600) ?? 0,
        localTest,
    };
}

function loadHistory() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(parsed)) return [];
        return parsed.map(sanitizeHistoryItem).filter(Boolean).slice(0, HISTORY_LIMIT);
    } catch {
        return [];
    }
}

function saveHistory(history) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    } catch {
        showToast("Your browser could not save local test history.");
    }
}

function addHistory(result) {
    const history = loadHistory();
    history.unshift(result);
    saveHistory(history);
    renderHistory();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function historyItemKey(item) {
    return `${item.timestamp}|${item.download.toFixed(4)}|${item.upload.toFixed(4)}`;
}

function getFilteredHistory(history) {
    const type = els.historyTypeFilter.value;
    const profile = els.historyProfileFilter.value;
    return history.filter((item) => {
        const typeMatches = type === "all"
            || (type === "local" && item.localTest)
            || (type === "internet" && !item.localTest);
        return typeMatches && (profile === "all" || item.profile === profile);
    });
}

function resetDeleteResultConfirmation() {
    window.clearTimeout(deleteResultTimer);
    els.deleteHistoryResult.dataset.confirming = "false";
    els.deleteHistoryResult.textContent = "Delete result";
}

function openHistoryDetails(key) {
    const item = loadHistory().find((entry) => historyItemKey(entry) === key);
    if (!item) {
        showToast("That saved result is no longer available.");
        renderHistory();
        return;
    }

    selectedHistoryKey = key;
    resetDeleteResultConfirmation();
    const date = new Date(item.timestamp);
    const quality = item.quality || (item.localTest ? "Local test" : scoreConnection(item).label);
    const score = item.localTest ? "Not scored" : `${item.score ?? scoreConnection(item).score}/100`;
    const loadedDownload = getDownloadLoadedLatency(item);
    const loadedUpload = getUploadLoadedLatency(item);
    const bloatGrade = item.localTest ? "Not scored" : item.bufferbloatGrade || gradeBufferbloat(item.bufferbloat);
    const profileName = `${item.profile[0].toUpperCase()}${item.profile.slice(1)}`;
    const details = [
        ["Download", `${formatSpeed(item.download)} Mbps`],
        ["Upload", `${formatSpeed(item.upload)} Mbps`],
        ["Ping", `${formatLatency(item.latency)} ms`],
        ["Jitter", `${formatLatency(item.jitter)} ms`],
        ["Download stability", formatStability(item.downloadStability)],
        ["Upload stability", formatStability(item.uploadStability)],
        ["Download loaded latency", Number.isFinite(loadedDownload) ? `${formatLatency(loadedDownload)} ms` : "Unavailable"],
        ["Upload loaded latency", Number.isFinite(loadedUpload) ? `${formatLatency(loadedUpload)} ms` : "Unavailable"],
        ["Worst latency increase", Number.isFinite(item.bufferbloat) ? `${item.bufferbloat >= 0 ? "+" : ""}${formatLatency(item.bufferbloat)} ms` : "Unavailable"],
        ["Bufferbloat grade", bloatGrade],
        ["Ping sample loss", formatPercent(item.packetLoss)],
        ["Profile", profileName],
        ["Duration", `${item.duration.toFixed(1)} s`],
        ["Quality", quality],
        ["Score", score],
        ["Test mode", item.localTest ? "Local loopback" : "Internet"],
    ];

    els.historyDialogDate.textContent = date.toLocaleString([], { dateStyle: "full", timeStyle: "medium" });
    els.historyDialogMetrics.innerHTML = details.map(([label, value]) => `
        <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
    `).join("");

    if (typeof els.historyDialog.showModal === "function") els.historyDialog.showModal();
    else els.historyDialog.setAttribute("open", "");
}

function deleteSelectedHistoryResult() {
    if (!selectedHistoryKey) return;
    if (els.deleteHistoryResult.dataset.confirming !== "true") {
        els.deleteHistoryResult.dataset.confirming = "true";
        els.deleteHistoryResult.textContent = "Confirm delete";
        showToast("Click Confirm delete to remove only this result.");
        deleteResultTimer = window.setTimeout(resetDeleteResultConfirmation, 4000);
        return;
    }

    const history = loadHistory();
    const remaining = history.filter((item) => historyItemKey(item) !== selectedHistoryKey);
    saveHistory(remaining);
    if (typeof els.historyDialog.close === "function") els.historyDialog.close();
    else els.historyDialog.removeAttribute("open");
    selectedHistoryKey = null;
    resetDeleteResultConfirmation();
    renderHistory();
    showToast("Saved result deleted.");
}

function renderHistory() {
    const history = loadHistory();
    const filteredHistory = getFilteredHistory(history);
    const hasHistory = history.length > 0;
    const hasFilteredHistory = filteredHistory.length > 0;

    els.historyBody.innerHTML = filteredHistory.map((item) => {
        const date = new Date(item.timestamp);
        const quality = item.quality || (item.localTest ? "Local test" : scoreConnection(item).label);
        const bloatGrade = item.localTest ? "Local" : item.bufferbloatGrade || gradeBufferbloat(item.bufferbloat);
        const key = historyItemKey(item);
        return `
            <tr>
                <td>${escapeHtml(date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</td>
                <td>${formatLatency(item.latency)} ms</td>
                <td class="speed-cell">${formatSpeed(item.download)} Mbps</td>
                <td class="speed-cell">${formatSpeed(item.upload)} Mbps</td>
                <td><span class="grade-badge" data-grade="${escapeHtml(String(bloatGrade).replace("+", "plus").toLowerCase())}">${escapeHtml(bloatGrade)}</span></td>
                <td><span class="quality-badge">${escapeHtml(quality)}</span></td>
                <td><button class="history-view" type="button" data-history-key="${escapeHtml(key)}" aria-label="View details for test from ${escapeHtml(date.toLocaleString())}">View</button></td>
            </tr>
        `;
    }).join("");

    els.historyEmpty.classList.toggle("hidden", hasFilteredHistory);
    els.historyBody.parentElement.classList.toggle("hidden", !hasFilteredHistory);
    els.historyEmptyTitle.textContent = hasHistory ? "No results match these filters" : "No test history yet";
    els.historyEmptyText.textContent = hasHistory
        ? "Choose a different test type or profile to see saved results."
        : "Your completed tests will be stored locally in this browser.";
    els.historyFilterSummary.textContent = hasHistory
        ? `Showing ${filteredHistory.length} of ${history.length} saved result${history.length === 1 ? "" : "s"}`
        : "No saved results";
    els.historyTypeFilter.disabled = !hasHistory;
    els.historyProfileFilter.disabled = !hasHistory;
    els.clearHistory.disabled = !hasHistory;
    els.exportHistory.disabled = !hasHistory;
    els.backupHistory.disabled = !hasHistory;
    renderHistoryInsights(history);
    drawHistoryChart(history);
}

function renderHistoryInsights(history) {
    if (!history.length) {
        els.insightSample.textContent = "No completed tests";
        els.averageDownload.textContent = "—";
        els.averageUpload.textContent = "—";
        els.bestDownload.textContent = "—";
        els.averagePing.textContent = "—";
        return;
    }

    els.insightSample.textContent = `${history.length} test${history.length === 1 ? "" : "s"} stored locally`;
    els.averageDownload.textContent = formatSpeed(average(history.map((item) => item.download)));
    els.averageUpload.textContent = formatSpeed(average(history.map((item) => item.upload)));
    els.bestDownload.textContent = formatSpeed(Math.max(...history.map((item) => item.download)));
    els.averagePing.textContent = formatLatency(average(history.map((item) => item.latency)));
}

function cssColor(variable) {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

function drawHistoryChart(history) {
    const canvas = els.historyChart;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(Math.round(rect.width), 300);
    const height = Math.max(Math.round(rect.height), 180);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const points = [...history].reverse().slice(-12);
    els.emptyChart.classList.toggle("hidden", points.length > 0);
    if (!points.length) return;

    const pad = { top: 16, right: 12, bottom: 28, left: 38 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxValue = Math.max(10, ...points.map((item) => Math.max(item.download, item.upload))) * 1.12;
    const gridColor = cssColor("--line-strong");
    const textColor = cssColor("--muted");
    const downloadColor = cssColor("--primary");
    const uploadColor = cssColor("--secondary");

    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = textColor;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i += 1) {
        const y = pad.top + (chartH * i) / 4;
        const value = maxValue * (1 - i / 4);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillText(value >= 100 ? value.toFixed(0) : value.toFixed(1), pad.left - 7, y);
    }

    const xFor = (index) => points.length === 1
        ? pad.left + chartW / 2
        : pad.left + (chartW * index) / (points.length - 1);
    const yFor = (value) => pad.top + chartH - (clamp(value, 0, maxValue) / maxValue) * chartH;

    function drawSeries(key, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.25;
        ctx.beginPath();
        points.forEach((point, index) => {
            const x = xFor(index);
            const y = yFor(point[key]);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.fillStyle = color;
        points.forEach((point, index) => {
            ctx.beginPath();
            ctx.arc(xFor(index), yFor(point[key]), 3.2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawSeries("download", downloadColor);
    drawSeries("upload", uploadColor);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = textColor;
    const labelsToShow = points.length <= 6 ? points.length : 4;
    for (let i = 0; i < labelsToShow; i += 1) {
        const index = labelsToShow === 1 ? 0 : Math.round((i * (points.length - 1)) / (labelsToShow - 1));
        const date = new Date(points[index].timestamp);
        ctx.fillText(date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), xFor(index), height - pad.bottom + 8);
    }
}

async function loadNetworkDetails() {
    try {
        const response = await fetch(`api/network.php?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Network info unavailable");
        const data = await response.json();
        els.ipAddress.textContent = data.ip || "Unavailable";
        const protocol = data.protocol ? data.protocol.replace("HTTP/", "HTTP ") : "Unknown";
        els.protocol.textContent = `${protocol}${data.secure ? " · HTTPS" : ""}`;
    } catch {
        els.ipAddress.textContent = "Unavailable";
        els.protocol.textContent = "Unavailable";
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
        const type = connection.effectiveType ? connection.effectiveType.toUpperCase() : connection.type || "Unknown";
        els.connectionType.textContent = type;
        const details = [];
        if (Number.isFinite(connection.downlink)) details.push(`≈ ${connection.downlink} Mbps downlink`);
        if (Number.isFinite(connection.rtt)) details.push(`≈ ${connection.rtt} ms RTT`);
        els.browserEstimate.textContent = details.length ? details.join(" · ") : "Not exposed by browser";
    } else {
        els.connectionType.textContent = "Not exposed by browser";
        els.browserEstimate.textContent = "Not exposed by browser";
    }
}

function getShareText(result) {
    const metrics = `Pulse speed test: ${formatSpeed(result.download)} Mbps down, ${formatSpeed(result.upload)} Mbps up, ${formatLatency(result.latency)} ms ping, ${formatLatency(result.jitter)} ms jitter`;
    const stability = getOverallStability(result);
    const stabilityText = Number.isFinite(stability) ? `, ${stability.toFixed(0)}% throughput stability` : "";
    return result.localTest
        ? `${metrics}${stabilityText} — local loopback test, not an internet-speed measurement.`
        : `${metrics}${stabilityText}, ${formatPercent(result.packetLoss)} ping sample loss — ${result.quality} (${result.score}/100), bufferbloat ${result.bufferbloatGrade}.`;
}

function drawShareCard(result) {
    const canvas = els.shareCanvas;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#07111f");
    bg.addColorStop(0.58, "#0d1d31");
    bg.addColorStop(1, "#172554");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(960, 100, 10, 960, 100, 390);
    glow.addColorStop(0, "rgba(103,232,249,0.18)");
    glow.addColorStop(1, "rgba(103,232,249,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#67e8f9";
    ctx.font = "700 30px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("PULSE", 74, 80);

    ctx.fillStyle = "#f4f8ff";
    ctx.font = "700 54px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Internet speed test", 74, 152);

    ctx.fillStyle = "#8fa4bd";
    ctx.font = "400 24px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(new Date(result.timestamp).toLocaleString(), 76, 196);

    const metrics = [
        ["DOWNLOAD", `${formatSpeed(result.download)} Mbps`],
        ["UPLOAD", `${formatSpeed(result.upload)} Mbps`],
        ["PING", `${formatLatency(result.latency)} ms`],
        ["JITTER", `${formatLatency(result.jitter)} ms`],
    ];

    metrics.forEach(([label, value], index) => {
        const x = 76 + (index % 2) * 520;
        const y = 290 + Math.floor(index / 2) * 135;
        ctx.fillStyle = "#8fa4bd";
        ctx.font = "700 17px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(label, x, y);
        ctx.fillStyle = "#f4f8ff";
        ctx.font = "700 46px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(value, x, y + 52);
    });

    ctx.fillStyle = "#67e8f9";
    ctx.font = "700 20px ui-sans-serif, system-ui, sans-serif";
    const stability = getOverallStability(result);
    const stabilitySuffix = Number.isFinite(stability) ? ` · Stability ${stability.toFixed(0)}%` : "";
    const footer = result.localTest
        ? "Local loopback test · no internet score"
        : `${result.quality} · ${result.score}/100 · Bufferbloat ${result.bufferbloatGrade} · Loss ${formatPercent(result.packetLoss)}${stabilitySuffix}`;
    ctx.fillText(footer, 76, 580);

    ctx.textAlign = "right";
    ctx.fillStyle = "#8fa4bd";
    ctx.font = "400 18px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Browser-based measurement", width - 76, 580);
    ctx.textAlign = "left";

    return canvas;
}

function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
}

async function shareCurrentResult() {
    if (!currentResult) return;
    const text = getShareText(currentResult);
    const canvas = drawShareCard(currentResult);
    const blob = await canvasToBlob(canvas);
    const file = blob ? new File([blob], "pulse-speed-test.png", { type: "image/png" }) : null;

    try {
        if (navigator.share && (!file || !navigator.canShare || navigator.canShare({ files: [file] }))) {
            const payload = { title: "Pulse Internet Speed Test", text };
            if (file) payload.files = [file];
            await navigator.share(payload);
            return;
        }
        await navigator.clipboard.writeText(text);
        showToast("Result copied to clipboard.");
    } catch (error) {
        if (error?.name !== "AbortError") {
            try {
                await navigator.clipboard.writeText(text);
                showToast("Result copied to clipboard.");
            } catch {
                showToast("Sharing is not available in this browser.");
            }
        }
    }
}

async function saveCurrentResultCard() {
    if (!currentResult) return;
    const blob = await canvasToBlob(drawShareCard(currentResult));
    if (!blob) {
        showToast("Could not create the result image.");
        return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pulse-speed-test-${new Date(currentResult.timestamp).toISOString().replace(/[:.]/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Result card saved.");
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportHistoryCsv() {
    const history = loadHistory();
    if (!history.length) return;

    const rows = [
        ["Timestamp", "Profile", "Ping ms", "Jitter ms", "Ping sample loss %", "Download Mbps", "Upload Mbps", "Download stability %", "Upload stability %", "Download loaded latency ms", "Upload loaded latency ms", "Worst latency increase ms", "Bufferbloat grade", "Quality", "Score", "Local test"],
        ...history.map((item) => [
            item.timestamp,
            item.profile || "standard",
            item.latency,
            item.jitter,
            item.packetLoss ?? "",
            item.download,
            item.upload,
            item.downloadStability ?? "",
            item.uploadStability ?? "",
            getDownloadLoadedLatency(item) ?? "",
            getUploadLoadedLatency(item) ?? "",
            item.bufferbloat ?? "",
            item.localTest ? "Not scored" : item.bufferbloatGrade ?? gradeBufferbloat(item.bufferbloat),
            item.quality ?? "",
            item.score ?? "",
            item.localTest ? "yes" : "no",
        ]),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `pulse-speed-history-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    showToast("CSV history export saved.");
}

function backupHistoryJson() {
    const history = loadHistory();
    if (!history.length) return;

    const payload = {
        format: "pulse-speed-history",
        version: 2,
        exportedAt: new Date().toISOString(),
        tests: history,
    };
    downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
        `pulse-speed-history-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
    showToast("JSON history backup saved.");
}

async function restoreHistoryJson(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
        if (file.size > 2 * 1024 * 1024) {
            throw new Error("The history backup is larger than the 2 MB import limit.");
        }

        const parsed = JSON.parse(await file.text());
        const candidates = Array.isArray(parsed) ? parsed : parsed?.format === "pulse-speed-history" ? parsed.tests : null;
        if (!Array.isArray(candidates)) {
            throw new Error("This is not a Pulse history backup.");
        }

        const restored = candidates.map(sanitizeHistoryItem).filter(Boolean);
        if (!restored.length) {
            throw new Error("The backup does not contain any valid test results.");
        }

        const existing = loadHistory();
        const combined = [...existing, ...restored];
        const unique = new Map();
        combined.forEach((item) => {
            const key = historyItemKey(item);
            if (!unique.has(key)) unique.set(key, item);
        });
        const merged = Array.from(unique.values())
            .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
            .slice(0, HISTORY_LIMIT);

        saveHistory(merged);
        renderHistory();
        const skipped = candidates.length - restored.length;
        const duplicates = combined.length - unique.size;
        const added = Math.max(0, unique.size - existing.length);
        showToast(`Added ${added} new result${added === 1 ? "" : "s"}${duplicates ? `; ignored ${duplicates} duplicate${duplicates === 1 ? "" : "s"}` : ""}${skipped ? `; skipped ${skipped} invalid` : ""}.`);
    } catch (error) {
        showToast(error?.message || "The history backup could not be restored.");
    } finally {
        input.value = "";
    }
}

function cancelActiveTest() {
    if (!running) return;
    activeAbortController?.abort();
    activeUploadRequests.forEach((xhr) => xhr.abort());
    activeUploadRequests = [];
}

async function runSpeedTest() {
    if (running) return;
    if (!navigator.onLine || serverReachable !== true) {
        showToast("Reconnect to the server before starting a speed test.");
        return;
    }
    running = true;
    activeAbortController = new AbortController();
    activeUploadRequests = [];
    const testStartedAt = performance.now();

    els.startButton.disabled = true;
    els.startButton.querySelector("span").textContent = "Testing…";
    els.cancelButton.classList.remove("hidden");
    els.profileSelector.setAttribute("aria-disabled", "true");
    setProfileControlsDisabled(true);
    els.resultSection.classList.add("hidden");
    resetMetrics();

    try {
        setStage("Latency", "Warming up the connection and measuring idle latency…", 3);
        const latencyResult = await measureIdleLatency();
        els.latency.textContent = formatLatency(latencyResult.latency);
        els.jitter.textContent = formatLatency(latencyResult.jitter);

        const profile = getActiveProfile();
        setStage("Download", `Calibrating, then measuring sustained download throughput for about ${profile.downloadMs / 1000} seconds…`, 25);
        let loadedLatencyLive = null;
        const downloadResult = await measureDownloadSpeed((value) => {
            loadedLatencyLive = value;
        });
        els.download.textContent = formatSpeed(downloadResult.speed);

        setStage("Upload", `Calibrating, then measuring sustained upload throughput for about ${profile.uploadMs / 1000} seconds…`, 68);
        let uploadLoadedLatencyLive = null;
        const uploadResult = await measureUploadSpeed((value) => {
            uploadLoadedLatencyLive = value;
        });
        els.upload.textContent = formatSpeed(uploadResult.speed);

        const duration = (performance.now() - testStartedAt) / 1000;
        const downloadLoadedLatency = downloadResult.loadedLatency ?? loadedLatencyLive;
        const uploadLoadedLatency = uploadResult.loadedLatency ?? uploadLoadedLatencyLive;
        const downloadBufferbloat = Number.isFinite(downloadLoadedLatency) ? downloadLoadedLatency - latencyResult.latency : null;
        const uploadBufferbloat = Number.isFinite(uploadLoadedLatency) ? uploadLoadedLatency - latencyResult.latency : null;
        const increases = [downloadBufferbloat, uploadBufferbloat].filter(Number.isFinite);
        const bufferbloat = increases.length ? Math.max(...increases) : null;

        const result = {
            timestamp: new Date().toISOString(),
            latency: latencyResult.latency,
            jitter: latencyResult.jitter,
            download: downloadResult.speed,
            upload: uploadResult.speed,
            downloadStability: downloadResult.stability,
            uploadStability: uploadResult.stability,
            packetLoss: latencyResult.packetLoss,
            downloadLoadedLatency,
            uploadLoadedLatency,
            loadedLatency: downloadLoadedLatency,
            downloadBufferbloat,
            uploadBufferbloat,
            bufferbloat,
            bufferbloatGrade: LOCAL_TEST_MODE ? null : gradeBufferbloat(bufferbloat),
            profile: activeProfileId,
            duration,
            localTest: LOCAL_TEST_MODE,
        };

        renderResult(result);
        currentResult = result;
        addHistory(result);

        if (result.localTest) {
            setGauge(result.download, "Mbps", "Local loopback test · not internet speed");
            setStage("Complete", "Local test complete. These results measure this device against itself and are not an internet-speed score.", 100);
        } else {
            setGauge(result.download, "Mbps", `${result.quality} connection · ${result.score}/100`);
            setStage("Complete", "Speed test complete. Your result has been saved locally.", 100);
        }
    } catch (error) {
        if (error instanceof TestCancelledError || activeAbortController?.signal.aborted) {
            setStage("Cancelled", "The speed test was cancelled. No partial result was saved.", 0);
            setGauge(0, "Mbps", "Test cancelled");
        } else {
            console.error(error);
            setStage("Error", "The test could not finish. Check the server and your connection, then try again.", 0);
            setGauge(0, "Mbps", "Test failed");
            showToast(error?.message || "The speed test failed.");
        }
    } finally {
        running = false;
        activeAbortController = null;
        activeUploadRequests = [];
        els.startButton.disabled = !navigator.onLine || serverReachable !== true;
        els.startButton.querySelector("span").textContent = "Test again";
        els.cancelButton.classList.add("hidden");
        els.profileSelector.setAttribute("aria-disabled", "false");
        setProfileControlsDisabled(false);
    }
}

function updateOnlineState() {
    const deviceOnline = navigator.onLine;
    const available = deviceOnline && serverReachable === true;
    els.offlineBanner.classList.toggle("hidden", available);
    if (!running) els.startButton.disabled = !available;

    if (!deviceOnline) {
        els.offlineBanner.textContent = "You are offline. Saved history is still available, but a speed test needs a connection to this server.";
        if (running) cancelActiveTest();
        els.status.textContent = "Offline mode: saved history is available, but measurements are paused.";
    } else if (serverReachable === false) {
        els.offlineBanner.textContent = "The Pulse server is unavailable. The app shell and saved history still work, but measurements are paused.";
        if (running) cancelActiveTest();
        els.status.textContent = "Server unavailable: reconnect to Pulse before starting a measurement.";
    } else if (serverReachable === null) {
        els.offlineBanner.textContent = "Checking the connection to the Pulse server…";
    } else if (!running && els.stageLabel.textContent === "READY") {
        els.status.textContent = "No test running. Choose a profile and start when ready.";
    }
}

async function checkServerAvailability() {
    if (!navigator.onLine) {
        serverReachable = false;
        updateOnlineState();
        return;
    }

    serverReachable = null;
    updateOnlineState();
    try {
        const response = await fetch(`api/health.php?t=${Date.now()}`, { cache: "no-store" });
        serverReachable = response.ok;
    } catch {
        serverReachable = false;
    }
    updateOnlineState();
}

async function installPulseApp() {
    if (!installPromptEvent) return;
    const promptEvent = installPromptEvent;
    installPromptEvent = null;
    els.installApp.classList.add("hidden");
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
}

function initializePwa() {
    if ("serviceWorker" in navigator && (window.isSecureContext || LOCAL_TEST_MODE)) {
        navigator.serviceWorker.register("service-worker.js", { scope: "./" }).catch(() => {
            // The tester remains fully usable when service workers are unavailable.
        });
    }

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        installPromptEvent = event;
        els.installApp.classList.remove("hidden");
    });
    window.addEventListener("appinstalled", () => {
        installPromptEvent = null;
        els.installApp.classList.add("hidden");
        showToast("Pulse was installed successfully.");
    });
}

function applyTheme(theme) {
    const normalized = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = normalized;
    try {
        localStorage.setItem(THEME_KEY, normalized);
    } catch {
        // Theme persistence is optional.
    }
    window.clearTimeout(chartResizeTimer);
    chartResizeTimer = window.setTimeout(() => drawHistoryChart(loadHistory()), 30);
}

function initializeTheme() {
    let saved = null;
    try {
        saved = localStorage.getItem(THEME_KEY);
    } catch {
        // Ignore storage restrictions.
    }
    if (saved === "light" || saved === "dark") {
        applyTheme(saved);
        return;
    }
    applyTheme(window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

els.startButton.addEventListener("click", runSpeedTest);
els.cancelButton.addEventListener("click", cancelActiveTest);
els.installApp.addEventListener("click", installPulseApp);
profileInputs.forEach((input) => {
    input.addEventListener("change", () => {
        if (!input.checked || running) return;
        applyTestProfile(input.value);
        const profile = getActiveProfile();
        els.status.textContent = `${input.value[0].toUpperCase()}${input.value.slice(1)} profile selected · about ${(profile.downloadMs + profile.uploadMs) / 1000} seconds of throughput measurement.`;
    });
});
els.themeToggle.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
els.historyShortcut.addEventListener("click", () => {
    els.historySection.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
        try {
            els.historySection.focus({ preventScroll: true });
        } catch {
            els.historySection.focus();
        }
    }, 450);
});
els.clearHistory.addEventListener("click", () => {
    if (els.clearHistory.dataset.confirming !== "true") {
        els.clearHistory.dataset.confirming = "true";
        els.clearHistory.textContent = "Confirm clear";
        showToast("Click Confirm clear to permanently remove local history.");
        window.clearTimeout(clearHistoryTimer);
        clearHistoryTimer = window.setTimeout(() => {
            els.clearHistory.dataset.confirming = "false";
            els.clearHistory.textContent = "Clear history";
        }, 4000);
        return;
    }

    window.clearTimeout(clearHistoryTimer);
    els.clearHistory.dataset.confirming = "false";
    els.clearHistory.textContent = "Clear history";
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore storage restrictions.
    }
    renderHistory();
    showToast("Local test history cleared.");
});
els.exportHistory.addEventListener("click", exportHistoryCsv);
els.backupHistory.addEventListener("click", backupHistoryJson);
els.restoreHistory.addEventListener("change", restoreHistoryJson);
els.historyTypeFilter.addEventListener("change", renderHistory);
els.historyProfileFilter.addEventListener("change", renderHistory);
els.historyBody.addEventListener("click", (event) => {
    const button = event.target.closest(".history-view");
    if (button) openHistoryDetails(button.dataset.historyKey);
});
els.deleteHistoryResult.addEventListener("click", deleteSelectedHistoryResult);
els.historyDialog.addEventListener("close", () => {
    selectedHistoryKey = null;
    resetDeleteResultConfirmation();
});
els.shareResult.addEventListener("click", shareCurrentResult);
els.saveResultCard.addEventListener("click", saveCurrentResultCard);
window.addEventListener("resize", () => {
    window.clearTimeout(chartResizeTimer);
    chartResizeTimer = window.setTimeout(() => drawHistoryChart(loadHistory()), 120);
});
window.addEventListener("online", checkServerAvailability);
window.addEventListener("offline", () => {
    serverReachable = false;
    updateOnlineState();
});

initializeTheme();
initializeTestProfile();
initializePwa();
renderHistory();
loadNetworkDetails();
updateOnlineState();
checkServerAvailability();
