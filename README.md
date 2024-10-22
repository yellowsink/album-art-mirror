# album art mirror

Mirrors the Cover Art Archive collection.

The Internet Archive, which graciously hosts the collection, does not serve them at a very high data rate.

The solution used here to this problem is to (A) very aggressively cache images, and (B) compress on-the-fly.

Note that two current drawbacks (should be fixable in future) are not losslessly compressing JPEG to JXL,
and not supporting streaming compression.
