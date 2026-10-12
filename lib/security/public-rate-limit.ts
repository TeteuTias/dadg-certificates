import { createHash,createHmac,timingSafeEqual } from "node:crypto";
const buckets = new Map<string, { count: number; until: number }>();
export function publicRateLimit(request: Request, now = Date.now()) {
  const forwarded=request.headers.get("x-dadg-client-key")||"",time=request.headers.get("x-dadg-client-time")||"",signature=request.headers.get("x-dadg-client-signature")||"";
  const secret=process.env.PUBLIC_PROXY_RATE_LIMIT_SECRET;
  let authenticatedProxy=false;
  if(secret&&/^[a-f0-9]{64}$/.test(forwarded)&&/^[a-f0-9]{64}$/.test(signature)&&/^\d{13}$/.test(time)&&Math.abs(now-Number(time))<=60000){
    const expected=createHmac("sha256",secret).update(`${time}:${forwarded}`).digest();
    authenticatedProxy=timingSafeEqual(expected,Buffer.from(signature,"hex"));
  }
  const key = authenticatedProxy?`proxy:${forwarded}`:createHash("sha256")
    .update(
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
    )
    .digest("hex");
  let bucket = buckets.get(key);
  if (!bucket || bucket.until <= now) {
    if (buckets.size >= 10000) {
      for (const [id, v] of buckets) {
        if (v.until <= now) buckets.delete(id);
      }
      if (buckets.size >= 10000) return false;
    }
    bucket = { count: 0, until: now + 60000 };
    buckets.set(key, bucket);
  }
  // A signed proxy isolates each visitor. Unsigned clients share a larger network bucket.
  return ++bucket.count <= (authenticatedProxy?60:600);
}
