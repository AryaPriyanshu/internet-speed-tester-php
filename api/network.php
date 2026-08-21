<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_method('GET');

$remoteAddress = $_SERVER['REMOTE_ADDR'] ?? null;
$trustProxy = getenv('PULSE_TRUST_PROXY') === '1';

// Forwarding headers are client-controlled on a directly exposed server. They
// are only considered when the operator explicitly opts into trusted-proxy mode.
if ($trustProxy && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
    $candidate = trim((string)$_SERVER['HTTP_CF_CONNECTING_IP']);
    if (filter_var($candidate, FILTER_VALIDATE_IP)) {
        $remoteAddress = $candidate;
    }
} elseif ($trustProxy && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $candidate = trim(explode(',', (string)$_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    if (filter_var($candidate, FILTER_VALIDATE_IP)) {
        $remoteAddress = $candidate;
    }
}

if ($remoteAddress !== null && !filter_var($remoteAddress, FILTER_VALIDATE_IP)) {
    $remoteAddress = null;
}

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443)
    || ($trustProxy && strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https')
    || ($trustProxy && isset($_SERVER['HTTP_CF_VISITOR']) && str_contains((string)$_SERVER['HTTP_CF_VISITOR'], 'https'));

json_response([
    'status' => 'ok',
    'ip' => $remoteAddress,
    'protocol' => $_SERVER['SERVER_PROTOCOL'] ?? null,
    'secure' => $https,
]);
