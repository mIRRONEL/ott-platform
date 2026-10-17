#!/usr/bin/env bash
# ==============================================================================
# SoNALU OTT Platform - Automated Orphaned Video & Storage Cleanup Utility
# ==============================================================================
# Safely detects and purges orphaned video folders and raw masters from
# the shared `ott-app_videos_data` volume that are not registered in the active catalog.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "======================================================================"
echo "   SoNALU Video Storage Analyzer & Orphaned Data Cleanup Utility     "
echo "======================================================================"

# 1. Fetch active video IDs from API Gateway
echo -e "\n[*] Fetching active catalog video IDs from API Gateway..."
ACTIVE_IDS=$(curl -s "http://localhost/api/content/videos?limit=500" 2>/dev/null | jq -r '.data.videos[]?.id // empty' || true)

if [ -z "$ACTIVE_IDS" ]; then
  # Fallback to direct port 3000 if port 80 didn't reply
  ACTIVE_IDS=$(curl -s "http://localhost:3000/api/content/videos?limit=500" 2>/dev/null | jq -r '.data.videos[]?.id // empty' || true)
fi

echo "[*] Active registered videos found:"
for id in $ACTIVE_IDS; do
  echo "    - $id"
done

# Convert active IDs into an associative array for fast lookup
ACTIVE_LIST_STRING=$(echo "$ACTIVE_IDS" | tr '\n' ' ')

# 2. Run cleanup container with volume mount
echo -e "\n[*] Inspecting ott-app_videos_data volume..."
docker run --rm \
  -v ott-app_videos_data:/data \
  alpine sh -c "
    echo '=== BEFORE CLEANUP DISK USAGE ==='
    du -sh /data /data/encoded /data/raw 2>/dev/null || true
    echo ''

    RECLAIMED=0
    ACTIVE_IDS='$ACTIVE_LIST_STRING'

    # Check and clean orphaned encoded folders
    echo '=== CLEANING ORPHANED ENCODED FOLDERS ==='
    if [ -d /data/encoded ]; then
      for folder in /data/encoded/*; do
        if [ -d \"\$folder\" ]; then
          vid_id=\$(basename \"\$folder\")
          is_active=0
          for active in \$ACTIVE_IDS; do
            if [ \"\$active\" = \"\$vid_id\" ]; then
              is_active=1
              break
            fi
          done

          if [ \$is_active -eq 0 ]; then
            sz=\$(du -sh \"\$folder\" | cut -f1)
            echo \"[-] Removing orphaned encoded directory: \$vid_id (\$sz)\"
            rm -rf \"\$folder\"
          else
            sz=\$(du -sh \"\$folder\" | cut -f1)
            echo \"[+] Keeping active encoded directory:   \$vid_id (\$sz)\"
          fi
        fi
      done
    fi

    # Check and clean orphaned / completed raw video masters
    echo ''
    echo '=== CLEANING RAW VIDEO MASTERS ==='
    if [ -d /data/raw ]; then
      for file in /data/raw/*; do
        if [ -f \"\$file\" ]; then
          raw_name=\$(basename \"\$file\")
          raw_vid_id=\$(echo \"\$raw_name\" | sed 's/\.[^.]*$//')
          
          # If encoded HLS exists for this video, or if video is no longer active, purge raw
          if [ -d \"/data/encoded/\$raw_vid_id\" ] || [ -z \"\$(echo \$ACTIVE_IDS | grep -w \$raw_vid_id)\" ]; then
            sz=\$(du -sh \"\$file\" | cut -f1)
            echo \"[-] Purging non-master raw file: \$raw_name (\$sz)\"
            rm -f \"\$file\"
          else
            sz=\$(du -sh \"\$file\" | cut -f1)
            echo \"[+] Retaining active raw master: \$raw_name (\$sz)\"
          fi
        fi
      done
    fi

    echo ''
    echo '=== AFTER CLEANUP DISK USAGE ==='
    du -sh /data /data/encoded /data/raw 2>/dev/null || true
  "

echo -e "\n======================================================================"
echo "   Cleanup complete! Volume ott-app_videos_data is now optimized.    "
echo "======================================================================"
