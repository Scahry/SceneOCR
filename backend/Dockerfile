
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

ARG USE_GPU=false
ARG ONNXRUNTIME_VERSION=1.32.0

# Install application dependencies first.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir rapidocr-onnxruntime \
    && pip install --no-cache-dir -r requirements.txt

# Remove any CPU/GPU ONNX Runtime packages installed by other dependencies.
# Then install exactly one version, matching the selected configuration.
RUN pip uninstall -y onnxruntime onnxruntime-gpu || true

RUN if [ "$USE_GPU" = "true" ]; then \
        echo "[build] Installing ONNX Runtime GPU with CUDA 13 and cuDNN 9" \
        && pip install --no-cache-dir \
            "onnxruntime-gpu[cuda,cudnn]==${ONNXRUNTIME_VERSION}"; \
    else \
        echo "[build] Installing ONNX Runtime CPU" \
        && pip install --no-cache-dir \
            "onnxruntime==${ONNXRUNTIME_VERSION}"; \
    fi

# CUDA 13 consolidated NVIDIA libraries.
# cuDNN remains in its separate package directory.
ENV LD_LIBRARY_PATH="/usr/local/lib/python3.11/site-packages/nvidia/cu13/lib:/usr/local/lib/python3.11/site-packages/nvidia/cudnn/lib:${LD_LIBRARY_PATH}"

COPY . .

RUN mkdir -p /app/uploads /app/jobs

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
