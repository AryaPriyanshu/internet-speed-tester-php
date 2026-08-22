<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_method('GET');

json_response([
    'status' => 'ok',
    'service' => 'pulse-speed-test',
    'version' => 'phase-2.3',
    'capabilities' => ['download', 'upload', 'latency', 'jitter', 'loaded-latency', 'ping-sample-loss', 'throughput-stability', 'test-profiles', 'filterable-history', 'portable-history', 'pwa'],
    'server_time' => gmdate('c'),
]);
