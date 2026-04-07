FROM python:3.13-slim

WORKDIR /deploy

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      tini \
      ca-certificates \
      postgresql-client \
      bash \
      openssl \
    ; \
    rm -rf /var/lib/apt/lists/*; \
    command -v psql; \
    command -v pg_isready;

# Copy deploy scripts (includes rag.sql)
COPY deploy/scripts/ /deploy/scripts/
RUN chmod +x /deploy/scripts/*.sh

ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["bash", "-lc", "echo bootstrap ready"]
