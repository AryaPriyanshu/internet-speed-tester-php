<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$data = file_get_contents('php://input');

echo json_encode([
    'received_bytes' => strlen($data),
    'status' => 'ok'
]);
