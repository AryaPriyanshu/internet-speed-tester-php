<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_method('GET');

$minBytes = 64 * 1024;
$maxBytes = 12 * 1024 * 1024;
$requested = filter_input(INPUT_GET, 'bytes', FILTER_VALIDATE_INT);
$size = $requested === false || $requested === null ? 1024 * 1024 : $requested;
$size = max($minBytes, min($maxBytes, $size));

apply_common_headers('application/octet-stream');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, no-transform');
header('Content-Length: ' . $size);
header('Content-Disposition: inline; filename="speed-test.bin"');
header('Content-Encoding: identity');

// Generate one incompressible block per request and reuse it while explicitly
// disabling transformations. This avoids making cryptographic randomness a CPU
// bottleneck in the throughput measurement while keeping memory use bounded.
$remaining = $size;
$chunkSize = 256 * 1024;
$chunk = random_bytes(min($chunkSize, $size));

while ($remaining > 0) {
    $length = min($chunkSize, $remaining);
    echo $length === strlen($chunk) ? $chunk : substr($chunk, 0, $length);
    $remaining -= $length;

    if (function_exists('ob_flush')) {
        @ob_flush();
    }
    flush();

    if (connection_aborted()) {
        break;
    }
}
