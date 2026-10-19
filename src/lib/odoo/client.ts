/**
 * Cliente ODOO JSON-RPC externo — mismo protocolo que odoorpc jsonrpc+ssl
 *
 * Flujo:
 *   1. POST /jsonrpc  { service:"common", method:"login" }  → uid (number)
 *   2. POST /jsonrpc  { service:"object", method:"execute_kw", args:[db,uid,pwd,...] }
 *
 * No usa session cookies, pasa las credenciales en cada llamada (igual que odoorpc).
 */

import type { OdooLead, OdooAttachment, Lead } from "./types";

const ODOO_URL      = process.env.ODOO_URL!;
const ODOO_DB       = process.env.ODOO_DB!;
const ODOO_USERNAME = process.env.ODOO_USERNAME!;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD!;

const LEAD_FIELDS = [
  "active", "name", "email_from", "phone", "partner_id", "user_id",
  "x_studio_linea", "x_studio_etapa_actual", "team_id", "x_studio_tipo_de_oportunidad",
  "x_studio_fabricante_otro", "x_studio_edopreventa", "x_studio_preventa",
  "create_date", "expected_revenue", "x_studio_consultoria_cop",
  "x_studio_datos_cop", "x_studio_ti_cop", "x_studio_alcance",
  "x_studio_objeto", "date_deadline", "x_studio_fecha_efectiva_de_cierre",
  "date_closed", "write_date", "x_studio_tipo_de_producto",
  "x_studio_proyecto", "won_status", "company_id",
];

/* ── POST genérico a /jsonrpc ──────────────────────────────────────── */
async function jsonrpc<T>(params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params }),
    cache: "no-store",
  });

  const body = await res.json();

  if (body?.error) {
    const msg = body.error?.data?.message ?? body.error?.message ?? JSON.stringify(body.error);
    throw new Error(`ODOO error: ${msg}`);
  }

  return body.result as T;
}

/* ── Autenticación → devuelve uid ──────────────────────────────────── */
async function login(): Promise<number> {
  const uid = await jsonrpc<number | false>({
    service: "common",
    method: "login",
    args: [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD],
  });

  if (!uid) throw new Error("ODOO auth failed: credenciales incorrectas o acceso denegado");
  return uid;
}

/* ── execute_kw genérico ───────────────────────────────────────────── */
async function executeKw<T>(
  uid: number,
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<T> {
  return jsonrpc<T>({
    service: "object",
    method: "execute_kw",
    args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargs],
  });
}

/* ── Ajuste GMT-5 ──────────────────────────────────────────────────── */
function toGMTMinus5(isoUtc: string | false): string {
  if (!isoUtc) return "";
  const d = new Date(isoUtc.replace(" ", "T") + "Z");
  d.setHours(d.getHours() - 5);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

/* ── Normalización raw → Lead ──────────────────────────────────────── */
function normalize(raw: OdooLead): Lead {
  const str = (v: string | false | null | undefined) => v || "";
  const num = (v: number | false | null | undefined) => v || 0;
  const m2o = (v: [number, string] | false) => (Array.isArray(v) ? v[1] : "");

  return {
    id: raw.id,
    activo: raw.active,
    nombre: raw.name,
    correo: str(raw.email_from),
    telefono: str(raw.phone),
    cliente: m2o(raw.partner_id),
    comercial: m2o(raw.user_id),
    linea: str(raw.x_studio_linea),
    etapa: str(raw.x_studio_etapa_actual),
    equipoVentas: m2o(raw.team_id),
    tipoOportunidad: str(raw.x_studio_tipo_de_oportunidad),
    fabricante: str(raw.x_studio_fabricante_otro),
    etapaPreventa: str(raw.x_studio_edopreventa),
    preventa: m2o(raw.x_studio_preventa),
    fechaCreacion: toGMTMinus5(raw.create_date),
    ingresosEsperados: num(raw.expected_revenue),
    consultoriaCOP: num(raw.x_studio_consultoria_cop),
    datosCOP: num(raw.x_studio_datos_cop),
    tiCOP: num(raw.x_studio_ti_cop),
    alcance: str(raw.x_studio_alcance).replace(/\n/g, " "),
    objeto: str(raw.x_studio_objeto).replace(/\n/g, " "),
    cierreEsperado: str(raw.date_deadline),
    fechaEfectivaCierre: str(raw.x_studio_fecha_efectiva_de_cierre),
    fechaCierre: toGMTMinus5(raw.date_closed),
    ultimaModificacion: toGMTMinus5(raw.write_date),
    tipoCliente: str(raw.x_studio_tipo_de_producto),
    tipoVenta:   str(raw.x_studio_proyecto),
    ganado:
      raw.won_status === "won"
        ? "Ganado"
        : raw.won_status === "lost"
        ? "Perdido"
        : "Pendiente",
    compania: m2o(raw.company_id),
    adjuntos: 0, // se sobreescribe en fetchLeads
  };
}

/* ── Función principal exportada ───────────────────────────────────── */
export async function fetchLeads(): Promise<Lead[]> {
  const uid = await login();

  // Busca TODOS los IDs incluyendo inactivos (active_test: false)
  const ids = await executeKw<number[]>(uid, "crm.lead", "search", [[]], {
    context: { active_test: false },
  });

  if (!ids.length) return [];

  // Lee los campos de todos los IDs
  const raws = await executeKw<OdooLead[]>(uid, "crm.lead", "read", [ids, LEAD_FIELDS], {
    context: { active_test: false },
  });

  // Cuenta adjuntos por lead (una sola llamada, solo el campo res_id)
  const attRecs = await executeKw<{ res_id: number }[]>(
    uid, "ir.attachment", "search_read",
    [[["res_model", "=", "crm.lead"], ["res_id", "in", ids]]],
    { fields: ["res_id"], limit: 0 }
  );
  const attachCounts: Record<number, number> = {};
  attRecs.forEach(({ res_id }) => {
    attachCounts[res_id] = (attachCounts[res_id] || 0) + 1;
  });

  const leads = raws.map(normalize);
  leads.forEach((l) => { l.adjuntos = attachCounts[l.id] || 0; });
  return leads;
}

/* ── Lista de adjuntos de un lead ──────────────────────────────────── */
export async function fetchLeadAttachments(leadId: number): Promise<OdooAttachment[]> {
  const uid = await login();
  return executeKw<OdooAttachment[]>(
    uid, "ir.attachment", "search_read",
    [[["res_model", "=", "crm.lead"], ["res_id", "=", leadId]]],
    { fields: ["id", "name", "mimetype", "file_size"], order: "create_date desc", limit: 0 }
  );
}

export interface PreventaHistoryEntry {
  leadId: number;
  leadName: string;
  from: string;   // "" = el lead no tenía valor antes (recién entró a preventa)
  to: string;
  date: string;   // fecha/hora tal cual la entrega Odoo (UTC, "YYYY-MM-DD HH:MM:SS")
  author: string;
}

/* ── Historial de cambios de un campo de crm.lead, leído de mail.tracking.value ──
   Odoo ya audita ambos campos usados aquí (tracking activado): x_studio_edopreventa
   (Estado Preventa) y stage_id (el Stage real del pipeline — no x_studio_etapa_actual,
   que es solo una copia de texto sin tracking propio, con 0 cambios registrados).
   No hace falta guardar nada propio, solo leerlo. ──────────────────────────────── */
async function fetchFieldHistory(fieldName: string, limit: number, leadId?: number): Promise<PreventaHistoryEntry[]> {
  const uid = await login();

  const fieldRows = await executeKw<{ id: number }[]>(
    uid, "ir.model.fields", "search_read",
    [[["model", "=", "crm.lead"], ["name", "=", fieldName]]],
    { fields: ["id"], limit: 1 }
  );
  if (!fieldRows.length) return [];

  // Para un lead puntual se acota primero por sus propios mensajes — evita traer y descartar
  // el historial de todos los leads solo para quedarse con el de uno.
  let leadMsgIds: number[] | null = null;
  if (leadId) {
    const leadMsgs = await executeKw<{ id: number }[]>(
      uid, "mail.message", "search_read",
      [[["model", "=", "crm.lead"], ["res_id", "=", leadId]]],
      { fields: ["id"], limit: 0 }
    );
    leadMsgIds = leadMsgs.map((m) => m.id);
    if (!leadMsgIds.length) return [];
  }

  const domain: unknown[] = [["field_id", "=", fieldRows[0].id]];
  if (leadMsgIds) domain.push(["mail_message_id", "in", leadMsgIds]);

  const values = await executeKw<{
    old_value_char: string | false;
    new_value_char: string | false;
    create_date: string;
    mail_message_id: [number, string | false] | false;
  }[]>(
    uid, "mail.tracking.value", "search_read",
    [domain],
    { fields: ["old_value_char", "new_value_char", "create_date", "mail_message_id"], order: "create_date desc", limit }
  );
  if (!values.length) return [];

  const msgIds = [...new Set(values.filter((v) => v.mail_message_id).map((v) => (v.mail_message_id as [number, string | false])[0]))];
  const msgs = await executeKw<{ id: number; res_id: number; author_id: [number, string] | false }[]>(
    uid, "mail.message", "read", [msgIds, ["res_id", "author_id"]]
  );
  const msgById = new Map(msgs.map((m) => [m.id, m]));

  const leadIds = [...new Set(msgs.map((m) => m.res_id))];
  const leadNames = leadIds.length
    ? await executeKw<{ id: number; name: string }[]>(uid, "crm.lead", "read", [leadIds, ["name"]], { context: { active_test: false } })
    : [];
  const nameById = new Map(leadNames.map((l) => [l.id, l.name]));

  return values
    .filter((v) => v.mail_message_id)
    .map((v) => {
      const msg = msgById.get((v.mail_message_id as [number, string | false])[0]);
      const leadId = msg?.res_id ?? 0;
      return {
        leadId,
        leadName: nameById.get(leadId) ?? `Lead #${leadId}`,
        from: v.old_value_char || "",
        to: v.new_value_char || "",
        date: v.create_date,
        // Odoo antepone la razón social de la empresa al nombre del autor interno (ej. "GROW DATA SAS, Fulano") — se quita para mostrar solo el nombre.
        author: msg?.author_id ? msg.author_id[1].replace(/^.*,\s*/, "") : "—",
      };
    })
    .filter((e) => e.leadId);
}

export function fetchPreventaHistory(limit = 30, leadId?: number): Promise<PreventaHistoryEntry[]> {
  return fetchFieldHistory("x_studio_edopreventa", limit, leadId);
}

export function fetchEtapaActualHistory(limit = 30, leadId?: number): Promise<PreventaHistoryEntry[]> {
  return fetchFieldHistory("stage_id", limit, leadId);
}

/* ── Contenido binario de un adjunto (base64 → Buffer) ────────────── */
export async function fetchAttachmentData(
  id: number
): Promise<{ name: string; mimetype: string; datas: string }> {
  const uid = await login();
  const rows = await executeKw<{ name: string; mimetype: string; datas: string | false }[]>(
    uid, "ir.attachment", "read",
    [[id], ["name", "mimetype", "datas"]]
  );
  if (!rows.length) throw new Error("Adjunto no encontrado");
  const r = rows[0];
  if (!r.datas) throw new Error("El adjunto no tiene datos de archivo");
  return { name: r.name, mimetype: r.mimetype || "application/octet-stream", datas: r.datas };
}

/* ── Dataset: catálogo de campos y lectura paginada de un modelo ───── */
// Solo estos modelos se pueden consultar desde la página Dataset (el nombre llega desde el navegador).
export const DATASET_MODELS = ["crm.lead"] as const;
export type DatasetModel = (typeof DATASET_MODELS)[number];
const FIELD_NAME_RE = /^[a-z_][a-z0-9_]*$/i;

type RawFieldMeta = {
  string?: string; type?: string; relation?: string; selection?: [string, string][] | false;
  store?: boolean; required?: boolean; readonly?: boolean;
};
const fieldsCache = new Map<string, { at: number; data: import("./types").OdooFieldMeta[] }>();

export async function fetchModelFields(model: DatasetModel): Promise<import("./types").OdooFieldMeta[]> {
  const hit = fieldsCache.get(model);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;
  const uid = await login();
  const raw = await executeKw<Record<string, RawFieldMeta>>(uid, model, "fields_get", [], {
    attributes: ["string", "type", "relation", "selection", "store", "required", "readonly"],
  });
  const data = Object.entries(raw)
    .map(([name, f]) => ({
      name,
      label: f.string || name,
      type: f.type || "char",
      relation: f.relation || undefined,
      selection: Array.isArray(f.selection) ? f.selection : undefined,
      stored: f.store !== false,
      required: !!f.required,
      readonly: !!f.readonly,
      custom: name.startsWith("x_"),
      heavy: f.type === "binary",
    }))
    .sort((a, b) => (a.name === "id" ? -1 : b.name === "id" ? 1 : a.label.localeCompare(b.label, "es")));
  fieldsCache.set(model, { at: Date.now(), data });
  return data;
}

export const EMPTY_FILTER_VALUE = "__empty__";   // filtra los registros donde el campo está vacío

export async function fetchDatasetPage(opts: {
  model: DatasetModel; fields: string[]; offset: number; limit: number; q: string; sort: string;
  filters?: { field: string; value: string }[];
}): Promise<{ total: number; records: Record<string, unknown>[] }> {
  const meta = await fetchModelFields(opts.model);
  const known = new Map(meta.map((f) => [f.name, f]));
  const fields = Array.from(new Set(["id", ...opts.fields])).filter((f) => FIELD_NAME_RE.test(f) && known.has(f) && !known.get(f)!.heavy);

  // orden: solo por campos con columna propia; por defecto ID descendente
  const [sf, sd] = opts.sort.split(":");
  const sortable = known.get(sf)?.stored ? sf : "id";
  const order = `${sortable} ${sd === "asc" ? "asc" : "desc"}`;

  const q = opts.q.trim();
  const domain: unknown[] = !q ? [] : /^\d+$/.test(q)
    ? ["|", "|", ["id", "=", Number(q)], ["name", "ilike", q], ["email_from", "ilike", q]]
    : ["|", ["name", "ilike", q], ["email_from", "ilike", q]];

  // filtros exactos (se combinan con Y): texto/lista por valor, many2one por ID y booleanos (solo campos con columna propia)
  for (const flt of (opts.filters ?? []).slice(0, 8)) {
    const ff = known.get(flt.field);
    if (!ff || !ff.stored) throw new Error("Campo de filtro no permitido.");
    const empty = flt.value === EMPTY_FILTER_VALUE;
    if (ff.type === "char" || ff.type === "selection") domain.push([ff.name, "=", empty ? false : flt.value]);
    else if (ff.type === "many2one") {
      if (!empty && !/^\d+$/.test(flt.value)) throw new Error("Valor de filtro inválido.");
      domain.push([ff.name, "=", empty ? false : Number(flt.value)]);
    } else if (ff.type === "boolean") {
      if (flt.value !== "true" && flt.value !== "false") throw new Error("Valor de filtro inválido.");
      domain.push([ff.name, "=", flt.value === "true"]);
    } else throw new Error("Tipo de campo no permitido para filtrar.");
  }

  const uid = await login();
  const ctx = { context: { active_test: false } };
  const [total, records] = await Promise.all([
    executeKw<number>(uid, opts.model, "search_count", [domain], ctx),
    executeKw<Record<string, unknown>[]>(uid, opts.model, "search_read", [domain], {
      fields, offset: opts.offset, limit: opts.limit, order, ...ctx,
    }),
  ]);
  return { total, records };
}

/** Todos los campos (con columna propia y no binarios) de un registro. */
export async function fetchDatasetRecord(model: DatasetModel, id: number): Promise<Record<string, unknown> | null> {
  const meta = await fetchModelFields(model);
  const names = meta.filter((f) => f.stored && !f.heavy).map((f) => f.name);
  const uid = await login();
  const rows = await executeKw<Record<string, unknown>[]>(uid, model, "read", [[id], names], { context: { active_test: false } });
  return rows[0] ?? null;
}

/** Valores distintos de un campo de texto/lista con su cantidad de registros (para armar filtros). */
export async function fetchDatasetFacet(model: DatasetModel, field: string): Promise<{ value: string; label: string; count: number }[]> {
  const meta = await fetchModelFields(model);
  const f = meta.find((m) => m.name === field);
  if (!f || !f.stored || !["char", "selection", "many2one"].includes(f.type)) throw new Error("Campo no permitido para filtrar.");
  const uid = await login();
  const groups = await executeKw<Record<string, unknown>[]>(uid, model, "read_group", [[], [field], [field]], {
    lazy: false, context: { active_test: false },
  });
  return groups.map((g) => {
    const v = g[field];
    const count = Number(g.__count ?? g[field + "_count"] ?? 0);
    if (Array.isArray(v) && v.length === 2) return { value: String(v[0]), label: String(v[1]), count };   // many2one: [id, nombre]
    if (typeof v === "string" && v) return { value: v, label: v, count };
    return { value: EMPTY_FILTER_VALUE, label: "", count };
  });
}
