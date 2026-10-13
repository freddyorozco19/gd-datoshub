// Parámetros comerciales del dashboard. Ajustar aquí cuando negocio defina los valores reales.

// Probabilidad de cierre por etapa (x_studio_etapa_actual). Valores iniciales de trabajo.
export const STAGE_PROBABILITY: Record<string, number> = {
  "New": 0.05,
  "Identificación de Oportunidad": 0.1,
  "Preventa": 0.25,
  "Presentación de Oferta": 0.5,
  "Evaluación de la Entidad": 0.75,
};
export const DEFAULT_STAGE_PROBABILITY = 0.1;

// Etapas que ya no son pipeline abierto.
export const CLOSED_STAGES = ["Oferta Ganada", "Oferta No viable", "Oferta declinada"];

// Meta de ingresos ganados por año (COP). null = sin meta definida: los paneles de meta se ocultan.
export const ANNUAL_GOAL_COP: number | null = null;

export const STALLED_DAYS = 14;
export const UPCOMING_DAYS = 30;
