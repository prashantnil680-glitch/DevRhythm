FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    g++ \
    build-essential \
    make \
    wget \
    libcap-dev \
    libcap2-bin \
    && rm -rf /var/lib/apt/lists/*

# Download and compile isolate (optional – not used in production)
WORKDIR /tmp
RUN wget https://github.com/ioi/isolate/archive/refs/tags/v1.10.tar.gz \
    && tar -xzf v1.10.tar.gz \
    && cd isolate-1.10 \
    && make isolate \
    && cp isolate /usr/local/bin/ \
    && chmod 4755 /usr/local/bin/isolate \
    && cd / && rm -rf /tmp/isolate-1.10 /tmp/v1.10.tar.gz

# Create isolate config directory (not strictly required but harmless)
RUN mkdir -p /usr/local/etc && echo "box=/var/local/lib/isolate" > /usr/local/etc/isolate
RUN mkdir -p /var/local/lib/isolate && chmod 755 /var/local/lib/isolate

# Create symlink for python3
RUN ln -s /usr/bin/python3 /usr/bin/python

ENV CPP_COMPILER=g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

RUN python3 --version && python --version && g++ --version && /usr/local/bin/isolate --version || true

COPY . .

EXPOSE 5000

CMD ["npm", "start"]