/**
 * Next.js 16 Proxy — UX-only unauthenticated redirect
 * (`MASTER_IMPLEMENTATION_PLAN.md` Phase 3 / `SECURITY_PLAN.md` §3).
 *
 * File convention is `proxy.ts` (not `middleware.ts`); the named export is
 * `proxy`. Per Next.js 16 docs this always runs on the Node.js runtime, so
 * calling into `validateSession` (Postgres) is allowed — but this layer is
 * still *not* the security boundary. Every Server Action must call
 * `validateSession()` again before mutating data.
 *
 * Docs consulted: `node_modules/next` proxy file-convention + upgrading
 * guide (middleware → proxy); Context7 `/vercel/next.js` v16.2.x
 * `proxy.mdx`. Local `node_modules/next/dist/docs/` is empty in this
 * install, so the published App Router proxy convention was used.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/session";

/**
 * Redirects browsers without a valid session away from `/dashboard/*` to
 * `/login`. Leaves `/login`, `/api`, and static assets alone (matcher).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // `touch: false` — read-only check; idle sliding happens in Server Actions.
  const session = await validateSession({ touch: false });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
