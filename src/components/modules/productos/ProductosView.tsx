"use client";

import { useState } from "react";
import {
  BellRing, Activity, FileSearch, Workflow, Globe2, Server,
  MessageSquareHeart, Building2, Leaf, ShieldCheck, Landmark,
  Truck, ArrowLeft, ChevronRight, Search, Package,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";

/* ── Tipos ────────────────────────────────────────────────────────────────── */
interface Producto {
  id:        string;
  nombre:    string;       // Nombre corto para la card
  headline:  string;       // Propuesta de valor (título largo del usuario)
  categoria: string;
  icon:      typeof Package;
  color:     string;       // hex para gradientes
  rgb:       string;       // rgb para transparencias
  tagColor:  string;       // clases Tailwind para el badge de categoría
  descripcion: string;     // Párrafo de detalle
  caracteristicas: string[];
  casos: string[];
}

/* ── Catálogo ─────────────────────────────────────────────────────────────── */
const PRODUCTOS: Producto[] = [
  {
    id: "alertas-tempranas",
    nombre: "Alertas Tempranas",
    headline: "De datos existentes a las alertas tempranas que cambian decisiones",
    categoria: "Datos & Analytics",
    icon: BellRing,
    color: "#7C3AED", rgb: "124,58,237",
    tagColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    descripcion: "Convertimos los datos que ya tienes en un sistema de alertas proactivo. Sin infraestructura nueva: conectamos tus fuentes actuales, aplicamos modelos estadísticos y te entregamos señales accionables antes de que el problema escale.",
    caracteristicas: ["Conexión a fuentes existentes (ERP, CRM, bases de datos)", "Modelos de detección de anomalías en tiempo real", "Dashboard de alertas con niveles de criticidad", "Notificaciones por correo, WhatsApp o Slack", "Backtesting sobre datos históricos"],
    casos: ["Detección temprana de caída en ventas por territorio", "Alertas de incumplimiento de SLA en operaciones", "Monitoreo de KPIs críticos de negocio"],
  },
  {
    id: "analitica-operacional",
    nombre: "Analítica Operacional",
    headline: "Captura de Datos y Analítica para Visibilidad Operacional en Tiempo Real",
    categoria: "Datos & Analytics",
    icon: Activity,
    color: "#06B6D4", rgb: "6,182,212",
    tagColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    descripcion: "Instalamos sensores, integramos dispositivos y construimos pipelines de datos que transforman tu operación en un gemelo digital observable. Visualiza cada proceso en tiempo real y toma decisiones basadas en hechos, no en suposiciones.",
    caracteristicas: ["Captura de datos IoT y sensores industriales", "Pipelines de streaming con baja latencia", "Dashboards operacionales en tiempo real", "Integración con SCADA, PLCs y sistemas legados", "Alertas operacionales configurables"],
    casos: ["Visibilidad de flota y logística en campo", "Monitoreo de plantas de producción", "Control de inventarios en tiempo real"],
  },
  {
    id: "digitalizacion-documental",
    nombre: "Digitalización Documental",
    headline: "Digitalización de documentos y analítica para toma de decisiones confiables",
    categoria: "Digitalización",
    icon: FileSearch,
    color: "#F59E0B", rgb: "245,158,11",
    tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    descripcion: "Digitalizamos, clasificamos y extraemos información de cualquier tipo de documento mediante OCR avanzado e IA. El resultado: una base de conocimiento estructurada que alimenta reportes, búsquedas y modelos de decisión.",
    caracteristicas: ["OCR de alta precisión sobre documentos físicos y PDF", "Clasificación automática por tipo de documento", "Extracción de campos clave con IA generativa", "Motor de búsqueda semántica sobre el archivo digitalizado", "API de consulta para sistemas externos"],
    casos: ["Digitalización de contratos y expedientes legales", "Gestión de hojas de vida y documentos de RRHH", "Archivo histórico de facturas y comprobantes"],
  },
  {
    id: "automatizacion-negocio",
    nombre: "Automatización de Negocio",
    headline: "Sistema que conecta y automatiza la operación del negocio de punta a punta",
    categoria: "Automatización",
    icon: Workflow,
    color: "#10B981", rgb: "16,185,129",
    tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    descripcion: "Diseñamos e implementamos flujos de trabajo automatizados que eliminan tareas manuales, reducen errores y aceleran los ciclos de negocio. Integramos todos tus sistemas y creamos una cadena de valor digital coherente.",
    caracteristicas: ["Mapeo y rediseño de procesos (BPM)", "Integraciones vía API, webhooks y conectores nativos", "RPA para tareas repetitivas en sistemas legados", "Orquestación de procesos multi-sistema", "Monitoreo y trazabilidad de cada transacción"],
    casos: ["Automatización del ciclo de compras y aprobaciones", "Onboarding digital de clientes sin papel", "Sincronización automática entre CRM, ERP y facturación"],
  },
  {
    id: "inteligencia-social",
    nombre: "Inteligencia Social",
    headline: "Inteligencia social en tiempo real: Monitoreo del entorno digital y anticipación de crisis reputacionales",
    categoria: "IA & Analytics",
    icon: Globe2,
    color: "#EC4899", rgb: "236,72,153",
    tagColor: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    descripcion: "Monitoreamos redes sociales, medios digitales y foros en tiempo real para detectar conversaciones sobre tu marca, competencia y sector. Modelos de NLP en español identifican sentimiento, tendencias y señales de crisis antes de que se viralicen.",
    caracteristicas: ["Monitoreo 24/7 de redes sociales y medios digitales", "Análisis de sentimiento en español con modelos de NLP", "Detección de crisis reputacionales emergentes", "Alertas inmediatas a equipos de comunicaciones", "Reportes ejecutivos de percepción de marca"],
    casos: ["Gestión proactiva de reputación corporativa", "Seguimiento de campañas de comunicación", "Monitoreo de competencia e industria"],
  },
  {
    id: "outsourcing-ti",
    nombre: "Outsourcing TI",
    headline: "Outsourcing integral de la operación de TI",
    categoria: "TI Gestionada",
    icon: Server,
    color: "#6366F1", rgb: "99,102,241",
    tagColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    descripcion: "Asumimos la operación completa de tu infraestructura tecnológica: servidores, redes, seguridad, soporte a usuarios y continuidad de negocio. Tú te enfocas en crecer; nosotros garantizamos que la tecnología no sea un obstáculo.",
    caracteristicas: ["Mesa de servicio 24/7 con SLAs definidos", "Administración de infraestructura on-premise y cloud", "Gestión de seguridad perimetral y endpoints", "Backup, recuperación ante desastres y continuidad", "Reportes mensuales de disponibilidad y gestión"],
    casos: ["Tercerización de TI para empresas medianas", "Soporte a empresas sin área de tecnología interna", "Transición y operación de sistemas críticos"],
  },
  {
    id: "atencion-inteligente",
    nombre: "Atención Inteligente",
    headline: "Sistema con asistencia de IA, automatización y agentes humanos, que convierte la atención ciudadana/cliente en una conversación útil",
    categoria: "IA & CX",
    icon: MessageSquareHeart,
    color: "#F97316", rgb: "249,115,22",
    tagColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    descripcion: "Combinamos IA conversacional, automatización de flujos y agentes humanos para ofrecer atención omnicanal que realmente resuelve. El sistema aprende de cada interacción y escala de bot a humano sin fricción.",
    caracteristicas: ["Chatbot con IA generativa entrenado en tu dominio", "Enrutamiento inteligente a agentes especializados", "Integración con WhatsApp, web, app y call center", "Base de conocimiento autoactualizable", "Análisis de satisfacción y resolución en tiempo real"],
    casos: ["Centro de atención ciudadana para alcaldías", "Soporte al cliente en empresas de servicios", "Mesa de ayuda interna para empleados"],
  },
  {
    id: "arquitectura-ti",
    nombre: "Arquitectura TI",
    headline: "Arquitectura empresarial de TI que alinea los sistemas de información con la operación real del negocio",
    categoria: "TI Estratégica",
    icon: Building2,
    color: "#64748B", rgb: "100,116,139",
    tagColor: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    descripcion: "Diseñamos la arquitectura tecnológica de tu empresa partiendo de la operación real, no de la teoría. Mapeamos capacidades, identificamos brechas, priorizamos inversiones y construimos la hoja de ruta para una TI que habilita el negocio.",
    caracteristicas: ["Diagnóstico de capacidades tecnológicas actuales", "Diseño de arquitectura empresarial (TOGAF/ZACHMAN)", "Mapa de sistemas y flujos de información", "Hoja de ruta de modernización priorizada", "Gobierno de TI y marcos de gestión"],
    casos: ["Planeación tecnológica a 3-5 años", "Proceso de transformación digital corporativa", "Auditoría y racionalización del portafolio de sistemas"],
  },
  {
    id: "gestion-ambiental",
    nombre: "Gestión Ambiental",
    headline: "Sistema de recolección y análisis de datos que convierten la gestión de recursos ambientales en soporte para la toma de decisiones",
    categoria: "Datos & Medio Ambiente",
    icon: Leaf,
    color: "#22C55E", rgb: "34,197,94",
    tagColor: "bg-green-500/10 text-green-400 border-green-500/20",
    descripcion: "Plataforma especializada para entidades ambientales, empresas mineras, energéticas y de agua. Recopilamos datos de campo, estaciones de monitoreo y sensores remotos, y los convertimos en tableros de decisión para autoridades y operadores.",
    caracteristicas: ["Integración con estaciones hidrometeorológicas y sensores remotos", "Mapas geoespaciales con capas de datos ambientales", "Modelos predictivos de calidad del agua/aire/suelo", "Reportes regulatorios automatizados", "Alertas por umbrales de cumplimiento ambiental"],
    casos: ["Monitoreo de cuencas hídricas y caudales", "Control de emisiones en plantas industriales", "Gestión de permisos y concesiones ambientales"],
  },
  {
    id: "tramites-seguros",
    nombre: "Trámites Seguros",
    headline: "Plataforma que centraliza la información y conecta en tiempo real millones de trámites con confiabilidad y sin posibilidad de fraudes",
    categoria: "Gobierno Digital",
    icon: ShieldCheck,
    color: "#3B82F6", rgb: "59,130,246",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    descripcion: "Construimos el núcleo digital de confianza para gobiernos y empresas que gestionan grandes volúmenes de trámites. Identidad digital, firma electrónica, trazabilidad inmutable y validaciones en tiempo real garantizan que cada transacción sea auténtica.",
    caracteristicas: ["Autenticación multifactor y biométrica", "Firma electrónica certificada", "Registro inmutable de transacciones (auditoría)", "Validación en tiempo real contra fuentes oficiales", "Escalabilidad para millones de transacciones diarias"],
    casos: ["Plataforma central de trámites gubernamentales", "Sistema de gestión de contratos sin fraude", "Validación de identidad en procesos masivos"],
  },
  {
    id: "ciudad-digital",
    nombre: "Ciudad Digital",
    headline: "Digitalización de los trámites y servicios de una ciudad/empresa",
    categoria: "Gobierno Digital",
    icon: Landmark,
    color: "#0EA5E9", rgb: "14,165,233",
    tagColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    descripcion: "Llevamos todos los trámites y servicios de una ciudad o empresa al mundo digital: ventanilla única, pagos en línea, turnos virtuales, notificaciones automáticas y seguimiento de solicitudes en tiempo real para ciudadanos y funcionarios.",
    caracteristicas: ["Ventanilla única digital multicanal", "Integración con pasarelas de pago locales", "Gestión de turnos y citas en línea", "Notificaciones automáticas al ciudadano/cliente", "Dashboard de gestión para funcionarios y supervisores"],
    casos: ["Digitalización de alcaldías y entidades públicas", "Modernización de servicios en empresas de servicios públicos", "Portal ciudadano para trámites de licencias y permisos"],
  },
  {
    id: "portal-proveedores",
    nombre: "Portal Proveedores",
    headline: "Portal de gestión de proveedores",
    categoria: "Operaciones",
    icon: Truck,
    color: "#A855F7", rgb: "168,85,247",
    tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    descripcion: "Centralizamos toda la relación con tu cadena de proveedores en un portal colaborativo: onboarding digital, gestión documental, evaluación de desempeño, órdenes de compra y pagos. Visibilidad total del supply chain desde un solo lugar.",
    caracteristicas: ["Onboarding digital y homologación de proveedores", "Gestión de documentos y vencimientos", "Módulo de órdenes de compra y entregas", "Evaluación periódica de desempeño", "Integración con ERP y sistemas de pago"],
    casos: ["Centralización del supply chain en empresas industriales", "Gestión de contratistas y terceros en proyectos", "Cumplimiento normativo en compras públicas"],
  },
];

const CATEGORIAS = ["Todas", ...Array.from(new Set(PRODUCTOS.map((p) => p.categoria)))];

/* ── Card del catálogo ────────────────────────────────────────────────────── */
function ProductCard({ producto, onClick }: { producto: Producto; onClick: () => void }) {
  const Icon = producto.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border border-white/[0.06] bg-[#0D0D1A] p-5 hover:border-white/[0.14] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col gap-4"
      style={{ ["--glow" as string]: `rgba(${producto.rgb},0.08)` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `rgba(${producto.rgb},0.12)`, border: `1px solid rgba(${producto.rgb},0.25)` }}
        >
          <Icon size={18} style={{ color: producto.color }} />
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${producto.tagColor} shrink-0 mt-0.5`}>
          {producto.categoria}
        </span>
      </div>

      {/* Nombre */}
      <div className="flex-1">
        <h3
          className="text-sm font-bold text-white group-hover:text-white/90 transition-colors leading-tight mb-2"
          style={{ color: producto.color }}
        >
          {producto.nombre}
        </h3>
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
          {producto.headline}
        </p>
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-1 text-[11px] font-medium transition-colors"
        style={{ color: `rgba(${producto.rgb},0.7)` }}
      >
        Ver detalle
        <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}

/* ── Micrositio de detalle ────────────────────────────────────────────────── */
function ProductoDetalle({ producto, onBack }: { producto: Producto; onBack: () => void }) {
  const Icon = producto.icon;
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar />

      {/* Hero */}
      <div
        className="relative px-6 md:px-10 pt-8 pb-10 border-b border-white/[0.05]"
        style={{ background: `radial-gradient(ellipse 70% 120% at 15% -10%, rgba(${producto.rgb},0.15) 0%, transparent 65%)` }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Volver al catálogo
        </button>

        <div className="flex items-start gap-5 max-w-3xl">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `rgba(${producto.rgb},0.12)`, border: `1px solid rgba(${producto.rgb},0.3)` }}
          >
            <Icon size={26} style={{ color: producto.color }} />
          </div>
          <div>
            <span className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mb-2 ${producto.tagColor}`}>
              {producto.categoria}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-3">
              {producto.nombre}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
              {producto.headline}
            </p>
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 px-6 md:px-10 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl">

        {/* Descripción */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">¿Qué es?</h2>
            <p className="text-sm text-slate-300 leading-relaxed">{producto.descripcion}</p>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Capacidades clave</h2>
            <ul className="space-y-2.5">
              {producto.caracteristicas.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: producto.color }}
                  />
                  {c}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Sidebar de detalle */}
        <div className="space-y-5">
          {/* Casos de uso */}
          <div
            className="rounded-2xl p-5 border"
            style={{
              background: `rgba(${producto.rgb},0.04)`,
              borderColor: `rgba(${producto.rgb},0.2)`,
            }}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: producto.color }}>
              Casos de uso
            </h3>
            <ul className="space-y-3">
              {producto.casos.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                  <ChevronRight size={12} className="shrink-0 mt-0.5" style={{ color: producto.color }} />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="rounded-2xl p-5 border border-white/[0.06] bg-[#0D0D1A] space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">¿Interesado?</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Contacta al equipo comercial para agendar una demo o recibir más información sobre este producto.
            </p>
            <a
              href="/leads"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-all"
              style={{
                background: `linear-gradient(135deg, rgba(${producto.rgb},0.8), rgba(${producto.rgb},1))`,
                boxShadow: `0 4px 20px rgba(${producto.rgb},0.25)`,
              }}
            >
              <Icon size={13} /> Solicitar información
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Vista principal ──────────────────────────────────────────────────────── */
export default function ProductosView() {
  const [productoActivo, setProductoActivo] = useState<Producto | null>(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");

  if (productoActivo) {
    return <ProductoDetalle producto={productoActivo} onBack={() => setProductoActivo(null)} />;
  }

  const filtrados = PRODUCTOS.filter((p) => {
    const matchCat = categoriaFiltro === "Todas" || p.categoria === categoriaFiltro;
    const q = busqueda.toLowerCase();
    const matchQ = !q || p.nombre.toLowerCase().includes(q) || p.headline.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar />

      <div className="px-6 md:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Catálogo de Productos</h1>
          <p className="text-sm text-slate-500 mt-1">Soluciones GrowData para transformación digital y analítica avanzada</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar producto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/[0.07] bg-white/[0.03] text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-white/[0.15] transition-colors"
            />
          </div>

          {/* Categorías */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaFiltro(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  categoriaFiltro === cat
                    ? "bg-white/[0.1] border-white/[0.2] text-white"
                    : "border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.1]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Contador */}
        <p className="text-[11px] text-slate-600">
          {filtrados.length} {filtrados.length === 1 ? "producto" : "productos"}
          {categoriaFiltro !== "Todas" && ` en ${categoriaFiltro}`}
          {busqueda && ` · "${busqueda}"`}
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
          {filtrados.map((producto) => (
            <ProductCard
              key={producto.id}
              producto={producto}
              onClick={() => setProductoActivo(producto)}
            />
          ))}
          {filtrados.length === 0 && (
            <div className="col-span-full flex items-center justify-center py-20 text-slate-600 text-sm">
              Sin resultados para tu búsqueda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
