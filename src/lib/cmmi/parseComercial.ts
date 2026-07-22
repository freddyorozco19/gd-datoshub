import * as XLSX from "xlsx";
import type { OportunidadComercial, ParseResult } from "./types";

/* ── Aliases de header por campo ───────────────────────────────────────
   Cada campo acepta múltiples nombres posibles (case-insensitive, sin tildes).
   El primer match en la fila de headers gana.
───────────────────────────────────────────────────────────────────────── */
const HEADER_ALIASES: Record<keyof Omit<OportunidadComercial, "rowId">, string[]> = {
  compania:              ["compania", "empresa", "company"],
  idExterno:             ["id externo", "id", "external id", "__export__"],
  creado:                ["creado", "fecha creacion", "fecha creación", "fecha final", "created on", "create date"],
  fechaFinal:            ["fecha final", "fecha de cierre", "close date", "fecha cierre real"],
  fechaVenta:            ["fecha venta", "sale date", "fecha de venta"],
  comercial:             ["comercial", "vendedor", "asesor", "salesperson", "ejecutivo"],
  preventa:              ["preventa", "pre-venta", "presale"],
  cierrePrevisto:        ["cierre previsto", "fecha cierre previsto", "expected closing date", "cierre esperado"],
  fechaCierre:           ["fecha cierre", "fecha de cierre efectiva", "closing date"],
  identificacionProceso: ["identificacion proceso", "identificación proceso", "proceso", "process id"],
  canalRecepcion:        ["canal recepcion", "canal recepción", "canal", "channel"],
  sector:                ["sector"],
  subsector:             ["subsector", "sub sector", "sub-sector"],
  modalidad:             ["modalidad", "modality"],
  aliado:                ["aliado", "partner", "socio"],
  razonSocialAliado:     ["razon social aliado", "razón social aliado", "aliado razon social"],
  fabricante:            ["fabricante", "manufacturer", "marca"],
  actualizado:           ["actualizado", "ultima actualizacion", "última actualización", "last update"],
  cliente:               ["cliente", "customer", "account"],
  oportunidad:           ["oportunidad", "nombre oportunidad", "opportunity name", "nombre"],
  linea:                 ["linea", "línea", "línea de negocio", "linea de negocio", "business line"],
  consultoriaCOP:        ["consultoria cop", "consultoría cop", "consultoria", "consultoría"],
  datosCOP:              ["datos cop", "datos"],
  tiCOP:                 ["ti cop", "tecnologia cop", "tecnología cop", "ti"],
  ingresoEsperado:       ["ingreso esperado", "valor esperado", "importe esperado", "expected revenue", "ingresos"],
  tipoVenta:             ["tipo venta", "tipo de venta", "sale type"],
  segmento:              ["segmento", "segment"],
  tipoOportunidad:       ["tipo oportunidad", "tipo de oportunidad", "opportunity type"],
  objeto:                ["objeto", "descripcion", "descripción", "description"],
  clienteFinal:          ["cliente final", "end customer", "usuario final"],
  ganado:                ["ganado", "estado", "etapa ganado", "won", "result", "resultado"],
  razonPerdida:          ["razon perdida", "razón perdida", "lost reason", "motivo perdida"],
  etapaActual:           ["etapa actual", "etapa", "stage", "stage name"],
  motivoDeclinacion:     ["motivo declinacion", "motivo declinación", "decline reason", "declinacion"],
  vinculante:            ["vinculante", "binding"],
};

/* ── Helpers de celda ──────────────────────────────────────────────── */
const str = (v: unknown): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().substring(0, 19).replace("T", " ");
  return String(v).trim();
};

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const dateCell = (v: unknown): string => {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().substring(0, 19).replace("T", " ");
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().substring(0, 19).replace("T", " ");
  }
  return str(v);
};

/** Normaliza un string de header: minúsculas, sin tildes, sin espacios extra */
function normalizeHeader(h: unknown): string {
  return str(h)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Construye el mapa campo → índice de columna leyendo la fila de headers */
function buildColMap(headerRow: unknown[]): Record<keyof Omit<OportunidadComercial, "rowId">, number> {
  const normalized = headerRow.map(normalizeHeader);

  const map = {} as Record<keyof Omit<OportunidadComercial, "rowId">, number>;

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof typeof HEADER_ALIASES, string[]][]) {
    let idx = -1;
    for (const alias of aliases) {
      const normAlias = alias.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      idx = normalized.findIndex((h) => h === normAlias || h.includes(normAlias));
      if (idx !== -1) break;
    }
    map[field] = idx;
  }

  return map;
}

/* ── Parser principal ──────────────────────────────────────────────── */
export function parseComercialWorkbook(
  data: ArrayBuffer,
  fileName: string
): ParseResult {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: true,
  });

  if (rows.length < 2) {
    return { records: [], fileName, parsedAt: new Date().toISOString(), rowCount: 0 };
  }

  const COL = buildColMap(rows[0] as unknown[]);

  const g = (row: unknown[], field: keyof typeof COL) => {
    const idx = COL[field];
    return idx >= 0 ? (row as unknown[])[idx] : undefined;
  };

  const records: OportunidadComercial[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r || r.length === 0) continue;
    if (!str(g(r, "oportunidad")) && !str(g(r, "cliente")) && !str(g(r, "comercial"))) continue;

    records.push({
      rowId:            i,
      compania:         str(g(r, "compania")),
      idExterno:        str(g(r, "idExterno")),
      creado:           dateCell(g(r, "creado")),
      fechaFinal:       dateCell(g(r, "fechaFinal")),
      fechaVenta:       dateCell(g(r, "fechaVenta")),
      comercial:        str(g(r, "comercial")),
      preventa:         str(g(r, "preventa")),
      cierrePrevisto:   dateCell(g(r, "cierrePrevisto")),
      fechaCierre:      dateCell(g(r, "fechaCierre")),
      identificacionProceso: str(g(r, "identificacionProceso")),
      canalRecepcion:   str(g(r, "canalRecepcion")),
      sector:           str(g(r, "sector")),
      subsector:        str(g(r, "subsector")),
      modalidad:        str(g(r, "modalidad")),
      aliado:           str(g(r, "aliado")),
      razonSocialAliado:str(g(r, "razonSocialAliado")),
      fabricante:       str(g(r, "fabricante")),
      actualizado:      dateCell(g(r, "actualizado")),
      cliente:          str(g(r, "cliente")),
      oportunidad:      str(g(r, "oportunidad")),
      linea:            str(g(r, "linea")),
      consultoriaCOP:   num(g(r, "consultoriaCOP")),
      datosCOP:         num(g(r, "datosCOP")),
      tiCOP:            num(g(r, "tiCOP")),
      ingresoEsperado:  num(g(r, "ingresoEsperado")),
      tipoVenta:        str(g(r, "tipoVenta")),
      segmento:         str(g(r, "segmento")),
      tipoOportunidad:  str(g(r, "tipoOportunidad")),
      objeto:           str(g(r, "objeto")),
      clienteFinal:     str(g(r, "clienteFinal")),
      ganado:           str(g(r, "ganado")),
      razonPerdida:     str(g(r, "razonPerdida")),
      etapaActual:      str(g(r, "etapaActual")),
      motivoDeclinacion:str(g(r, "motivoDeclinacion")),
      vinculante:       str(g(r, "vinculante")),
    });
  }

  return {
    records,
    fileName,
    parsedAt: new Date().toISOString(),
    rowCount: records.length,
  };
}
