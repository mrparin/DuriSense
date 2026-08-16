FROM python:3.13.7-slim

ARG INSTALL_TEST=false

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN addgroup --system durisense && adduser --system --ingroup durisense durisense

COPY pyproject.toml README.md ./
COPY app ./app
COPY alembic.ini ./
COPY migrations ./migrations
COPY tests ./tests
RUN if [ "$INSTALL_TEST" = "true" ]; then pip install --no-cache-dir ".[test]"; else pip install --no-cache-dir .; fi

USER durisense
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
