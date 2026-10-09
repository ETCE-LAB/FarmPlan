FROM python:3.10-slim

WORKDIR /app

# rasterio wheels need libexpat at runtime, which slim images don't ship
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

ENV FLASK_ENV=production
ENV FLASK_PORT=5000

CMD ["python", "app.py"]