#!/bin/sh
set -eu

pulse_port="${PORT:-10000}"

case "$pulse_port" in
    ''|*[!0-9]*)
        echo "PORT must be a number between 1 and 65535." >&2
        exit 1
        ;;
esac

if [ "$pulse_port" -lt 1 ] || [ "$pulse_port" -gt 65535 ]; then
    echo "PORT must be a number between 1 and 65535." >&2
    exit 1
fi

sed -ri "s/^Listen [0-9]+$/Listen ${pulse_port}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${pulse_port}>/" /etc/apache2/sites-available/000-default.conf

exec docker-php-entrypoint "$@"
