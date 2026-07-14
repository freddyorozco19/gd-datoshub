/* ── CMMI · Verticales / Áreas ─────────────────────────────────────── */
export type Vertical = "comercial" | "proyectos" | "financiero" | "datos";

export interface VerticalConfig {
  id: Vertical;
  label: string;
  /** Disponible = tiene parser + UI; el resto se marca "próximamente" */
  enabled: boolean;
}

export const VERTICALES: VerticalConfig[] = [
  { id: "comercial",  label: "Comercial",  enabled: true  },
  { id: "proyectos",  label: "Proyectos",  enabled: true  },
  { id: "financiero", label: "Financiero", enabled: true  },
  { id: "datos",      label: "Datos",      enabled: true  },
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

/* ── Respuestas del microservicio de modelos (FastAPI) ─────────────── */
export interface CuracionMeta {
  registros_iniciales:    number;
  eliminados_pendientes:  number;
  eliminados_sin_campos:  number;
  registros_incluidos:    number;
}

/** Respuesta SPC — Carta de Control P (PPB) */
export interface SpcResponse {
  ok: boolean;
  images: { carta_p: string | null; nelson: string | null; estadisticos: string | null };
  tables: { baseline: Record<string, unknown>[] | null; signals: Record<string, unknown>[] | null };
  table_counts: { baseline: number; signals: number };
  stats: { resumen: Record<string, number | string | number[] | string[]> | null };
  curacion: CuracionMeta;
}

/** Respuesta Random Forest entrenamiento (PPM) */
export interface RfTrainResponse {
  ok: boolean;
  images: { dashboard: string | null; comercial: string | null; interactions: string | null };
  tables: { predictions: Record<string, unknown>[] | null };
  table_counts: { predictions: number };
  stats: { metrics: Record<string, number> | null };
  curacion: CuracionMeta;
}

/* ── PROYECTOS · Tipos de respuesta ────────────────────────────────── */
export interface SemaforoProy {
  probabilidad:     number;
  probabilidad_pct: string;
  semaforo:         "VERDE" | "AMARILLO" | "ROJO";
  nivel?:           string;
  estado?:          string;
  auc:              number;
  vs_historico?:    string;
  confianza?:       string;
}

export interface LineaBaseSpi {
  fase:            string;
  fuente:          string;
  SPI_observado:   number;
  CL:              number | null;
  UCL:             number | null;
  LCL:             number | null;
  n:               number;
  sigmas_desde_CL: number | null;
  semaforo:        "VERDE" | "AMARILLO" | "ROJO";
  estado:          string;
}

export interface KickoffResponse {
  portafolio:        string;
  lider:             string;
  duracion_meses:    number;
  presupuesto:       number | null;
  avisos:            string[];
  kickoff:           SemaforoProy;
  modelo_a:          SemaforoProy;
  perfil_combinado:  { semaforo: "VERDE" | "AMARILLO" | "ROJO"; descripcion: string };
}

/* ── FINANCIERO · Tipos de respuesta ───────────────────────────────── */
export type NelsonSummary = Record<string, number>;

export interface LineaBaseBloque {
  n: number; mean: number; std: number; cv: number;
  ucl: number; lcl: number; u1p: number; u1n: number; u2p: number; u2n: number;
  sw_p: number; nelson: NelsonSummary; bajo_control: boolean; riesgo: "Bajo" | "Medio" | "Alto";
}

export interface LineasBaseResponse {
  global: LineaBaseBloque;
  por_categoria: Record<string, LineaBaseBloque>;
  categorias_disponibles: string[];
}

export interface PrediccionFinResponse {
  categoria: string; monto_cop: number; monto_miles_mm: number;
  utilidad_estimada: number; utilidad_pct: string;
  intervalo_min: number; intervalo_min_pct: string;
  intervalo_max: number; intervalo_max_pct: string;
  rmse: number; semaforo: "VERDE" | "AMARILLO" | "ROJO";
  advertencia: string | null;
  modelo: { r2: number; r2a: number; pF: number; rmse: number; n: number };
}

/* ── DATOS (Gobierno de Datos) · Tipos ─────────────────────────────── */
export interface DatosInfoCategoria {
  n_obs: number; n_periodos: number; variables: string[];
  cob_media: string; cob_min: string; cob_max: string;
}
export interface DatosInfoRegistro {
  categoria: string; variable: string; periodo: number; cobertura: string; cob_v: number;
}
export interface DatosInfoResponse {
  disponible: boolean;
  n_obs?: number; n_categorias?: number; n_periodos?: number;
  periodos?: number[]; variables?: string[]; xlsx_bytes?: number;
  por_categoria?: Record<string, DatosInfoCategoria>;
  registros?: DatosInfoRegistro[];
  modelo_r2?: number | null; modelo_rmse?: number | null;
}

export interface LbPeriodo { periodo: number; CL: number; UCL: number; LCL: number; }
export interface LbCategoria { sigma: number; periodos: LbPeriodo[]; }
export interface LineasBaseDatosResponse {
  categorias: Record<string, LbCategoria>;
  periodos_disponibles: number[];
}
export interface PrediccionDatosResponse {
  categoria: string; periodo: number;
  prediccion: number; prediccion_pct: string;
  ic_lo: number; ic_lo_pct: string;
  ic_hi: number; ic_hi_pct: string;
  nivel_confianza: number;
  semaforo: "VERDE" | "AMARILLO" | "ROJO";
  es_proyeccion: boolean;
  periodo_max_historico: number;
  modelo: { r2: number; rmse: number; mae: number; rmse_loo: number; n: number };
}

export interface PklMetricas {
  auc: number; brier: number;
  precision: number; recall: number; f1: number; fpr: number;
  tp: number; fp: number; fn: number; tn: number;
  n_obs: number; umbral_alerta: number;
}
export interface PklImportancia { variable: string; importancia: number; pct: string; }
export interface PklBloque {
  disponible: boolean;
  version?: string;
  descripcion?: string;
  algoritmo?: string;
  features?: string[];
  portafolios?: string[];
  lideres_n?: number;
  pkl_bytes?: number;
  metricas?: PklMetricas;
  importancia?: PklImportancia[];
}
export interface DatosOrigenPortafolio {
  n_proyectos: number;
  duracion_media: number;
  spi_min_mediana: number;
  pct_completados: string;
}
export interface DatosOrigenProyecto {
  id: string; lider: string; portafolio: string;
  meses: number; n_reportes: number;
  spi_min: number; spi_final: number;
  completado_final: string; estado: string;
}
export interface DatosOrigen {
  fecha_min: string | null; fecha_max: string | null;
  n_observaciones: number;
  por_portafolio: Record<string, DatosOrigenPortafolio>;
  proyectos: DatosOrigenProyecto[];
}
export interface ProyectosInfoResponse {
  kickoff:    PklBloque;
  modelo_a:   PklBloque;
  modelo1:    PklBloque;
  modelo2:    PklBloque;
  linea_base_spi: { disponible: boolean; n_portafolios: number; portafolios: string[] };
  xlsx_disponible: boolean;
  xlsx_bytes: number;
  fecha_datos_hasta: string | null;
  n_proyectos: number;
  datos_origen: DatosOrigen | null;
}

export interface FinancieroInfoCategoria {
  n: number; utilidad_media: string; utilidad_min: string; utilidad_max: string; monto_medio_mm: number | null;
}
export interface FinancieroInfoProyecto {
  codigo: string; categoria: string; utilidad: string; utilidad_v: number; monto_mm: number | null; fecha: string | null;
}
export interface FinancieroInfoResponse {
  disponible: boolean;
  n_proyectos?: number; fecha_min?: string | null; fecha_max?: string | null; xlsx_bytes?: number;
  por_categoria?: Record<string, FinancieroInfoCategoria>;
  proyectos?: FinancieroInfoProyecto[];
  modelo_r2?: number | null; modelo_r2a?: number | null; modelo_n?: number | null;
}

export interface SeguimientoResponse {
  portafolio:       string;
  lider:            string;
  mes_rel:          number;
  avisos:           string[];
  modelo1:          SemaforoProy;
  modelo2:          SemaforoProy;
  linea_base_spi:   LineaBaseSpi | null;
}
