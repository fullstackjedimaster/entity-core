FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates curl \
      build-essential gcc \
      libpq-dev \
    ; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /entity-core-api

RUN useradd -m -u 1001 -s /usr/sbin/nologin appuser

COPY --from=repo entity-core-api/requirements.txt /entity-core-api/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel \
 && python -m pip install --no-cache-dir -r /entity-core-api/requirements.txt

COPY --from=repo entity-core-api/ /entity-core-api/

EXPOSE 8004

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
