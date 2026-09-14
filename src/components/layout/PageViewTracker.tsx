"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

const SKIP = ["/login", "/register", "/auth"];

export default function PageViewTracker() {
  const pathname  = usePathname();
  const prevRef   = useRef<string | null>(null);
  const enteredAt = useRef<number>(Date.now());

  // page_view + page_exit al cambiar de ruta
  useEffect(() => {
    if (pathname === prevRef.current) return;

    // page_exit para la ruta anterior
    if (prevRef.current && !SKIP.some((p) => prevRef.current!.startsWith(p))) {
      const duration = Math.round((Date.now() - enteredAt.current) / 1000);
      track("page_exit", { prev_path: prevRef.current, duration_sec: duration });
    }

    if (SKIP.some((p) => pathname.startsWith(p))) return;
    prevRef.current = pathname;
    enteredAt.current = Date.now();

    fetch("/api/auth/log-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "page_view", path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  // page_exit al cerrar/ocultar la pestaña
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && prevRef.current) {
        const duration = Math.round((Date.now() - enteredAt.current) / 1000);
        track("page_exit", { prev_path: prevRef.current, duration_sec: duration });
        enteredAt.current = Date.now();
      } else if (document.visibilityState === "visible") {
        enteredAt.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // errores JS globales
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      track("error", { message: ev.message, source: ev.filename, line: ev.lineno });
    };
    const onUnhandled = (ev: PromiseRejectionEvent) => {
      track("error", { message: String(ev.reason), type: "unhandled_rejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  return null;
}
