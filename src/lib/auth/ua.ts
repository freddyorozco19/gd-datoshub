/** Parseo simple de User-Agent → navegador + sistema operativo (sin dependencias). */
export function parseUserAgent(ua: string): { browser: string; os: string } {
  const u = ua || "";

  let browser = "Desconocido";
  if (/Edg\//.test(u)) browser = "Edge";
  else if (/OPR\/|Opera/.test(u)) browser = "Opera";
  else if (/Chrome\//.test(u) && !/Chromium/.test(u)) browser = "Chrome";
  else if (/Chromium/.test(u)) browser = "Chromium";
  else if (/Firefox\//.test(u)) browser = "Firefox";
  else if (/Version\/.*Safari/.test(u)) browser = "Safari";

  let os = "Desconocido";
  if (/Windows NT/.test(u)) os = "Windows";
  else if (/Mac OS X/.test(u)) os = "macOS";
  else if (/Android/.test(u)) os = "Android";
  else if (/(iPhone|iPad|iPod)/.test(u)) os = "iOS";
  else if (/Linux/.test(u)) os = "Linux";

  return { browser, os };
}
