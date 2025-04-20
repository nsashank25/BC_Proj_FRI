#!/bin/bash

SRC_DIR="/home/sashank/Desktop/tokenized-real-estate/artifacts/contracts"
DEST_DIR="/home/sashank/Desktop/tokenized-real-estate/frontend/src/contracts"

mkdir -p "$DEST_DIR"

for dir in "$SRC_DIR"/*.sol; do
    if [ -d "$dir" ]; then
        contract_name=$(basename "$dir" .sol)
        json_file="$dir/$contract_name.json"

        if [ -f "$json_file" ]; then
            cp "$json_file" "$DEST_DIR/"
            echo "Copied $contract_name.json to frontend/contracts"
        else
            echo "Warning: $contract_name.json not found in $dir"
        fi
    fi
done