FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Saheli's voice without any API key: open-source Piper TTS with the Hindi woman's voice "priyamvada"
COPY requirements-voice.txt .
RUN pip install --no-cache-dir -r requirements-voice.txt && mkdir -p /opt/piper && python -c "\
import urllib.request as u; b='https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx'; \
u.urlretrieve(b, '/opt/piper/hi_IN-priyamvada-medium.onnx'); u.urlretrieve(b + '.json', '/opt/piper/hi_IN-priyamvada-medium.onnx.json')"
COPY app ./app
# run as an unprivileged user; /data is the only writable place
RUN useradd --create-home --uid 10001 saheli && mkdir -p /data/sites /data/private /data/uploads && chown -R saheli /data
USER saheli
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--timeout-keep-alive", "30"]
