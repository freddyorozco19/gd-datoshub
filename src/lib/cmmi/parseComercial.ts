import * as XLSX from "xlsx";
import type { OportunidadComercial, ParseResult } from "./types";

/**
 * Índice de columnas del export COMERCIAL (orden fijo del Excel de oportunidades).
 * Se mapea por posición — robusto frente a headers con tildes/duplicados.
 */
const COL = {
  compania: 0, idExterno: 1, creado: 2, fechaFinal: 3, fechaVenta: 4,
  comercial: 5, preventa: 6, cierrePrevisto: 7, fechaCierre: 8,
  identificacionProceso: 9, canalRecepcion: 10, /* 11 especifique canal */
  sector: 12, /* 13 esp sector */ subsector: 14, /* 15 esp subsector */
  modalidad: 16, /* 17 esp modalidad */ aliado: 18, razonSocialAliado: 19,
  fabricante: 20, /* 21 esp fabricante */ actualizado: 22, cliente: 23,
  oportunidad: 24, linea: 25, consultoriaCOP: 26, datosCOP: 27, tiCOP: 28,
  ingresoEsperado: 29, tipoVenta: 30, segmento: 31, tipoOportunidad: 32,
  objeto: 33, clienteFinal: 34, ganado: 35, razonPerdida: 36,
  etapaActual: 37, motivoDeclinacion: 38, vinculante: 39, /* 40 vacío */ /* 41 etapa dup */
} as const;

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

/** Convierte un valor de celda de fecha (Date | serial number | "") a ISO-ish "YYYY-MM-DD HH:mm". */
const dateCell = (v: unknown): string => {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().substring(0, 19).replace("T", " ");
  if (typeof v === "number") {
    const d = XLSX.SSF ? excelSerialToDate(v) : null;
    return d ? d.toISOString().substring(0, 19).replace("T", " ") : "";
  }
  return str(v);
};

/** Serial de Excel → Date (base 1899-12-30, días + fracción) */
function excelSerialToDate(serial: number): Date {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
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

  const records: OportunidadComercial[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    // omitir filas totalmente vacías
    if (!str(r[COL.oportunidad]) && !str(r[COL.cliente]) && !str(r[COL.comercial])) continue;

    records.push({
      rowId:            i,
      compania:         str(r[COL.compania]),
      idExterno:        str(r[COL.idExterno]),
      creado:           dateCell(r[COL.creado]),
      fechaFinal:       dateCell(r[COL.fechaFinal]),
      fechaVenta:       dateCell(r[COL.fechaVenta]),
      comercial:        str(r[COL.comercial]),
      preventa:         str(r[COL.preventa]),
      cierrePrevisto:   dateCell(r[COL.cierrePrevisto]),
      fechaCierre:      dateCell(r[COL.fechaCierre]),
      identificacionProceso: str(r[COL.identificacionProceso]),
      canalRecepcion:   str(r[COL.canalRecepcion]),
      sector:           str(r[COL.sector]),
      subsector:        str(r[COL.subsector]),
      modalidad:        str(r[COL.modalidad]),
      aliado:           str(r[COL.aliado]),
      razonSocialAliado:str(r[COL.razonSocialAliado]),
      fabricante:       str(r[COL.fabricante]),
      actualizado:      dateCell(r[COL.actualizado]),
      cliente:          str(r[COL.cliente]),
      oportunidad:      str(r[COL.oportunidad]),
      linea:            str(r[COL.linea]),
      consultoriaCOP:   num(r[COL.consultoriaCOP]),
      datosCOP:         num(r[COL.datosCOP]),
      tiCOP:            num(r[COL.tiCOP]),
      ingresoEsperado:  num(r[COL.ingresoEsperado]),
      tipoVenta:        str(r[COL.tipoVenta]),
      segmento:         str(r[COL.segmento]),
      tipoOportunidad:  str(r[COL.tipoOportunidad]),
      objeto:           str(r[COL.objeto]),
      clienteFinal:     str(r[COL.clienteFinal]),
      ganado:           str(r[COL.ganado]),
      razonPerdida:     str(r[COL.razonPerdida]),
      etapaActual:      str(r[COL.etapaActual]),
      motivoDeclinacion:str(r[COL.motivoDeclinacion]),
      vinculante:       str(r[COL.vinculante]),
    });
  }

  return {
    records,
    fileName,
    parsedAt: new Date().toISOString(),
    rowCount: records.length,
  };
}
