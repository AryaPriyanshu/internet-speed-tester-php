FROM php:8.4-apache-bookworm

WORKDIR /var/www/html

COPY docker-pulse.conf /etc/apache2/conf-available/zz-pulse.conf
COPY docker-php.ini /usr/local/etc/php/conf.d/pulse.ini
RUN a2enmod headers expires \
    && a2enconf zz-pulse

COPY --chown=www-data:www-data index.php manifest.webmanifest service-worker.js /var/www/html/
COPY --chown=www-data:www-data assets/ /var/www/html/assets/
COPY --chown=www-data:www-data api/ /var/www/html/api/
COPY docker-entrypoint-pulse.sh /usr/local/bin/docker-entrypoint-pulse

RUN chmod 0755 /usr/local/bin/docker-entrypoint-pulse

ENV PORT=10000

EXPOSE 10000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-pulse"]
CMD ["apache2-foreground"]
