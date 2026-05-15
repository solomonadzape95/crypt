import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromCookieString, SESSION_COOKIE_NAME } from "@/lib/wallet-session";

const PROTECTED = ["/vaults", "/vault", "/provider", "/marketplace", "/listing"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionFromCookieString(cookie);
  if (session) return NextResponse.next();

  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
