FROM python:3.13-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="/app:/app/backend"

COPY services/mqtt-ingestor/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY packages ./packages
COPY services/mqtt-ingestor/main.py ./

CMD ["python", "main.py"]
