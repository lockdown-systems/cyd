#!/usr/bin/env bash
# Generates the media the seed plan attaches to posts: four still images and a
# short video. Everything is synthetic, so nothing personal ends up in a
# fixture. Requires ffmpeg.
set -euo pipefail

OUT_DIR="${1:-capture/seed-media}"
mkdir -p "$OUT_DIR"

COLORS=(crimson darkgreen navy darkorange)
for i in "${!COLORS[@]}"; do
  n=$((i + 1))
  ffmpeg -y -loglevel error \
    -f lavfi -i "color=c=${COLORS[$i]}:s=1200x675:d=1" \
    -vf "drawtext=text='Cyd seed image ${n}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2" \
    -frames:v 1 "$OUT_DIR/image-${n}.png"
done

ffmpeg -y -loglevel error \
  -f lavfi -i "testsrc=size=1280x720:rate=30:duration=8" \
  -f lavfi -i "sine=frequency=440:duration=8" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
  "$OUT_DIR/video.mp4"

echo "Seed media written to $OUT_DIR:"
ls -la "$OUT_DIR"
