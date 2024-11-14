# album art mirror

Mirrors the Cover Art Archive collection.

The Internet Archive, which graciously hosts the collection, does not serve them at a very high data rate.

The solution used here to this problem is to (A) very aggressively cache images, and (B) compress on-the-fly.

You can either download:
- The image automatically compressed to your browser's capabilities (JXL if possible, else WebP, else JPG/PNG)
  https://aart.yellows.ink/release/5c034115-4998-4d4b-8f41-c2eab904864b
- The original image (jpeg or png) with
  https://aart.yellows.ink/release/5c034115-4998-4d4b-8f41-c2eab904864b-raw
- Converted to WebP
  https://aart.yellows.ink/release/5c034115-4998-4d4b-8f41-c2eab904864b.webp
- Converted to JPEG XL
  https://aart.yellows.ink/release/5c034115-4998-4d4b-8f41-c2eab904864b.jxl

The webps and jxls will be lossless if the original was a png, else lossy.
