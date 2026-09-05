import { NextRequest, NextResponse } from "next/server";

const APPLY_HOST = "apply.tertiaryguide.com";

export function proxy(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();

  // Keep the dedicated applicant URL while rendering the existing apply page.
  // Paths such as /anything remain unchanged on this subdomain.
  if (host === APPLY_HOST && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/apply";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
