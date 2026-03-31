FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config/ config/
COPY src/ src/

# data/와 secrets/는 볼륨으로 마운트
RUN mkdir -p data secrets

CMD ["python", "-m", "src.scripts.analyze_recent_videos"]
