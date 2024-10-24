export default {
	async fetch(request, env, ctx) {
		// parse URL: should be of the form release{,-group}/mbid{,.webp,.jxl}
		const url = new URL(request.url.toLowerCase());
    const match = url.pathname.match(/^\/(release(?:-group)?)\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(|\.webp)$/);
    if (!match) return new Response('400 Bad Request: URL was not of the form /release{,-group}/mbid{,.webp}', { status: 400 });

    const [, entityType, mbid, compTypeRaw] = match;
		const compressed = compTypeRaw === ".webp";

		// check for cache
		const cacheKey = new Request(`https://a/${entityType}/${mbid}/${compressed}`, request);

		let cResp = await caches.default.match(cacheKey);
		if (cResp) return cResp;


		// get the image from CAA / IA
		const caaUrl = `https://coverartarchive.org/${entityType}/${mbid}/front`;
		const imgHead = await fetch(caaUrl, { method: "HEAD" });

		if (imgHead.status === 404)
			return new Response("404 Not Found: Either this release does not exist, or it has no 'front' art.", { status: 404 });
		if (imgHead.status !== 200)
			return new Response(`500 Internal Server Error: Unknown response code ${api.status} from CAA API or IA`, { status: 500 });


		// get content type
		const srcType = imgHead.headers.get("Content-Type");

		// send request again, using cloudflare transform to compress to webp if requested

		const finalReq = await fetch(caaUrl, {
			cf: !compressed ? {} : {
				image: {
					quality: srcType === "image/jpeg" ? 90 : 100,
					format: "webp" // sadly JXL is not supported. AVIF is though.
				}
			}
		});

		if (!finalReq.ok)
			return new Response(`500 Internal Server Error: Unknown response code ${finalReq.status} from CAA API or IA`, { status: 500 });

		// send to cache
		const resp = new Response(finalReq.body, {
			headers: {
				'Content-Type': finalReq.headers.get("Content-Type"),
				'Cache-Control': 'public, immutable, no-transform, max-age=1814400',
				'Access-Control-Allow-Origin': '*' // sigh
			},
		});
		if (cacheKey.method === 'GET')
			await caches.default.put(cacheKey, resp.clone());

		return resp;
	},
};
