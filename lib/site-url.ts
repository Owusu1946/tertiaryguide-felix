/**
 * Canonical site origin for metadata, OG tags, JSON-LD, sitemap, and share URLs.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://tertiaryguide-mu.vercel.app).
 */
export function getSiteUrl(): string {
  const trim = (u: string) => u.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return trim(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return trim(process.env.NEXT_PUBLIC_BASE_URL);
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }
  return "https://tertiaryguide.com";
}

export function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteUrl()}${path}`;
}

/**
 * Prefer the browser origin used to start checkout so Paystack returns to the
 * same host (avoids 404s when env SITE_URL / BASE_URL differ from the live app).
 */
export function resolvePaymentReturnOrigin(candidate?: string | null): string {
  const trim = (u: string) => u.replace(/\/$/, "");
  if (typeof candidate === "string" && candidate.trim()) {
    try {
      const url = new URL(candidate.trim());
      if (url.protocol === "http:" || url.protocol === "https:") {
        return trim(`${url.protocol}//${url.host}`);
      }
    } catch {
      // fall through
    }
  }
  return getSiteUrl();
}

/** Public page that verifies Paystack and redirects into My Forms. */
export function paymentReturnCallbackUrl(origin?: string | null): string {
  return `${resolvePaymentReturnOrigin(origin)}/payments/return`;
}
