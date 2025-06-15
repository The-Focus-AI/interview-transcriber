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

processjobqueue run.sh