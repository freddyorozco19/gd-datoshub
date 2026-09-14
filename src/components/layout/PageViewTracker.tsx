"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SKIP = ["/login", "/register", "/auth"];

export default function PageViewTracker() {
  const pathname  = usePathname();
  const prevRef   = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === prevRef.current) return;
    if (SKIP.some((p) => pathname.startsWith(p))) return;
    prevRef.current = pathname;

    fetch("/api/auth/log-access", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "page_view", path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
