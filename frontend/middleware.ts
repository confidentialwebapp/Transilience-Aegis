import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, allow access (local dev without Supabase)
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const path = request.nextUrl.pathname;

    const isAuthPage = path.startsWith("/login") || path.startsWith("/register");

    // Public marketing routes — accessible without auth
    const isPublicMarketing =
      path === "/" ||
      path.startsWith("/about") ||
      path.startsWith("/pricing") ||
      path.startsWith("/security") ||
      path.startsWith("/privacy") ||
      path.startsWith("/terms") ||
      path.startsWith("/status") ||
      path.startsWith("/changelog");

    const isPublicAsset =
      path === "/logo.png" ||
      path === "/favicon.ico" ||
      path.startsWith("/_next");

    if (isPublicAsset) {
      return response;
    }

    // No session and trying to access a protected page → login
    if (!session && !isAuthPage && !isPublicMarketing) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    // Logged in and visiting auth pages or the marketing landing → dashboard
    if (session && (isAuthPage || path === "/")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }
  } catch {
    // On Supabase error, allow through to avoid locking users out
    return response;
  }

  return response;
}

export const config = {
  // Note: `api/` with a trailing slash so /api-keys (the dashboard page) is
  // still middleware-gated. Without the slash, anything starting with "api"
  // — including /api-keys — would skip auth.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
