export function track(action: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  fetch("/api/auth/log-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, path: window.location.pathname, metadata: meta }),
  }).catch(() => {});
}
