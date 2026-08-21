<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_method('GET');

json_response([
    'status' => 'ok',
    'server_time' => microtime(true),
]);
