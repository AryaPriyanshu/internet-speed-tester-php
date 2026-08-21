<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_method('POST');

$maxBytes = 4 * 1024 * 1024;
$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;

if ($contentLength > $maxBytes) {
    json_response([
        'status' => 'error',
        'message' => 'Upload payload exceeds the test limit.',
        'max_bytes' => $maxBytes,
    ], 413);
}

$input = fopen('php://input', 'rb');
if ($input === false) {
    json_response(['status' => 'error', 'message' => 'Could not read upload stream.'], 500);
}

$received = 0;
while (!feof($input)) {
    $chunk = fread($input, 64 * 1024);
    if ($chunk === false) {
        fclose($input);
        json_response(['status' => 'error', 'message' => 'Upload stream read failed.'], 500);
    }
    $received += strlen($chunk);
    if ($received > $maxBytes) {
        fclose($input);
        json_response(['status' => 'error', 'message' => 'Upload payload exceeds the test limit.'], 413);
    }
}
fclose($input);

json_response([
    'status' => 'ok',
    'received_bytes' => $received,
    'server_time' => microtime(true),
]);
