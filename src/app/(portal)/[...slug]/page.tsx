"use client";

import { usePathname } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import StatsCard from "@/components/ui/StatsCard";
import LeadsView from "@/components/modules/leads/LeadsView";
import CMMIView from "@/components/modules/cmmi/CMMIView";
import UsuariosView from "@/components/modules/usuarios/UsuariosView";
import CertificacionesView from "@/components/modules/certificaciones/CertificacionesView";
import {
  Users, CalendarDays, Plug2, FolderOpen, ShieldCheck, TrendingUp,
  Plus, RefreshCw, Search, Clock, CheckCircle2, XCircle, Minus,
  ExternalLink,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";

/* ─── DATOS MOCK ─────────────────────────────────────────────────── */

const STAGE_COLORS: Record<string, string> = {
  nuevo:       "bg-blue-500/10 text-blue-400",
  contactado:  "bg-sky-500/10 text-sky-400",
  calificado:  "bg-violet-500/10 text-violet-400",
  propuesta:   "bg-amber-500/10 text-amber-400",
  negociacion: "bg-orange-500/10 text-orange-400",
  ganado:      "bg-emerald-500/10 text-emerald-400",
  perdido:     "bg-white/[0.04] text-slate-500",
};

const mockLeads = [
  { id: "1", name: "Empresa ABC S.A.S",   email: "contacto@abc.com",        company: "Sector Público", stage: "propuesta",   source: "ODOO",   expected_revenue: 45000000  },
  { id: "2", name: "Tech Solutions Ltda", email: "info@techsol.co",          company: "Tecnología",     stage: "calificado",  source: "ODOO",   expected_revenue: 28000000  },
  { id: "3", name: "DataCorp Colombia",   email: "ventas@datacorp.co",       company: "Servicios",      stage: "negociacion", source: "ODOO",   expected_revenue: 120000000 },
  { id: "4", name: "Ministerio de TIC",   email: "compras@mintic.gov.co",    company: "Gobierno",       stage: "nuevo",       source: "Manual", expected_revenue: null      },
];

const mockMeetings = [
  { id: "1", title: "Demo producto - Empresa ABC",  description: "Presentación de la plataforma de analítica", start_at: "2026-05-28T15:00:00", status: "programada", attendees: ["Freddy Orozco", "Cliente ABC"],      lead: "Empresa ABC S.A.S"  },
  { id: "2", title: "Follow-up Tech Solutions",     description: "Revisión de propuesta técnica",              start_at: "2026-05-29T10:00:00", status: "programada", attendees: ["Freddy Orozco", "Tech Solutions"],    lead: "Tech Solutions Ltda" },
  { id: "3", title: "Kickoff DataCorp",             description: "Inicio del proyecto de implementación",      start_at: "2026-05-26T14:00:00", status: "realizada",  attendees: ["Equipo GrowData", "DataCorp"],        lead: "DataCorp Colombia"  },
];

const mockSources = [
  { id: "1", name: "ODOO CRM API",           type: "api",      status: "activa",   last_sync: "2026-05-28T12:00:00", description: "Leads y oportunidades desde ODOO"          },
  { id: "2", name: "BigQuery - DWH Principal",type: "bigquery", status: "activa",   last_sync: "2026-05-28T11:30:00", description: "Data warehouse principal GrowData"          },
  { id: "3", name: "Dataset Betplay 2025",    type: "csv",      status: "inactiva", last_sync: "2026-04-15T08:00:00", description: "Datos históricos de eventos deportivos"     },
  { id: "4", name: "Webhook SIGID",           type: "webhook",  status: "error",    last_sync: "2026-05-20T16:00:00", description: "Notificaciones de licitaciones públicas"    },
];

const mockRepos = [
  { id: "1", name: "Dataset Fútbol Colombiano 2025", type: "dataset",  description: "Eventos Opta F24, jugadores, estadísticas",           tags: ["opta", "f24", "fútbol"],        owner: "Freddy Orozco" },
  { id: "2", name: "Pipeline ETL Betplay",           type: "pipeline", description: "Transformación y carga de datos Betplay → BigQuery",  tags: ["etl", "bigquery", "betplay"],   owner: "Equipo Datos"  },
  { id: "3", name: "Modelo Predicción Resultados",   type: "modelo",   description: "ML model scikit-learn para predicción de partidos",   tags: ["ml", "sklearn", "predicción"],  owner: "Freddy Orozco" },
  { id: "4", name: "Reporte Ejecutivo May 2026",     type: "reporte",  description: "Informe mensual de resultados comerciales",           tags: ["comercial", "mensual"],         owner: "GrowData"      },
];

const leadsByStage = [
  { stage: "Nuevo",      count: 12 }, { stage: "Contactado", count: 8  },
  { stage: "Calificado", count: 6  }, { stage: "Propuesta",  count: 4  },
  { stage: "Negociación",count: 3  }, { stage: "Ganado",     count: 2  },
];

const revenueByMonth = [
  { mes: "Ene", valor: 45 }, { mes: "Feb", valor: 78 }, { mes: "Mar", valor: 52 },
  { mes: "Abr", valor: 91 }, { mes: "May", valor: 67 },
];

/* ─── HELPERS ────────────────────────────────────────────────────── */

function formatCurrency(value: number | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ─── VISTAS ─────────────────────────────────────────────────────── */

function DashboardView() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Dashboard" subtitle="Resumen general del hub de datos GrowData" />
      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard label="Total Leads"           value="—" icon={Users}       color="blue"   />
          <StatsCard label="Leads este mes"        value="—" icon={TrendingUp}  color="green"  />
          <StatsCard label="Reuniones esta semana" value="—" icon={CalendarDays}color="amber"  />
          <StatsCard label="Fuentes activas"       value="—" icon={Plug2}       color="violet" />
          <StatsCard label="Repositorios"          value="—" icon={FolderOpen}  color="cyan"   />
          <StatsCard label="CMMI completados"      value="—" icon={ShieldCheck} color="rose"   />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Leads recientes */}
          <div className="bg-[#111120] rounded-xl border border-white/[0.07]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
              <span className="text-sm font-semibold text-slate-300">Leads recientes</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {mockLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{lead.name}</p>
                    <p className="text-xs text-slate-500">{lead.company}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_COLORS[lead.stage]}`}>{lead.stage}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Reuniones */}
          <div className="bg-[#111120] rounded-xl border border-white/[0.07]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
              <span className="text-sm font-semibold text-slate-300">Próximas reuniones</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {mockMeetings.map((m) => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                    <CalendarDays size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{m.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(m.start_at)}</p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 shrink-0">{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// LeadsView se importa desde @/components/modules/leads/LeadsView (integración ODOO real)

function ReunionesView() {
  const STATUS_COLORS: Record<string, string> = {
    programada: "bg-blue-500/10 text-blue-400",
    realizada:  "bg-emerald-500/10 text-emerald-400",
    cancelada:  "bg-white/[0.04] text-slate-500",
  };
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Reuniones" subtitle="Gestión de reuniones, pendientes y seguimientos" />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex justify-end">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors">
            <Plus size={14} /> Nueva reunión
          </button>
        </div>
        <div className="space-y-3">
          {mockMeetings.map((m) => (
            <div key={m.id} className="bg-[#111120] rounded-xl border border-white/[0.07] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">{m.title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{m.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock size={12} />{formatDate(m.start_at)}</span>
                      <span className="flex items-center gap-1"><Users size={12} />{m.attendees.join(", ")}</span>
                    </div>
                    {m.lead && <p className="text-xs text-blue-400 mt-1.5">Lead: {m.lead}</p>}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLORS[m.status]}`}>{m.status}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function IntegracionesView() {
  const STATUS_ICONS: Record<string, React.ReactNode> = {
    activa:   <CheckCircle2 size={16} className="text-emerald-400" />,
    inactiva: <Minus        size={16} className="text-slate-500"   />,
    error:    <XCircle      size={16} className="text-rose-400"    />,
  };
  const STATUS_COLORS: Record<string, string> = {
    activa:   "bg-emerald-500/10 text-emerald-400",
    inactiva: "bg-white/[0.04] text-slate-500",
    error:    "bg-rose-500/10 text-rose-400",
  };
  const TYPE_COLORS: Record<string, string> = {
    bigquery: "bg-blue-500/10 text-blue-400",
    api:      "bg-violet-500/10 text-violet-400",
    csv:      "bg-amber-500/10 text-amber-400",
    database: "bg-cyan-500/10 text-cyan-400",
    webhook:  "bg-pink-500/10 text-pink-400",
  };
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Integraciones" subtitle="Fuentes de datos conectadas a GD-DatosHub" />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex justify-end">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors">
            <Plus size={14} /> Nueva integración
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockSources.map((s) => (
            <div key={s.id} className="bg-[#111120] rounded-xl border border-white/[0.07] p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {STATUS_ICONS[s.status]}
                    <h3 className="font-semibold text-slate-200 truncate">{s.name}</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{s.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[s.type]}`}>{s.type}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                  </div>
                </div>
                <button className="p-2 rounded-lg text-slate-600 hover:bg-white/[0.06] hover:text-slate-400 ml-2 shrink-0 transition-colors">
                  <RefreshCw size={15} />
                </button>
              </div>
              {s.last_sync && <p className="text-xs text-slate-600 mt-3">Última sincronización: {formatDate(s.last_sync)}</p>}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function ReportesView() {
  const chartTooltip = {
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#111120",
    color: "#e2e8f0",
  };
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Reportes" subtitle="Análisis y visualización de datos de GrowData" />
      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-[#111120] rounded-xl border border-white/[0.07] p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Leads por etapa</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsByStage} barSize={28}>
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltip} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#111120] rounded-xl border border-white/[0.07] p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Ingresos esperados (M COP)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltip} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />
                <Line type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}

function RepositoriosView() {
  const TYPE_COLORS: Record<string, string> = {
    dataset:   "bg-blue-500/10 text-blue-400",
    documento: "bg-amber-500/10 text-amber-400",
    reporte:   "bg-violet-500/10 text-violet-400",
    pipeline:  "bg-cyan-500/10 text-cyan-400",
    modelo:    "bg-emerald-500/10 text-emerald-400",
  };
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Repositorios" subtitle="Catálogo de assets de datos y documentos de GrowData" />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar asset…"
              className="pl-9 pr-4 py-2 rounded-lg border border-white/[0.07] bg-white/[0.04] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-colors w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors">
            <Plus size={14} /> Agregar asset
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockRepos.map((r) => (
            <div key={r.id} className="bg-[#111120] rounded-xl border border-white/[0.07] p-5 hover:border-white/[0.14] transition-colors">
              <div className="flex items-start justify-between">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[r.type]}`}>{r.type}</span>
                <button className="p-1 text-slate-600 hover:text-slate-400 transition-colors"><ExternalLink size={14} /></button>
              </div>
              <h3 className="font-semibold text-slate-200 mt-3">{r.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{r.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {r.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-slate-400">#{t}</span>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-3">{r.owner}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// CMMIView se importa desde @/components/modules/cmmi/CMMIView (módulo real por verticales)

/* ─── ROUTER PRINCIPAL ───────────────────────────────────────────── */

const VIEWS: Record<string, React.FC> = {
  "/dashboard":       DashboardView,
  "/leads":           LeadsView,
  "/reuniones":       ReunionesView,
  "/integraciones":   IntegracionesView,
  "/reportes":        ReportesView,
  "/repositorios":    RepositoriosView,
  "/cmmi":            CMMIView,
  "/usuarios":        UsuariosView,
  "/certificaciones": CertificacionesView,
};

export default function PortalPage() {
  const pathname = usePathname();
  const View = VIEWS[pathname] ?? DashboardView;
  return <View />;
}
