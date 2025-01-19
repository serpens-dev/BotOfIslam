FROM encoredev/encore:latest

# Install FFmpeg and other dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install node-gyp globally
RUN npm install -g node-gyp

# Install Opus dependencies
RUN apt-get update && apt-get install -y \
    libtool \
    autoconf \
    automake \
    && rm -rf /var/lib/apt/lists/* 