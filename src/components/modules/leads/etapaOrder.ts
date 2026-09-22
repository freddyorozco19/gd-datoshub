// Orden del pipeline (no alfabético) para listas de "Etapa Actual" (x_studio_etapa_actual).
// Compartido entre LeadsView (Business) y PresalesView para que ambos filtros coincidan.
export const ETAPA_ORDER = [
  "New", "Identificación de Oportunidad", "Preventa", "Presentación de Oferta",
  "Evaluación de la Entidad", "Oferta Ganada", "Oferta No viable", "Oferta declinada",
];

export const uniqueEtapaActual = (arr: string[]) => {
  const present = new Set(arr.filter(Boolean));
  const ordered = ETAPA_ORDER.filter((e) => present.has(e));
  const rest = [...present].filter((e) => !ETAPA_ORDER.includes(e)).sort();
  return ["ALL", ...ordered, ...rest];
};
