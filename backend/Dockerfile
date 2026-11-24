
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Install application dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Install ONNX Runtime GPU with CUDA and cuDNN dependencies
RUN pip install --no-cache-dir \
    "onnxruntime-gpu[cuda,cudnn]"

# CUDA / cuDNN libraries installed through NVIDIA Python packages
ENV LD_LIBRARY_PATH="/usr/local/lib/python3.11/site-packages/nvidia/cu13/lib:/usr/local/lib/python3.11/site-packages/nvidia/cudnn/lib:${LD_LIBRARY_PATH}"

COPY . .

RUN mkdir -p /app/uploads /app/jobs

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
