/* ── CMMI · Verticales / Áreas ─────────────────────────────────────── */
export type Vertical = "comercial" | "financiero" | "pmo" | "datos";

export interface VerticalConfig {
  id: Vertical;
  label: string;
  /** Disponible = tiene parser + UI; el resto se marca "próximamente" */
  enabled: boolean;
}

export const VERTICALES: VerticalConfig[] = [
  { id: "comercial",  label: "Comercial",  enabled: true  },
  { id: "financiero", label: "Financiero", enabled: false },
  { id: "pmo",        label: "PMO",        enabled: false },
  { id: "datos",      label: "Datos",      enabled: false },
];

/* ── COMERCIAL · Oportunidad normalizada ───────────────────────────── */
export interface OportunidadComercial {
  rowId:            number;     // índice de fila (id local)
  compania:         string;
  idExterno:        string;     // ID export ODOO (__export__.crm_lead_...)
  creado:           string;     // ISO o ""
  fechaFinal:       string;
  fechaVenta:       string;
  comercial:        string;
  preventa:         string;
  cierrePrevisto:   string;
  fechaCierre:      string;
  identificacionProceso: string;
  canalRecepcion:   string;
  sector:           string;
  subsector:        string;
  modalidad:        string;
  aliado:           string;
  razonSocialAliado:string;
  fabricante:       string;
  actualizado:      string;
  cliente:          string;
  oportunidad:      string;
  linea:            string;     // CONSULTORÍA | TI | DATOS Y SISTEMAS DE INFORMACIÓN
  consultoriaCOP:   number;
  datosCOP:         number;
  tiCOP:            number;
  ingresoEsperado:  number;
  tipoVenta:        string;     // REFERENCIADO | PROPIO
  segmento:         string;     // PUBLICO | PRIVADO
  tipoOportunidad:  string;
  objeto:           string;
  clienteFinal:     string;
  ganado:           string;     // Ganado | Perdido | Pendiente | Declinada
  razonPerdida:     string;
  etapaActual:      string;
  motivoDeclinacion:string;
  vinculante:       string;     // VINCULANTE | NO VINCULANTE
}

/** Resultado de un parseo de archivo */
export interface ParseResult {
  records:   OportunidadComercial[];
  fileName:  string;
  parsedAt:  string;   // ISO
  rowCount:  number;
}
