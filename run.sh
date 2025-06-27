#!/bin/bash

npm --silent run dev "$@"

# https://www.youtube.com/watch?v=b5EP6YHMaEg
# curl -X POST http://localhost:8080/jobs -H 'Content-Type: application/json' -d '{"args": ["https://www.youtube.com/watch?v=b5EP6YHMaEg"], "mime_type" : "text/plain"}'