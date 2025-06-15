FROM golang:1.21-alpine as processjobqueue

RUN apk add git openssh

WORKDIR /app

RUN git clone https://github.com/The-Focus-AI/shell-job-queue.git .

RUN go mod download

RUN go build -o processjobqueue main.go

# Use official Node.js LTS image
FROM node:18-slim

# Copy processjobqueue binary from previous stage
COPY --from=processjobqueue /app/processjobqueue /usr/local/bin/

# Install system dependencies: ffmpeg and yt-dlp
RUN apt-get update && \
    apt-get install -y ffmpeg wget && \
    wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Set workdir
WORKDIR /app

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
# RUN pnpm install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Create output directory
RUN mkdir -p /output

# Set environment variables (can be overridden at runtime)
ENV OUTPUT_DIR=/output

# Entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"] 