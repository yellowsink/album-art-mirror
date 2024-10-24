import decodeJpegRaw, { init as initJpegWasm } from "@jsquash/jpeg/decode"
import decodePngRaw, { init as initPngWasm } from '@jsquash/png/decode';
import encodeWebpRaw, { init as initWebpWasm } from '@jsquash/webp/encode';
import encodeJxlRaw, { init as initJxlWasm } from '@jsquash/jxl/encode';

import JPEG_DEC_WASM from "@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm";
import PNG_DEC_WASM from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import WEBP_ENC_WASM from '@jsquash/webp/codec/enc/webp_enc_simd.wasm';
import JXL_ENC_WASM from '@jsquash/jxl/codec/enc/jxl_enc.wasm';

let jpeg_inited, png_inited, webp_inited, jxl_inited;

async function decJpeg(buffer) {
	await (jpeg_inited ??= initJpegWasm(JPEG_DEC_WASM));
	return decodeJpegRaw(buffer);
}

async function decPng(buffer) {
	await (png_inited ??= initPngWasm(PNG_DEC_WASM));
	return decodePngRaw(buffer);
}

async function encWebp(data, lossy = false) {
	await (webp_inited ??= initWebpWasm(WEBP_ENC_WASM));
	return encodeWebpRaw(data, {
		lossless: !lossy,
		quality: lossy ? 90 : 100,
	});
}

async function encJxl(data, lossy = false) {
  await (jxl_inited ??= initJxlWasm(JXL_ENC_WASM));
  return encodeJxlRaw(data, {
    quality: lossy ? 90 : 100,
    progressive: true, // we're serving this on the web!
  })
}

async function encode(buf, sourceType, destType) {
  let srcData, lossy;
  switch (sourceType) {
    case "image/png":
      srcData = await decPng(buf);
      lossy = false;
      break;
    case "image/jpeg":
      srcData = await decJpeg(buf);
      lossy = true;
      break;
    default:
      throw new Error("Unsupported source image type " + sourceType);
  }

  switch (destType) {
    case "image/jxl":
      return encJxl(srcData, lossy);
    case "image/webp":
      return encWebp(srcData, lossy);
    default:
      throw new Error('Unsupported destination image type ' + destType);
  }
}

export default {
	async fetch(request, env, ctx) {
		// parse URL: should be of the form release{,-group}/mbid{,.webp,.jxl}
		const url = new URL(request.url.toLowerCase());
    const match = url.pathname.match(/^\/(release(?:-group)?)\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(|\.jxl|\.webp)$/);
    if (!match) return new Response('400 Bad Request: URL was not of the form /release{,-group}/mbid{,.webp,.jxl}', { status: 400 });

    const [, entityType, mbid, compType_] = match;
		const compType = compType_.slice(1); // remove `.`

		// check for cache
		const cacheKey = new Request(`https://a/${entityType}/${mbid}/${compType}`, request);
    const cacheKeyNoComp = new Request(`https://a/${entityType}/${mbid}/`, request);

		let cResp = await caches.default.match(cacheKey);
		if (cResp) {
			return cResp;
		}

    // ok, this variant not cached, what if we have it in the raw cache?
    let imgRes;
    // yum, isn't that lovely
    if (compType && (imgRes = await caches.default.match(cacheKeyNoComp))) {}
    else {
			// get the image from CAA / IA
			imgRes = await fetch(`https://coverartarchive.org/${entityType}/${mbid}/front`);

			if (imgRes.status === 404)
				return new Response("404 Not Found: Either this release does not exist, or it has no 'front' art.", { status: 404 });
			if (imgRes.status !== 200)
				return new Response(`500 Internal Server Error: Unknown response code ${api.status} from CAA API or IA`, { status: 500 });
		};

    // get content type
    const srcType = imgRes.headers.get("Content-Type");

    // if compression is requested, do that
    const finalImg = compType ? await encode(await imgRes.arrayBuffer(), srcType, 'image/' + compType) : await imgRes.arrayBuffer();

    // send to cache
    const resp = new Response(finalImg, {
			headers: { 'Content-Type': compType || srcType, 'Cache-Control': 'public, immutable, no-transform, max-age=1814400' },
		});

    await caches.default.put(cacheKey, resp.clone());

    return resp;
	},
};
