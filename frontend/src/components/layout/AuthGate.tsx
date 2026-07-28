"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuthStore } from "@/store/useAuthStore";

const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Client-side route guard: redirects signed-out visitors to /login (except
 * on the public auth pages), and keeps signed-in users off /login /register.
 * Waits for the persisted auth store to hydrate from localStorage before
 * making a decision, so a refresh doesn't briefly bounce a signed-in user.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token && !isPublicPath) {
      router.replace("/login");
    } else if (token && isPublicPath) {
      router.replace("/dashboard");
    }
  }, [hasHydrated, token, isPublicPath, router]);

  if (!isPublicPath && (!hasHydrated || !token)) {
    return null;
  }

  return <>{children}</>;
}
