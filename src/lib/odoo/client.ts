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

/* ── Chatter de una oportunidad: notas, mensajes, correos y cambios ── */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function fetchLeadNotes(leadId: number): Promise<import("./types").LeadNote[]> {
  const uid = await login();
  const msgs = await executeKw<{
    id: number; date: string; author_id: [number, string] | false; email_from: string | false; subject: string | false;
    body: string | false; message_type: string; subtype_id: [number, string] | false;
    tracking_value_ids: number[]; attachment_ids: number[]; parent_id: [number, string] | false; is_internal: boolean;
  }[]>(uid, "mail.message", "search_read", [[["model", "=", "crm.lead"], ["res_id", "=", leadId]]], {
    fields: ["id", "date", "author_id", "email_from", "subject", "body", "message_type", "subtype_id", "tracking_value_ids", "attachment_ids", "parent_id", "is_internal"],
    order: "date desc, id desc", limit: 300,
  });
  if (!msgs.length) return [];

  // cambios de campo (tracking) con la etiqueta y el tipo de cada campo
  const trIds = msgs.flatMap((m) => m.tracking_value_ids);
  type Tr = {
    id: number; field_id: [number, string] | false; old_value_char: string | false; new_value_char: string | false;
    old_value_text: string | false; new_value_text: string | false; old_value_datetime: string | false; new_value_datetime: string | false;
    old_value_float: number; new_value_float: number; old_value_integer: number; new_value_integer: number;
  };
  const tracking = trIds.length ? await executeKw<Tr[]>(uid, "mail.tracking.value", "read", [trIds, [
    "field_id", "old_value_char", "new_value_char", "old_value_text", "new_value_text",
    "old_value_datetime", "new_value_datetime", "old_value_float", "new_value_float", "old_value_integer", "new_value_integer",
  ]]) : [];
  const fieldIds = [...new Set(tracking.flatMap((t) => (t.field_id ? [t.field_id[0]] : [])))];
  const fieldInfo = fieldIds.length
    ? await executeKw<{ id: number; field_description: string; ttype: string }[]>(uid, "ir.model.fields", "read", [fieldIds, ["field_description", "ttype"]])
    : [];
  const fieldById = new Map(fieldInfo.map((f) => [f.id, f]));
  const trById = new Map(tracking.map((t) => [t.id, t]));
  const fmtTr = (t: Tr, which: "old" | "new", ttype: string): string => {
    const g = (name: string) => (t as unknown as Record<string, unknown>)[`${which}_${name}`];
    if (ttype === "boolean") return g("value_integer") ? "Sí" : "No";
    if (ttype === "integer") return String(g("value_integer") ?? "");
    if (ttype === "float" || ttype === "monetary") return String(g("value_float") ?? "");
    if (ttype === "datetime" || ttype === "date") {
      const v = g("value_datetime") as string | false;
      return v ? (ttype === "date" ? v.substring(0, 10) : v.substring(0, 16)) : "";
    }
    return String((g("value_char") as string | false) || (g("value_text") as string | false) || "");
  };

  // adjuntos
  const attIds = [...new Set(msgs.flatMap((m) => m.attachment_ids))];
  const atts = attIds.length
    ? await executeKw<{ id: number; name: string }[]>(uid, "ir.attachment", "read", [attIds, ["name"]])
    : [];
  const attById = new Map(atts.map((a) => [a.id, a.name]));

  const mapped = msgs.map((m) => {
    const changes = m.tracking_value_ids.flatMap((id) => {
      const t = trById.get(id);
      if (!t) return [];
      const f = t.field_id ? fieldById.get(t.field_id[0]) : undefined;
      return [{ field: f?.field_description ?? (t.field_id ? t.field_id[1] : "Campo"), from: fmtTr(t, "old", f?.ttype ?? "char"), to: fmtTr(t, "new", f?.ttype ?? "char") }];
    });
    const body = m.body ? htmlToText(m.body) : "";
    const st = m.subtype_id ? m.subtype_id[1] : "";
    let kind: import("./types").LeadNoteKind;
    let kindLabel: string;
    if (m.message_type === "comment") { kind = m.is_internal || st === "Note" ? "note" : "message"; kindLabel = kind === "note" ? "Nota" : "Mensaje"; }
    else if (m.message_type === "email" || m.message_type === "email_outgoing") { kind = "email"; kindLabel = m.message_type === "email" ? "Correo recibido" : "Correo enviado"; }
    else if (changes.length && !body) { kind = "change"; kindLabel = "Cambio"; }
    else if (st === "Note" && body) { kind = "note"; kindLabel = "Nota"; }
    else { kind = "system"; kindLabel = st || "Sistema"; }
    return {
      id: m.id,
      date: m.date,
      author: m.author_id ? m.author_id[1].replace(/^.*,\s*/, "") : (m.email_from || "—"),
      kind, kindLabel,
      subject: m.subject || "",
      body,
      changes,
      attachments: m.attachment_ids.map((id) => ({ id, name: attById.get(id) ?? `Adjunto ${id}` })),
      replyTo: m.parent_id ? m.parent_id[0] : null,
    };
  });
  // Odoo genera un correo por destinatario: se colapsan los idénticos y consecutivos
  return mapped.filter((n, i, arr) => i === 0 || !(
    n.kind === "email" && arr[i - 1].kind === "email" && arr[i - 1].date === n.date
    && arr[i - 1].author === n.author && arr[i - 1].subject === n.subject && arr[i - 1].body === n.body
  ));
}

/* ── Presales: cuándo entra cada lead a la etapa Preventa y cuándo cierra ───────────────
   Entrada: primera vez que el Stage pasa a Preventa (en Odoo esa etapa se llama "Análisis y Validación" y el
   historial guarda el nombre con cualquiera de las dos formas). Los leads creados directamente en Preventa no
   tienen ese evento: la vista usa su fecha de creación.
   Cierre: cada vez que el Estado Preventa pasa de ABIERTO a CERRADO (se ignoran mayúsculas: hay "Abierto" y "ABIERTO"). */
export interface PresalesTimeline {
  entries: Record<string, string>;                 // leadId → fecha de la primera entrada a Preventa (GMT-5)
  closes: { leadId: number; date: string }[];      // cierres Abierto → Cerrado (GMT-5)
  cycles: { leadId: number; open: string; close: string }[];   // ciclos completos: del último paso a Abierto al cierre (GMT-5)
  since: string;                                   // fecha del evento más antiguo
}
let timelineCache: { at: number; data: PresalesTimeline } | null = null;

export async function fetchPresalesTimeline(): Promise<PresalesTimeline> {
  if (timelineCache && Date.now() - timelineCache.at < 5 * 60 * 1000) return timelineCache.data;
  const uid = await login();
  const fields = await executeKw<{ id: number; name: string }[]>(
    uid, "ir.model.fields", "search_read",
    [[["model", "=", "crm.lead"], ["name", "in", ["stage_id", "x_studio_edopreventa"]]]],
    { fields: ["id", "name"] },
  );
  const stageField = fields.find((f) => f.name === "stage_id")?.id;
  const estadoField = fields.find((f) => f.name === "x_studio_edopreventa")?.id;
  if (!stageField || !estadoField) throw new Error("No se encontraron los campos de seguimiento en Odoo.");

  type Tr = { old_value_char: string | false; new_value_char: string | false; create_date: string; mail_message_id: [number, string | false] | false };
  const PREVENTA = ["Preventa", "Análisis y Validación"];
  const trFields = ["old_value_char", "new_value_char", "create_date", "mail_message_id"];
  const [entryAll, estadoAll] = await Promise.all([
    executeKw<Tr[]>(uid, "mail.tracking.value", "search_read",
      [[["field_id", "=", stageField], ["new_value_char", "in", PREVENTA]]], { fields: trFields, limit: 0, order: "create_date asc, id asc" }),
    // todos los cambios de Estado Preventa, en orden: de aquí salen los cierres y los ciclos
    executeKw<Tr[]>(uid, "mail.tracking.value", "search_read",
      [[["field_id", "=", estadoField]]], { fields: trFields, limit: 0, order: "create_date asc, id asc" }),
  ]);
  const entryTr = entryAll.filter((t) => !PREVENTA.includes((t.old_value_char || "") as string));   // sin transiciones Preventa → Preventa

  // lead de cada cambio, a través de su mensaje
  const msgIds = [...new Set([...entryTr, ...estadoAll].flatMap((t) => (t.mail_message_id ? [t.mail_message_id[0]] : [])))];
  const leadOf = new Map<number, number>();
  for (let i = 0; i < msgIds.length; i += 1000) {
    const ms = await executeKw<{ id: number; res_id: number }[]>(uid, "mail.message", "read", [msgIds.slice(i, i + 1000), ["res_id"]]);
    ms.forEach((m) => leadOf.set(m.id, m.res_id));
  }

  const entries: Record<string, string> = {};
  for (const t of entryTr) {
    const lead = t.mail_message_id ? leadOf.get(t.mail_message_id[0]) : undefined;
    if (lead && !(lead in entries)) entries[String(lead)] = toGMTMinus5(t.create_date);   // ya vienen ordenados: queda la primera
  }
  // cierres (Abierto → Cerrado) y ciclos (del último paso a Abierto hasta ese cierre); se ignoran mayúsculas: hay "Abierto" y "ABIERTO"
  const nm = (v: string | false) => String(v || "").trim().toLowerCase();
  const closes: PresalesTimeline["closes"] = [];
  const cycles: PresalesTimeline["cycles"] = [];
  const openedAt = new Map<number, string>();
  for (const t of estadoAll) {
    const lead = t.mail_message_id ? leadOf.get(t.mail_message_id[0]) : undefined;
    if (!lead) continue;
    const date = toGMTMinus5(t.create_date);
    if (nm(t.new_value_char) === "abierto") openedAt.set(lead, date);
    if (nm(t.old_value_char) === "abierto" && nm(t.new_value_char) === "cerrado") {
      closes.push({ leadId: lead, date });
      const open = openedAt.get(lead);
      if (open) { cycles.push({ leadId: lead, open, close: date }); openedAt.delete(lead); }
    }
  }
  const all = [...Object.values(entries), ...closes.map((c) => c.date)].sort();
  const data: PresalesTimeline = { entries, closes, cycles, since: all[0] ?? "" };
  timelineCache = { at: Date.now(), data };
  return data;
}

/* ── Fabricantes por oportunidad ──────────────────────────────────────────────────────
   El modelo de Studio x_fabricantes es una tabla de líneas: cada fila liga una oportunidad con un fabricante
   (catálogo x__fabricantes). Un lead puede tener varias. No se exponen proveedores ni NIT. */
let fabCache: { at: number; data: Record<string, string[]> } | null = null;

export async function fetchLeadFabricantes(): Promise<Record<string, string[]>> {
  if (fabCache && Date.now() - fabCache.at < 5 * 60 * 1000) return fabCache.data;
  const uid = await login();
  const lines = await executeKw<{ x_oportunidad: [number, string] | false; x_fabricantes: [number, string] | false }[]>(
    uid, "x_fabricantes", "search_read", [[["x_oportunidad", "!=", false]]], { fields: ["x_oportunidad", "x_fabricantes"], limit: 0 },
  );
  const data: Record<string, string[]> = {};
  for (const l of lines) {
    if (!l.x_oportunidad) continue;
    const id = String(l.x_oportunidad[0]);
    const name = l.x_fabricantes ? l.x_fabricantes[1].trim() : "N/A";
    (data[id] ??= []).push(name || "N/A");
  }
  fabCache = { at: Date.now(), data };
  return data;
}

/* ── Timeline de un lead: recorrido por etapas y estados, con sus fechas ───────────────
   Etapas: historial de stage_id. El historial guarda el nombre con las formas antiguas y nuevas
   (p. ej. "Análisis y Validación" = "Preventa"), así que se unifican en 5 etapas + declinada / no viable. */
export type StageKey = "ident" | "prev" | "pres" | "eval" | "gan" | "dec" | "nov";
export interface LeadTimeline {
  created: string;                                                   // creación del lead (GMT-5)
  end: string;                                                       // fin del recorrido: hoy, o el momento en que llegó a una etapa final
  terminal: boolean;                                                 // el lead está en Ganada, Declinada o No viable
  current: StageKey;
  deadline: string;                                                  // cierre esperado
  stages: { key: StageKey; name: string; from: string; to: string }[];
  estados: { key: "none" | "ab" | "ce" | "otro"; label: string; from: string; to: string }[];
  events: { date: string; kind: "stage" | "estado"; text: string }[];
}

const STAGE_KEYS: Record<string, StageKey> = {
  "identificacion de oportunidad": "ident", "new": "ident", "registro de oportunidad": "ident", "definicion de requerimientos": "ident",
  "estudio de mercado": "ident", "eliminar 1": "ident", "eliminar 2": "ident",
  "preventa": "prev", "analisis y validacion": "prev",
  "presentacion de oferta": "pres", "oferta en construccion": "pres",
  "evaluacion de la entidad": "eval", "oferta entregada": "eval",
  "oferta ganada": "gan", "won": "gan",
  "oferta declinada": "dec", "oferta no viable": "nov",
};
const normStage = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const stageKey = (name: string): StageKey => STAGE_KEYS[normStage(name)] ?? "ident";

export async function fetchLeadTimeline(leadId: number): Promise<LeadTimeline | null> {
  const uid = await login();
  const leads = await executeKw<{ create_date: string; stage_id: [number, string] | false; date_deadline: string | false }[]>(
    uid, "crm.lead", "read", [[leadId], ["create_date", "stage_id", "date_deadline"]], { context: { active_test: false } },
  );
  if (!leads.length) return null;
  const lead = leads[0];

  const msgs = await executeKw<{ tracking_value_ids: number[] }[]>(
    uid, "mail.message", "search_read", [[["model", "=", "crm.lead"], ["res_id", "=", leadId]]],
    { fields: ["tracking_value_ids"], limit: 500 },
  );
  const ids = msgs.flatMap((m) => m.tracking_value_ids);
  type Tr = { field_id: [number, string] | false; old_value_char: string | false; new_value_char: string | false; create_date: string };
  const tr = ids.length ? await executeKw<Tr[]>(uid, "mail.tracking.value", "read", [ids, ["field_id", "old_value_char", "new_value_char", "create_date"]]) : [];
  const fieldIds = [...new Set(tr.flatMap((t) => (t.field_id ? [t.field_id[0]] : [])))];
  const fields = fieldIds.length ? await executeKw<{ id: number; name: string }[]>(uid, "ir.model.fields", "read", [fieldIds, ["name"]]) : [];
  const nameOf = new Map(fields.map((f) => [f.id, f.name]));
  const by = (field: string) => tr
    .filter((t) => t.field_id && nameOf.get(t.field_id[0]) === field)
    .sort((a, b) => a.create_date.localeCompare(b.create_date));
  const stageTr = by("stage_id");
  const estadoTr = by("x_studio_edopreventa");

  const created = toGMTMinus5(lead.create_date);
  const now = toGMTMinus5(new Date().toISOString().slice(0, 19).replace("T", " "));

  // etapas: la inicial es el valor anterior del primer cambio (o la etapa actual si nunca cambió)
  const currentName = lead.stage_id ? lead.stage_id[1] : "New";
  const stages: LeadTimeline["stages"] = [];
  let name = stageTr.length ? String(stageTr[0].old_value_char || currentName) : currentName;
  let cursor = created;
  for (const t of stageTr) {
    const at = toGMTMinus5(t.create_date);
    stages.push({ key: stageKey(name), name, from: cursor, to: at });
    name = String(t.new_value_char || name);
    cursor = at;
  }
  stages.push({ key: stageKey(name), name, from: cursor, to: now });
  const current = stages[stages.length - 1].key;
  const terminal = current === "gan" || current === "dec" || current === "nov";
  let end = now;
  if (terminal) { end = stages[stages.length - 1].from; stages[stages.length - 1].to = end; }   // etapa final: marcador, no una barra hasta hoy

  // Estado Preventa, recortado al fin del recorrido
  const ek = (v: string): LeadTimeline["estados"][number]["key"] => {
    const n = v.trim().toLowerCase();
    return !n ? "none" : n === "abierto" ? "ab" : n === "cerrado" ? "ce" : "otro";
  };
  const estados: LeadTimeline["estados"] = [];
  let eName = "";
  let eCursor = created;
  const pushE = (label: string, from: string, to: string) => {
    const t = to > end ? end : to;
    if (from < t || (from === t && estados.length === 0)) estados.push({ key: ek(label), label: label || "Sin estado", from, to: t });
  };
  for (const t of estadoTr) {
    const at = toGMTMinus5(t.create_date);
    pushE(eName, eCursor, at);
    eName = String(t.new_value_char || "");
    eCursor = at;
  }
  pushE(eName, eCursor, end);

  const events: LeadTimeline["events"] = [
    ...stageTr.map((t) => ({ date: toGMTMinus5(t.create_date), kind: "stage" as const, text: `${t.old_value_char || "—"} → ${t.new_value_char || "—"}` })),
    ...estadoTr.map((t) => ({ date: toGMTMinus5(t.create_date), kind: "estado" as const, text: `${t.old_value_char || "(vacío)"} → ${t.new_value_char || "(vacío)"}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return { created, end, terminal, current, deadline: lead.date_deadline || "", stages, estados, events };
}
