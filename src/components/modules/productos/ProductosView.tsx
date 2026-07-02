"use client";

import { useState } from "react";
import {
  BellRing, Activity, FileSearch, Workflow, Globe2, Server,
  MessageSquareHeart, Building2, Leaf, ShieldCheck, Landmark,
  Truck, ArrowLeft, ChevronRight, Search, Package,
  AlertTriangle, Lightbulb, TrendingUp, GitBranch, BookOpen,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";

/* ── Tipos ────────────────────────────────────────────────────────────────── */
interface Impacto { metrica: string; descripcion: string }
interface CapaArquitectura { capa: string; componentes: string[] }

interface Producto {
  id:        string;
  nombre:    string;
  headline:  string;
  categoria: string;
  icon:      typeof Package;
  color:     string;
  rgb:       string;
  tagColor:  string;
  /* tabs */
  problemaCliente:  string[];
  propuestaValor:   string;
  caracteristicas:  string[];
  impacto:          Impacto[];
  arquitectura:     CapaArquitectura[];
  casos:            string[];
}

type TabId = "problema" | "propuesta" | "impacto" | "arquitectura" | "casos";
const TABS: { id: TabId; label: string; icon: typeof Package }[] = [
  { id: "problema",     label: "Problema del Cliente",    icon: AlertTriangle      },
  { id: "propuesta",    label: "Propuesta de Valor",      icon: Lightbulb          },
  { id: "impacto",      label: "Impacto Logrado",         icon: TrendingUp         },
  { id: "arquitectura", label: "Arquitectura de Referencia", icon: GitBranch       },
  { id: "casos",        label: "Casos de Uso",            icon: BookOpen           },
];

/* ── Catálogo ─────────────────────────────────────────────────────────────── */
const PRODUCTOS: Producto[] = [
  {
    id: "alertas-tempranas", nombre: "Alertas Tempranas",
    headline: "De datos existentes a las alertas tempranas que cambian decisiones",
    categoria: "Datos & Analytics", icon: BellRing,
    color: "#7C3AED", rgb: "124,58,237",
    tagColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    problemaCliente: [
      "Las organizaciones acumulan datos en múltiples sistemas pero no los usan para anticipar eventos críticos.",
      "Los equipos se enteran de los problemas cuando ya ocurrieron, no antes.",
      "No existe visibilidad unificada de indicadores clave que permita actuar de forma proactiva.",
      "Los reportes son históricos y periódicos, no en tiempo real.",
    ],
    propuestaValor: "Convertimos los datos que ya tienes en un sistema de alertas proactivo. Sin infraestructura nueva: conectamos tus fuentes actuales, aplicamos modelos estadísticos y te entregamos señales accionables antes de que el problema escale.",
    caracteristicas: [
      "Conexión a fuentes existentes (ERP, CRM, bases de datos)",
      "Modelos de detección de anomalías en tiempo real",
      "Dashboard de alertas con niveles de criticidad",
      "Notificaciones por correo, WhatsApp o Slack",
      "Backtesting sobre datos históricos",
    ],
    impacto: [
      { metrica: "−60% tiempo de respuesta", descripcion: "Reducción en el tiempo promedio de reacción ante eventos críticos" },
      { metrica: "+40% alertas preventivas", descripcion: "Aumento de alertas detectadas antes del impacto operacional" },
      { metrica: "−30% pérdidas evitables", descripcion: "Reducción de pérdidas asociadas a decisiones tardías" },
    ],
    arquitectura: [
      { capa: "Fuentes de Datos", componentes: ["ERP / CRM", "Bases de datos relacionales", "APIs externas", "Archivos planos / Excel"] },
      { capa: "Ingesta & Procesamiento", componentes: ["Conectores de datos (Airbyte / custom)", "Pipeline de transformación (dbt / SQL)", "Motor de reglas y umbrales"] },
      { capa: "Modelos de Detección", componentes: ["Detección de anomalías estadísticas", "Series de tiempo (Prophet / ARIMA)", "Clasificación de severidad"] },
      { capa: "Capa de Alertas", componentes: ["Motor de notificaciones", "Dashboard en tiempo real", "Integración WhatsApp / Slack / Email"] },
    ],
    casos: [
      "Detección temprana de caída en ventas por territorio o canal",
      "Alertas de incumplimiento de SLA en operaciones de campo",
      "Monitoreo de KPIs críticos de negocio con umbrales configurables",
      "Detección de fraude o comportamiento atípico en transacciones",
    ],
  },
  {
    id: "analitica-operacional", nombre: "Analítica Operacional",
    headline: "Captura de Datos y Analítica para Visibilidad Operacional en Tiempo Real",
    categoria: "Datos & Analytics", icon: Activity,
    color: "#06B6D4", rgb: "6,182,212",
    tagColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    problemaCliente: [
      "La operación sucede en campo pero la información llega con horas o días de retraso.",
      "No existe visibilidad unificada del estado de activos, personal y procesos en tiempo real.",
      "Las decisiones operacionales se basan en intuición o datos desactualizados.",
      "Los sistemas legacy no comunican entre sí ni generan datos accionables.",
    ],
    propuestaValor: "Instalamos sensores, integramos dispositivos y construimos pipelines de datos que transforman tu operación en un gemelo digital observable. Visualiza cada proceso en tiempo real y toma decisiones basadas en hechos, no en suposiciones.",
    caracteristicas: [
      "Captura de datos IoT y sensores industriales",
      "Pipelines de streaming con baja latencia",
      "Dashboards operacionales en tiempo real",
      "Integración con SCADA, PLCs y sistemas legados",
      "Alertas operacionales configurables",
    ],
    impacto: [
      { metrica: "+35% eficiencia operacional", descripcion: "Mejora en la utilización de activos y recursos gracias a visibilidad en tiempo real" },
      { metrica: "−45% tiempo de inactividad", descripcion: "Reducción de downtime no planificado por detección anticipada de fallas" },
      { metrica: "<2 min latencia de datos", descripcion: "Datos operacionales disponibles en menos de 2 minutos desde el evento" },
    ],
    arquitectura: [
      { capa: "Edge / Campo", componentes: ["Sensores IoT", "PLCs y SCADA", "Dispositivos móviles", "Cámaras y visión artificial"] },
      { capa: "Ingesta en Streaming", componentes: ["MQTT Broker", "Apache Kafka", "Edge computing gateway"] },
      { capa: "Procesamiento & Almacenamiento", componentes: ["Stream processing (Flink / Spark)", "Data lake en tiempo real", "Time series DB (InfluxDB / TimescaleDB)"] },
      { capa: "Visualización", componentes: ["Dashboard operacional (Grafana / Power BI)", "Alertas en tiempo real", "API para sistemas externos"] },
    ],
    casos: [
      "Visibilidad de flota y logística de última milla en tiempo real",
      "Monitoreo de líneas de producción en plantas industriales",
      "Control de inventarios y activos en tiempo real por ubicación",
      "Seguimiento de personal de campo y cumplimiento de rutas",
    ],
  },
  {
    id: "digitalizacion-documental", nombre: "Digitalización Documental",
    headline: "Digitalización de documentos y analítica para toma de decisiones confiables",
    categoria: "Digitalización", icon: FileSearch,
    color: "#F59E0B", rgb: "245,158,11",
    tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    problemaCliente: [
      "El conocimiento institucional está atrapado en papel, PDFs sin estructura o archivos dispersos.",
      "La búsqueda de información tarda horas y depende de personas específicas.",
      "Los procesos de aprobación, auditoría y cumplimiento son lentos por falta de trazabilidad documental.",
      "La pérdida o deterioro de documentos físicos representa un riesgo operacional y legal.",
    ],
    propuestaValor: "Digitalizamos, clasificamos y extraemos información de cualquier tipo de documento mediante OCR avanzado e IA. El resultado: una base de conocimiento estructurada que alimenta reportes, búsquedas y modelos de decisión.",
    caracteristicas: [
      "OCR de alta precisión sobre documentos físicos y PDF",
      "Clasificación automática por tipo de documento",
      "Extracción de campos clave con IA generativa",
      "Motor de búsqueda semántica sobre el archivo digitalizado",
      "API de consulta para sistemas externos",
    ],
    impacto: [
      { metrica: "−80% tiempo de búsqueda", descripcion: "Reducción en el tiempo para localizar documentos específicos" },
      { metrica: ">95% precisión OCR", descripcion: "Tasa de extracción correcta de texto en documentos de alta calidad" },
      { metrica: "0 documentos perdidos", descripcion: "Eliminación del riesgo de pérdida o deterioro de información crítica" },
    ],
    arquitectura: [
      { capa: "Captura", componentes: ["Escáneres de alta velocidad", "Carga de archivos PDF/imagen", "Integración con correo y sistemas DMS"] },
      { capa: "Procesamiento Documental", componentes: ["Motor OCR (Tesseract / Azure Vision)", "Clasificador de documentos con ML", "Extractor de entidades con LLM"] },
      { capa: "Almacenamiento & Búsqueda", componentes: ["Repositorio estructurado en la nube", "Índice de búsqueda vectorial", "Metadatos y versionado"] },
      { capa: "Consumo", componentes: ["Portal web de consulta", "API REST para integraciones", "Exportación a Excel / BI"] },
    ],
    casos: [
      "Digitalización de contratos, expedientes legales y actas",
      "Gestión documental de RRHH: hojas de vida, certificados, contratos",
      "Archivo histórico de facturas, órdenes de compra y comprobantes",
      "Transformación de formularios físicos en datos estructurados",
    ],
  },
  {
    id: "automatizacion-negocio", nombre: "Automatización de Negocio",
    headline: "Sistema que conecta y automatiza la operación del negocio de punta a punta",
    categoria: "Automatización", icon: Workflow,
    color: "#10B981", rgb: "16,185,129",
    tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    problemaCliente: [
      "Los procesos dependen de tareas manuales repetitivas que generan errores y retrasos.",
      "Los sistemas de la empresa no se comunican entre sí, creando silos de información.",
      "Los ciclos de aprobación son lentos y no tienen visibilidad de su estado.",
      "La escala operacional no es posible sin contratar más personal para tareas administrativas.",
    ],
    propuestaValor: "Diseñamos e implementamos flujos de trabajo automatizados que eliminan tareas manuales, reducen errores y aceleran los ciclos de negocio. Integramos todos tus sistemas y creamos una cadena de valor digital coherente.",
    caracteristicas: [
      "Mapeo y rediseño de procesos (BPM)",
      "Integraciones vía API, webhooks y conectores nativos",
      "RPA para tareas repetitivas en sistemas legados",
      "Orquestación de procesos multi-sistema",
      "Monitoreo y trazabilidad de cada transacción",
    ],
    impacto: [
      { metrica: "−70% tareas manuales", descripcion: "Reducción de intervención humana en procesos rutinarios" },
      { metrica: "−50% tiempo de ciclo", descripcion: "Aceleración de flujos de aprobación y operación" },
      { metrica: "<0.5% tasa de error", descripcion: "Reducción de errores en procesos automatizados vs. manuales" },
    ],
    arquitectura: [
      { capa: "Sistemas Fuente", componentes: ["ERP (SAP, Oracle, Siesa)", "CRM (Odoo, Salesforce)", "Aplicaciones internas", "Formularios web"] },
      { capa: "Capa de Integración", componentes: ["API Gateway", "Message broker (RabbitMQ / Kafka)", "Conectores iPaaS"] },
      { capa: "Motor de Procesos", componentes: ["BPM Engine (Camunda / Flowable)", "RPA bots (UiPath / n8n)", "Motor de reglas de negocio"] },
      { capa: "Monitoreo", componentes: ["Dashboard de procesos en curso", "Alertas de SLA vencido", "Trazabilidad end-to-end"] },
    ],
    casos: [
      "Automatización del ciclo completo de compras y aprobaciones",
      "Onboarding digital de clientes sin papel ni intervención manual",
      "Sincronización automática entre CRM, ERP y sistema de facturación",
      "Gestión automatizada de nómina y liquidaciones de RRHH",
    ],
  },
  {
    id: "inteligencia-social", nombre: "Inteligencia Social",
    headline: "Inteligencia social en tiempo real: Monitoreo del entorno digital y anticipación de crisis reputacionales",
    categoria: "IA & Analytics", icon: Globe2,
    color: "#EC4899", rgb: "236,72,153",
    tagColor: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    problemaCliente: [
      "Las organizaciones no saben qué se dice de ellas en redes sociales hasta que la crisis ya es viral.",
      "El monitoreo manual de medios digitales es costoso, lento e incompleto.",
      "No existe contexto ni análisis de sentimiento: se ve el volumen pero no el tono ni la intención.",
      "Las áreas de comunicaciones reaccionan tarde porque no tienen alertas en tiempo real.",
    ],
    propuestaValor: "Monitoreamos redes sociales, medios digitales y foros en tiempo real para detectar conversaciones sobre tu marca, competencia y sector. Modelos de NLP en español identifican sentimiento, tendencias y señales de crisis antes de que se viralicen.",
    caracteristicas: [
      "Monitoreo 24/7 de redes sociales y medios digitales",
      "Análisis de sentimiento en español con modelos de NLP",
      "Detección de crisis reputacionales emergentes",
      "Alertas inmediatas a equipos de comunicaciones",
      "Reportes ejecutivos de percepción de marca",
    ],
    impacto: [
      { metrica: "+8h anticipación", descripcion: "Ventana promedio de anticipación antes de que una crisis se viralice" },
      { metrica: "−65% tiempo de respuesta", descripcion: "Reducción en el tiempo de activación de protocolo de crisis" },
      { metrica: "50+ fuentes monitoreadas", descripcion: "Cobertura simultánea de redes, medios y foros digitales" },
    ],
    arquitectura: [
      { capa: "Captura de Señales", componentes: ["APIs de redes sociales (X, Facebook, Instagram)", "Scrapers de medios digitales y noticias", "Foros y plataformas de opinión"] },
      { capa: "Procesamiento NLP", componentes: ["Modelo de sentimiento en español", "Detección de entidades (personas, marcas)", "Clasificación de temas y crisis"] },
      { capa: "Análisis & Tendencias", componentes: ["Detección de tendencias emergentes", "Score de riesgo reputacional", "Comparativa con competencia"] },
      { capa: "Alertas & Reportes", componentes: ["Alertas en tiempo real (email / WhatsApp)", "Dashboard ejecutivo", "Informes de percepción periódicos"] },
    ],
    casos: [
      "Gestión proactiva de reputación corporativa ante noticias negativas",
      "Seguimiento del impacto de campañas de comunicación en redes",
      "Monitoreo de competidores e industria para inteligencia de mercado",
      "Detección de desinformación o noticias falsas sobre la organización",
    ],
  },
  {
    id: "outsourcing-ti", nombre: "Outsourcing TI",
    headline: "Outsourcing integral de la operación de TI",
    categoria: "TI Gestionada", icon: Server,
    color: "#6366F1", rgb: "99,102,241",
    tagColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    problemaCliente: [
      "Mantener un equipo de TI interno es costoso y difícil de escalar según la demanda.",
      "La gestión de infraestructura distrae al negocio de sus prioridades estratégicas.",
      "Las interrupciones del servicio de TI tienen alto impacto en la operación pero no hay soporte 24/7.",
      "La seguridad informática es compleja y requiere expertise especializado difícil de conseguir internamente.",
    ],
    propuestaValor: "Asumimos la operación completa de tu infraestructura tecnológica: servidores, redes, seguridad, soporte a usuarios y continuidad de negocio. Tú te enfocas en crecer; nosotros garantizamos que la tecnología no sea un obstáculo.",
    caracteristicas: [
      "Mesa de servicio 24/7 con SLAs definidos",
      "Administración de infraestructura on-premise y cloud",
      "Gestión de seguridad perimetral y endpoints",
      "Backup, recuperación ante desastres y continuidad",
      "Reportes mensuales de disponibilidad y gestión",
    ],
    impacto: [
      { metrica: "99.9% disponibilidad", descripcion: "SLA de disponibilidad garantizado para sistemas críticos" },
      { metrica: "−40% costo TI", descripcion: "Reducción promedio del costo total de operación de TI vs. modelo interno" },
      { metrica: "<4h tiempo de resolución", descripcion: "Tiempo promedio de resolución de incidentes P1 con soporte 24/7" },
    ],
    arquitectura: [
      { capa: "Infraestructura Gestionada", componentes: ["Servidores físicos y virtuales", "Redes LAN/WAN/WiFi", "Cloud (AWS, Azure, GCP)"] },
      { capa: "Seguridad", componentes: ["Firewall y UTM", "EDR / antivirus corporativo", "SIEM y monitoreo de seguridad"] },
      { capa: "Mesa de Servicio", componentes: ["ITSM (ServiceNow / Jira)", "Portal de tickets", "Soporte remoto y en sitio"] },
      { capa: "Continuidad", componentes: ["Backup automatizado", "Plan de recuperación ante desastres (DRP)", "Pruebas periódicas de recuperación"] },
    ],
    casos: [
      "Tercerización completa de TI para empresas medianas sin área tecnológica",
      "Soporte a empresas en crecimiento que necesitan escalar TI sin contratar",
      "Gestión de la transición y operación de sistemas críticos en fusiones",
      "Operación de infraestructura para proyectos de gobierno con altos estándares",
    ],
  },
  {
    id: "atencion-inteligente", nombre: "Atención Inteligente",
    headline: "Sistema con asistencia de IA, automatización y agentes humanos, que convierte la atención ciudadana/cliente en una conversación útil",
    categoria: "IA & CX", icon: MessageSquareHeart,
    color: "#F97316", rgb: "249,115,22",
    tagColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    problemaCliente: [
      "Los centros de atención están saturados con consultas repetitivas que no requieren un agente humano.",
      "Los ciudadanos y clientes esperan respuestas inmediatas pero los horarios de atención son limitados.",
      "La atención es inconsistente: cada agente responde diferente a la misma pregunta.",
      "No hay aprendizaje acumulativo: se cometen los mismos errores sin mecanismo de mejora continua.",
    ],
    propuestaValor: "Combinamos IA conversacional, automatización de flujos y agentes humanos para ofrecer atención omnicanal que realmente resuelve. El sistema aprende de cada interacción y escala de bot a humano sin fricción.",
    caracteristicas: [
      "Chatbot con IA generativa entrenado en tu dominio",
      "Enrutamiento inteligente a agentes especializados",
      "Integración con WhatsApp, web, app y call center",
      "Base de conocimiento autoactualizable",
      "Análisis de satisfacción y resolución en tiempo real",
    ],
    impacto: [
      { metrica: "−60% volumen a agentes", descripcion: "Consultas resueltas automáticamente sin intervención humana" },
      { metrica: "24/7 disponibilidad", descripcion: "Atención continua sin costo adicional por horario extendido" },
      { metrica: "+35% CSAT", descripcion: "Mejora en satisfacción del cliente/ciudadano vs. modelo tradicional" },
    ],
    arquitectura: [
      { capa: "Canales de Entrada", componentes: ["WhatsApp Business API", "Chat web / app móvil", "Correo electrónico", "Call center (voz a texto)"] },
      { capa: "Capa de IA", componentes: ["LLM con RAG sobre base de conocimiento", "Clasificador de intenciones", "Gestión de contexto conversacional"] },
      { capa: "Orquestación", componentes: ["Motor de flujos y automatizaciones", "Enrutamiento a agente humano", "Integración con sistemas de backoffice"] },
      { capa: "Gestión & Mejora", componentes: ["Panel de agentes", "Analítica de conversaciones", "Ciclo de retroalimentación y re-entrenamiento"] },
    ],
    casos: [
      "Centro de atención ciudadana para alcaldías y entidades públicas",
      "Soporte al cliente en empresas de servicios públicos domiciliarios",
      "Mesa de ayuda interna para empleados (RRHH, TI, nómina)",
      "Atención de PQR con trazabilidad y escalamiento automático",
    ],
  },
  {
    id: "arquitectura-ti", nombre: "Arquitectura TI",
    headline: "Arquitectura empresarial de TI que alinea los sistemas de información con la operación real del negocio",
    categoria: "TI Estratégica", icon: Building2,
    color: "#64748B", rgb: "100,116,139",
    tagColor: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    problemaCliente: [
      "Los sistemas de información se compraron sin una visión de conjunto y hoy no se integran entre sí.",
      "La TI reacciona a las necesidades del negocio en lugar de habilitarlas proactivamente.",
      "No existe un mapa claro de qué sistemas existen, qué hacen y qué datos manejan.",
      "Las inversiones tecnológicas se duplican o contradicen por falta de gobierno arquitectónico.",
    ],
    propuestaValor: "Diseñamos la arquitectura tecnológica de tu empresa partiendo de la operación real, no de la teoría. Mapeamos capacidades, identificamos brechas, priorizamos inversiones y construimos la hoja de ruta para una TI que habilita el negocio.",
    caracteristicas: [
      "Diagnóstico de capacidades tecnológicas actuales",
      "Diseño de arquitectura empresarial (TOGAF / ZACHMAN)",
      "Mapa de sistemas y flujos de información",
      "Hoja de ruta de modernización priorizada",
      "Gobierno de TI y marcos de gestión",
    ],
    impacto: [
      { metrica: "−30% TCO tecnológico", descripcion: "Reducción del costo total de propiedad por eliminación de redundancias" },
      { metrica: "100% cobertura de sistemas", descripcion: "Inventario y documentación completa de la arquitectura AS-IS" },
      { metrica: "Hoja de ruta a 3-5 años", descripcion: "Plan de modernización priorizado con análisis costo-beneficio" },
    ],
    arquitectura: [
      { capa: "Vista de Negocio", componentes: ["Capacidades de negocio", "Procesos y flujos de valor", "Estructura organizacional"] },
      { capa: "Vista de Información", componentes: ["Mapa de datos y entidades", "Flujos de información entre sistemas", "Modelo canónico de datos"] },
      { capa: "Vista de Aplicaciones", componentes: ["Inventario de sistemas", "Mapa de integraciones", "Análisis de brechas AS-IS / TO-BE"] },
      { capa: "Vista de Tecnología", componentes: ["Infraestructura física y cloud", "Plataformas y middleware", "Estándares tecnológicos"] },
    ],
    casos: [
      "Planeación tecnológica estratégica a 3-5 años para la junta directiva",
      "Diagnóstico y hoja de ruta en procesos de transformación digital",
      "Racionalización del portafolio de sistemas antes de una fusión o adquisición",
      "Definición de estándares tecnológicos para grupo empresarial multi-filial",
    ],
  },
  {
    id: "gestion-ambiental", nombre: "Gestión Ambiental",
    headline: "Sistema de recolección y análisis de datos que convierten la gestión de recursos ambientales en soporte para la toma de decisiones",
    categoria: "Datos & Medio Ambiente", icon: Leaf,
    color: "#22C55E", rgb: "34,197,94",
    tagColor: "bg-green-500/10 text-green-400 border-green-500/20",
    problemaCliente: [
      "Los datos ambientales están dispersos en estaciones de monitoreo sin integración central.",
      "Los reportes para autoridades ambientales se elaboran manualmente con alto riesgo de error.",
      "No existe capacidad predictiva para anticipar eventos ambientales críticos (crecidas, contaminación).",
      "Las empresas no tienen visibilidad en tiempo real de su cumplimiento de indicadores ambientales.",
    ],
    propuestaValor: "Plataforma especializada para entidades ambientales y empresas reguladas. Recopilamos datos de campo, estaciones de monitoreo y sensores remotos, y los convertimos en tableros de decisión y alertas para autoridades y operadores.",
    caracteristicas: [
      "Integración con estaciones hidrometeorológicas y sensores remotos",
      "Mapas geoespaciales con capas de datos ambientales",
      "Modelos predictivos de calidad del agua / aire / suelo",
      "Reportes regulatorios automatizados",
      "Alertas por umbrales de cumplimiento ambiental",
    ],
    impacto: [
      { metrica: "−80% tiempo de reporte", descripcion: "Automatización de informes regulatorios que antes se hacían manualmente" },
      { metrica: "+6h anticipación de eventos", descripcion: "Ventana de anticipación promedio para eventos críticos como crecidas" },
      { metrica: "100% trazabilidad", descripcion: "Registro inmutable de mediciones para auditoría y cumplimiento normativo" },
    ],
    arquitectura: [
      { capa: "Sensores & Campo", componentes: ["Estaciones hidrometeorológicas", "Sensores de calidad de agua/aire", "Imágenes satelitales y drones"] },
      { capa: "Ingesta & Procesamiento", componentes: ["Protocolos IoT (MQTT, LoRa)", "ETL de datos de campo", "Validación y curación de datos"] },
      { capa: "Análisis & Modelos", componentes: ["Modelos hidrológicos", "Predicción de calidad ambiental", "Análisis geoespacial (GIS)"] },
      { capa: "Reportes & Alertas", componentes: ["Dashboard ambiental en tiempo real", "Generador de informes regulatorios", "Alertas tempranas a autoridades"] },
    ],
    casos: [
      "Monitoreo de cuencas hídricas y alertas de crecidas para autoridades ambientales",
      "Control de emisiones y vertimientos en empresas industriales reguladas",
      "Gestión de permisos ambientales y concesiones de agua",
      "Reporte automático de indicadores ambientales ante autoridades reguladoras",
    ],
  },
  {
    id: "tramites-seguros", nombre: "Trámites Seguros",
    headline: "Plataforma que centraliza la información y conecta en tiempo real millones de trámites con confiabilidad y sin posibilidad de fraudes",
    categoria: "Gobierno Digital", icon: ShieldCheck,
    color: "#3B82F6", rgb: "59,130,246",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    problemaCliente: [
      "Los trámites involucran múltiples entidades con sistemas desconectados, generando duplicación y fraude.",
      "No existe trazabilidad de las transacciones: es imposible auditar quién hizo qué y cuándo.",
      "La verificación de identidad y autenticidad de documentos es manual y vulnerable.",
      "Los ciudadanos y empresas no confían en los sistemas digitales por experiencias previas de fraude.",
    ],
    propuestaValor: "Construimos el núcleo digital de confianza para gobiernos y empresas que gestionan grandes volúmenes de trámites. Identidad digital, firma electrónica, trazabilidad inmutable y validaciones en tiempo real garantizan que cada transacción sea auténtica.",
    caracteristicas: [
      "Autenticación multifactor y biométrica",
      "Firma electrónica certificada",
      "Registro inmutable de transacciones (auditoría)",
      "Validación en tiempo real contra fuentes oficiales",
      "Escalabilidad para millones de transacciones diarias",
    ],
    impacto: [
      { metrica: "−90% fraude documental", descripcion: "Reducción en casos de fraude detectados tras implementación" },
      { metrica: "99.99% disponibilidad", descripcion: "SLA de disponibilidad para plataformas de trámites críticos" },
      { metrica: "Millones de transacciones/día", descripcion: "Capacidad de procesamiento validada en entornos de alta demanda" },
    ],
    arquitectura: [
      { capa: "Identidad Digital", componentes: ["Autenticación biométrica", "Verificación de cédula / pasaporte", "Firma electrónica cualificada"] },
      { capa: "Capa de Trámites", componentes: ["Motor de flujos de trámite", "Integraciones con registros oficiales", "Gestión de documentos firmados"] },
      { capa: "Registro de Confianza", componentes: ["Log inmutable de transacciones", "Hashing y sellado de tiempo", "Auditoría en tiempo real"] },
      { capa: "Plataforma", componentes: ["API Gateway con rate limiting", "Alta disponibilidad multi-región", "Cifrado en tránsito y reposo"] },
    ],
    casos: [
      "Plataforma central de trámites para entidades del orden nacional",
      "Sistema de gestión de contratos con firma electrónica sin riesgo de fraude",
      "Validación de identidad masiva en procesos electorales o subsidios",
      "Interoperabilidad entre registros públicos para trazabilidad de propiedades",
    ],
  },
  {
    id: "ciudad-digital", nombre: "Ciudad Digital",
    headline: "Digitalización de los trámites y servicios de una ciudad/empresa",
    categoria: "Gobierno Digital", icon: Landmark,
    color: "#0EA5E9", rgb: "14,165,233",
    tagColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    problemaCliente: [
      "Los ciudadanos deben ir físicamente a las oficinas para trámites que podrían hacerse en línea.",
      "Los funcionarios trabajan con formularios físicos que se pierden, se dañan o se duplican.",
      "No hay visibilidad del estado de una solicitud ni para el ciudadano ni para la entidad.",
      "La atención presencial tiene capacidad limitada y genera largas filas y mala experiencia.",
    ],
    propuestaValor: "Llevamos todos los trámites y servicios de una ciudad o empresa al mundo digital: ventanilla única, pagos en línea, turnos virtuales, notificaciones automáticas y seguimiento de solicitudes en tiempo real para ciudadanos y funcionarios.",
    caracteristicas: [
      "Ventanilla única digital multicanal",
      "Integración con pasarelas de pago locales",
      "Gestión de turnos y citas en línea",
      "Notificaciones automáticas al ciudadano/cliente",
      "Dashboard de gestión para funcionarios y supervisores",
    ],
    impacto: [
      { metrica: "−70% atención presencial", descripcion: "Reducción de visitas físicas gracias a trámites 100% digitales" },
      { metrica: "+80% satisfacción ciudadana", descripcion: "Mejora en percepción del servicio tras digitalización" },
      { metrica: "24/7 disponibilidad", descripcion: "Acceso a servicios fuera del horario de atención tradicional" },
    ],
    arquitectura: [
      { capa: "Canales Ciudadano", componentes: ["Portal web responsive", "App móvil iOS / Android", "WhatsApp y canales digitales"] },
      { capa: "Ventanilla Única", componentes: ["Catálogo de trámites y servicios", "Motor de formularios dinámicos", "Gestión de solicitudes y estados"] },
      { capa: "Backoffice", componentes: ["Panel de funcionarios", "Flujos de aprobación y asignación", "Integración con sistemas legados"] },
      { capa: "Transaccional", componentes: ["Pasarela de pagos (PSE, tarjetas)", "Generación de recibos y certificados", "Firma digital de documentos"] },
    ],
    casos: [
      "Digitalización de trámites de alcaldías municipales (licencias, permisos)",
      "Modernización de servicios en empresas de servicios públicos domiciliarios",
      "Portal ciudadano único para grupos empresariales multi-filial",
      "Transformación de PQRS físico a canal digital con trazabilidad completa",
    ],
  },
  {
    id: "portal-proveedores", nombre: "Portal Proveedores",
    headline: "Portal de gestión de proveedores",
    categoria: "Operaciones", icon: Truck,
    color: "#A855F7", rgb: "168,85,247",
    tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    problemaCliente: [
      "La gestión de proveedores está dispersa en correos, hojas de cálculo y procesos manuales.",
      "El proceso de homologación y aprobación de nuevos proveedores es lento y sin trazabilidad.",
      "Los documentos de proveedores vencen sin que nadie lo note, generando riesgos legales.",
      "No existe visibilidad del desempeño de proveedores para tomar decisiones de compra objetivas.",
    ],
    propuestaValor: "Centralizamos toda la relación con tu cadena de proveedores en un portal colaborativo: onboarding digital, gestión documental, evaluación de desempeño, órdenes de compra y pagos. Visibilidad total del supply chain desde un solo lugar.",
    caracteristicas: [
      "Onboarding digital y homologación de proveedores",
      "Gestión de documentos y vencimientos",
      "Módulo de órdenes de compra y entregas",
      "Evaluación periódica de desempeño",
      "Integración con ERP y sistemas de pago",
    ],
    impacto: [
      { metrica: "−60% tiempo de homologación", descripcion: "Reducción en el tiempo de aprobación de nuevos proveedores" },
      { metrica: "0 documentos vencidos no detectados", descripcion: "Alertas automáticas antes del vencimiento de documentos críticos" },
      { metrica: "+45% visibilidad supply chain", descripcion: "Mejora en la capacidad de monitorear el desempeño de la cadena de suministro" },
    ],
    arquitectura: [
      { capa: "Portal del Proveedor", componentes: ["Registro y onboarding digital", "Carga de documentos y certificaciones", "Consulta de órdenes y pagos"] },
      { capa: "Gestión Documental", componentes: ["Repositorio de documentos con vencimientos", "Alertas de renovación automáticas", "Validación de documentos con IA"] },
      { capa: "Compras & Pedidos", componentes: ["Módulo de órdenes de compra", "Confirmación de entregas", "Facturación electrónica"] },
      { capa: "Analítica", componentes: ["Scorecard de desempeño de proveedores", "Integración con ERP (SAP, Oracle)", "Reportes de cumplimiento y auditoría"] },
    ],
    casos: [
      "Centralización del supply chain para grupos empresariales industriales",
      "Gestión de contratistas y terceros en proyectos de construcción",
      "Cumplimiento normativo en compras públicas y contratación estatal",
      "Homologación masiva de proveedores en procesos de transformación corporativa",
    ],
  },
];

const CATEGORIAS = ["Todas", ...Array.from(new Set(PRODUCTOS.map((p) => p.categoria)))];

/* ── Card del catálogo ────────────────────────────────────────────────────── */
function ProductCard({ producto, onClick }: { producto: Producto; onClick: () => void }) {
  const Icon = producto.icon;
  return (
    <button type="button" onClick={onClick}
      className="group text-left rounded-2xl border border-white/[0.06] bg-[#0D0D1A] p-5 hover:border-white/[0.14] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `rgba(${producto.rgb},0.12)`, border: `1px solid rgba(${producto.rgb},0.25)` }}>
          <Icon size={18} style={{ color: producto.color }} />
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${producto.tagColor} shrink-0 mt-0.5`}>
          {producto.categoria}
        </span>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold leading-tight mb-2" style={{ color: producto.color }}>{producto.nombre}</h3>
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">{producto.headline}</p>
      </div>
      <div className="flex items-center gap-1 text-[11px] font-medium transition-colors" style={{ color: `rgba(${producto.rgb},0.7)` }}>
        Ver detalle <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}

/* ── Micrositio ───────────────────────────────────────────────────────────── */
function ProductoDetalle({ producto, onBack }: { producto: Producto; onBack: () => void }) {
  const Icon = producto.icon;
  const [tab, setTab] = useState<TabId>("problema");
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar />

      {/* Hero */}
      <div className="relative px-6 md:px-10 pt-7 pb-7 border-b border-white/[0.05]"
        style={{ background: `radial-gradient(ellipse 70% 120% at 15% -10%, rgba(${producto.rgb},0.13) 0%, transparent 65%)` }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-5">
          <ArrowLeft size={14} /> Volver al catálogo
        </button>
        <div className="flex items-start gap-5 max-w-4xl">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `rgba(${producto.rgb},0.12)`, border: `1px solid rgba(${producto.rgb},0.3)` }}>
            <Icon size={22} style={{ color: producto.color }} />
          </div>
          <div>
            <span className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mb-1.5 ${producto.tagColor}`}>
              {producto.categoria}
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-tight mb-1.5">{producto.nombre}</h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">{producto.headline}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] px-6 md:px-10 overflow-x-auto no-scrollbar">
        <div className="flex gap-0 min-w-max">
          {TABS.map((t) => {
            const TabIcon = t.icon;
            const active = tab === t.id;
            return (
              <button type="button" key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? "border-current text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
                style={active ? { color: producto.color, borderColor: producto.color } : {}}>
                <TabIcon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del tab */}
      <div className="flex-1 px-6 md:px-10 py-7 max-w-5xl">

        {/* Tab: Problema del Cliente */}
        {tab === "problema" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white mb-1">¿Cuál es el problema que resuelve?</h2>
              <p className="text-xs text-slate-500">Contexto del dolor que experimenta el cliente antes de nuestra solución</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {producto.problemaCliente.map((p, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-rose-500/10 bg-rose-500/[0.03] p-4">
                  <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300 leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Propuesta de Valor */}
        {tab === "propuesta" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Propuesta de Valor</h2>
              <p className="text-xs text-slate-500">Qué hacemos, cómo lo hacemos y por qué importa</p>
            </div>
            <div className="rounded-2xl border p-6" style={{ borderColor: `rgba(${producto.rgb},0.2)`, background: `rgba(${producto.rgb},0.04)` }}>
              <p className="text-sm text-slate-200 leading-relaxed">{producto.propuestaValor}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Capacidades clave</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {producto.caracteristicas.map((c, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: producto.color }} />
                    <p className="text-xs text-slate-300 leading-relaxed">{c}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Impacto Logrado */}
        {tab === "impacto" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Impacto Logrado</h2>
              <p className="text-xs text-slate-500">Resultados cuantificables obtenidos con clientes reales</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {producto.impacto.map((imp, i) => (
                <div key={i} className="rounded-2xl border p-6 text-center space-y-2"
                  style={{ borderColor: `rgba(${producto.rgb},0.2)`, background: `rgba(${producto.rgb},0.04)` }}>
                  <p className="text-xl font-bold" style={{ color: producto.color }}>{imp.metrica}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{imp.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Arquitectura de Referencia */}
        {tab === "arquitectura" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Arquitectura de Referencia</h2>
              <p className="text-xs text-slate-500">Capas técnicas que componen la solución</p>
            </div>
            <div className="space-y-3">
              {producto.arquitectura.map((capa, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/[0.04]"
                    style={{ background: `rgba(${producto.rgb},0.07)` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white/60 font-mono">CAPA {String(i + 1).padStart(2, "0")}</span>
                      <span className="text-xs font-semibold" style={{ color: producto.color }}>{capa.capa}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4 py-3">
                    {capa.componentes.map((comp, j) => (
                      <span key={j} className="text-[11px] px-3 py-1 rounded-full border border-white/[0.07] bg-white/[0.03] text-slate-400">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Casos de Uso */}
        {tab === "casos" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Casos de Uso</h2>
              <p className="text-xs text-slate-500">Escenarios de aplicación real de esta solución</p>
            </div>
            <div className="space-y-3">
              {producto.casos.map((caso, i) => (
                <div key={i} className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                    style={{ background: `rgba(${producto.rgb},0.12)`, color: producto.color }}>
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{caso}</p>
                </div>
              ))}
            </div>

          </div>
        )}
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
      <div className="px-6 md:px-8 py-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-white shrink-0">Catálogo de Productos</h1>
          <div className="relative w-56 shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/[0.07] bg-white/[0.03] text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-white/[0.15] transition-colors" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORIAS.map((cat) => (
            <button key={cat} onClick={() => setCategoriaFiltro(cat)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                categoriaFiltro === cat
                  ? "bg-white/[0.12] border-white/[0.25] text-white"
                  : "border-white/[0.06] text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"
              }`}>
              {cat}
            </button>
          ))}
          {busqueda && (
            <span className="shrink-0 ml-2 text-[11px] text-slate-600">
              {filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""} · &quot;{busqueda}&quot;
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
          {filtrados.map((producto) => (
            <ProductCard key={producto.id} producto={producto} onClick={() => setProductoActivo(producto)} />
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
