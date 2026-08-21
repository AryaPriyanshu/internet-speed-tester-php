<?php
declare(strict_types=1);

function apply_common_headers(string $contentType): void
{
    header('Content-Type: ' . $contentType);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: no-referrer');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('X-Accel-Buffering: no');
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    apply_common_headers('application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function require_method(string $method): void
{
    $actual = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($actual !== strtoupper($method)) {
        header('Allow: ' . strtoupper($method));
        json_response(['status' => 'error', 'message' => 'Method not allowed.'], 405);
    }
}
