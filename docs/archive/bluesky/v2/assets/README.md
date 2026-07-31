# Canonical media sources

`full-video.mp4` is a 10-second, 1280×720 FFmpeg test pattern generated without
third-party source material:

```sh
ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -pix_fmt yuv420p full-video.mp4
```

The fixture generator creates the three one-pixel PNG sources itself with
distinct RGBA values, complete PNG chunk framing, and valid CRCs.
