import { NextResponse, type NextRequest } from "next/server";

// CORS for /api/* so the app (any origin during development) can call the clone backend.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,authorization,cache-control",
          "access-control-max-age": "86400",
        },
      });
    }
    const res = NextResponse.next();
    res.headers.set("access-control-allow-origin", "*");
    return res;
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
