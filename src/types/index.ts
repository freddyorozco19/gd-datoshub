export type UserRole = "admin" | "analyst" | "viewer";

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  odoo_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: LeadStage;
  source: string | null;
  assigned_to: string | null;
  expected_revenue: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadStage =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "propuesta"
  | "negociacion"
  | "ganado"
  | "perdido";

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  attendees: string[];
  lead_id: string | null;
  status: "programada" | "realizada" | "cancelada";
  created_by: string;
  created_at: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: "bigquery" | "api" | "csv" | "database" | "webhook";
  connection_config: Record<string, unknown>;
  status: "activa" | "inactiva" | "error";
  last_sync: string | null;
  created_at: string;
}

export interface CMMIProcess {
  id: string;
  area: string;
  level: 1 | 2 | 3 | 4 | 5;
  process_name: string;
  description: string | null;
  status: "pendiente" | "en_progreso" | "completado" | "auditado";
  owner: string | null;
  evidence_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: string;
  name: string;
  description: string | null;
  type: "dataset" | "documento" | "reporte" | "pipeline" | "modelo";
  tags: string[];
  url: string | null;
  owner: string | null;
  created_at: string;
}

export interface KPISummary {
  total_leads: number;
  leads_nuevos_mes: number;
  reuniones_semana: number;
  fuentes_activas: number;
  repositorios: number;
  cmmi_completados: number;
}
