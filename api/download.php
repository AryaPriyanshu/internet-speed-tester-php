<?php
header('Content-Type: application/octet-stream');
header('Cache-Control: no-store');

$size = 2 * 1024 * 1024;
echo random_bytes($size);
