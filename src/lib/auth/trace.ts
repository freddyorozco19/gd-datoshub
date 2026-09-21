/** Cuentas cuya actividad no se registra ni se muestra en Trazabilidad. */
export const TRACE_EXCLUDED_EMAILS = ["freddy.orozco@growdata.com.co"];

export const isTraceExcluded = (email?: string | null) =>
  !!email && TRACE_EXCLUDED_EMAILS.includes(email.trim().toLowerCase());
