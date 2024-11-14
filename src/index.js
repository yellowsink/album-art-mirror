export default {
	async fetch(request, env, ctx) {
		// parse URL: should be of the form release{,-group}/mbid{,.webp,.jxl}
		const url = new URL(request.url.toLowerCase());
		const match = url.pathname.match(
			/^\/(release(?:-group)?)\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(|-raw|\.webp|\.jxl)$/
		);
		if (!match)
			return new Response(
				"400 Bad Request: URL was not of the form /release{,-group}/mbid{,-raw,.webp,.jxl}",
				{ status: 400 }
			);

		const [, entityType, mbid, compTypeRaw] = match;
		let compressed = { ".webp": 1, ".jxl": 2 }[compTypeRaw] ?? false;

		// automatic compression detection
		// known caveat: the JXL Viewer web extension removes image/webp and image/avif from the Accept header
		// https://addons.mozilla.org/en-US/firefox/addon/jxl/
		// this is not an issue, as those users can be served the JXL just fine anyway.

		const reqAccept = request.headers.get("Accept");
		if (!compressed && compTypeRaw !== "-raw") {
			if (reqAccept.includes("image/jxl"))
				compressed = 2;

			else if (reqAccept.includes("image/webp"))
				compressed = 1;
		}

		// check for cache
		const cacheKey = new Request(`https://a/${entityType}/${mbid}/${compressed}`);

		let cResp = await caches.default.match(cacheKey);
		if (cResp) return cResp;

		// get the image from CAA / IA
		const caaUrl = `https://coverartarchive.org/${entityType}/${mbid}/front`;
		const imgHead = await fetch(caaUrl, { method: "HEAD" });

		if (imgHead.status === 404)
			return new Response(
				"404 Not Found: Either this release does not exist, or it has no 'front' art.",
				{ status: 404 }
			);
		if (imgHead.status !== 200)
			return new Response(
				`500 Internal Server Error: Unknown response code ${api.status} from CAA API or IA`,
				{ status: 500 }
			);

		// get content type
		const srcType = imgHead.headers.get("Content-Type");

		// cloudflare image transforms SUCK so I use cloudinary instead.
		const cTypeCD = [, "webp", "jxl"][compressed];
		const qualCD = srcType === "image/jpeg" ? "auto" : 100;

		const finalReq = await fetch(
			compressed
				? `https://res.cloudinary.com/dqwrj7y4p/image/fetch/f_${cTypeCD}/q_${qualCD}/${caaUrl}`
				: caaUrl
		);

		if (!finalReq.ok)
			return new Response(
				`500 Internal Server Error: Unknown response code ${finalReq.status} from CAA API, IA, or Cloudinary`,
				{ status: 500 }
			);

		// send to cache
		const resp = new Response(finalReq.body, {
			headers: {
				"Content-Type": finalReq.headers.get("Content-Type"),
				//...Object.fromEntries(finalReq.headers.entries()),
				"Cache-Control": "public, immutable, no-transform, max-age=1814400",
				"Access-Control-Allow-Origin": "*",
				"ETag": finalReq.headers.get("ETag"),
				Vary: "Accept",
			},
		});

		await caches.default.put(cacheKey, resp.clone());

		return resp;
	},
};
