import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/safe-next";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: (() => {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-pathname", request.nextUrl.pathname);
        return requestHeaders;
      })(),
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request: {
            headers: (() => {
              const requestHeaders = new Headers(request.headers);
              requestHeaders.set("x-pathname", request.nextUrl.pathname);
              return requestHeaders;
            })(),
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  const isProtectedRoute =
    pathname.startsWith("/leagues/create") ||
    pathname.startsWith("/league/") ||
    pathname.startsWith("/dashboard");

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leagues/create/:path*",
    "/league/:path*",
    "/login",
  ],
};
