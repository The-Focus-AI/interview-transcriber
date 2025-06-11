#!/bin/bash
set -e

# Usage info
usage() {
  echo "Usage: $0 <url> [output_file]"
  echo "  <url>         - YouTube or MP3 URL to transcribe (required)"
  echo "  [output_file] - Optional output file path (default: /output/transcript_<timestamp>.json)"
  exit 1
}

# Check for URL argument
if [ -z "$1" ]; then
  usage
fi

URL="$1"
OUTPUT_FILE="$2"

# Ensure .env exists (for Gemini API key)
if [ -f /app/.env ]; then
  echo ".env found. Using it."
else
  if [ ! -z "$GEMINI_API_KEY" ]; then
    echo "GEMINI_API_KEY=$GEMINI_API_KEY" > /app/.env
    echo ".env created from environment variable."
  else
    echo "Error: GEMINI_API_KEY not set and .env not found."
    exit 2
  fi
fi

cd /app

# If output file is not specified, use default in /output
if [ -z "$OUTPUT_FILE" ]; then
  pnpm dev "$URL" -o /output/transcript_$(date +%Y%m%d_%H%M%S).json
else
  pnpm dev "$URL" -o "$OUTPUT_FILE"
fi 