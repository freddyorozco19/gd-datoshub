"use client"

import { useState, useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Search, ChevronDown, ChevronUp, BookOpen, CheckCircle, XCircle,
  ImageIcon, Filter, RefreshCw, ChevronRight, ChevronLeft, ArrowLeft, Lock,
  Eye, EyeOff, RotateCcw, ExternalLink,
  Play, Clock, Trophy, X, GraduationCap, AlertTriangle,
  ListChecks, Pencil, Loader2, LayoutGrid, Bookmark,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar'
import { track } from '@/lib/track'

// ─── Config de proveedores y exámenes ────────────────────────────────────────

interface ExamConfig {
  id: string
  code: string
  name: string
  dataFile?: string       // ruta en /public/data/ — undefined = próximamente
  questions?: number      // estimado para mostrar en la card
  level: 'Fundamental' | 'Associate' | 'Expert' | 'Professional' | 'Specialty'
  examTopicsPath?: string   // ej: 'cdmp/dmf' | 'microsoft/az-900'
}

interface ProviderConfig {
  id: string
  name: string
  color: string           // color del acento
  bgGradient: string      // gradiente de la card
  logo: string            // emoji o texto corto (fallback)
  logoImg?: string        // URL de logo de imagen (opcional, tiene prioridad)
  alias?: string          // ej: "Azure" para Microsoft
  exams: ExamConfig[]
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'microsoft',
    name: 'Microsoft',
    color: '#0078d4',
    bgGradient: 'from-blue-950 to-slate-900',
    logo: '⊞',
    logoImg: '/microsoftEA.webp',
    alias: 'Azure',
    exams: [
      { id: 'ai-100', code: 'AI-100', name: 'Designing/Implementing Azure AI Solution', level: 'Associate'   },
      { id: 'ai-102', code: 'AI-102', name: 'Azure AI Engineer',                        level: 'Associate'   },
      { id: 'ab-730', code: 'AB-730', name: 'AI Business Professional',                  dataFile: '/data/exam_ab730.json', questions: 92, level: 'Fundamental' },
      { id: 'ab-900', code: 'AB-900', name: 'M365 Copilot & Agent Admin Fundamentals',  dataFile: '/data/exam_ab900.json', questions: 88, level: 'Fundamental' },
      { id: 'ai-900', code: 'AI-900', name: 'Azure AI Fundamentals',                    level: 'Fundamental' },
      { id: 'ai-901', code: 'AI-901', name: 'Microsoft Azure AI',                       dataFile: '/data/exam_ai901.json', questions: 50, level: 'Fundamental' },
      { id: 'az-100', code: 'AZ-100', name: 'Azure Infrastructure and Deployment',      level: 'Associate'   },
      { id: 'az-103', code: 'AZ-103', name: 'Azure Administrator',                      level: 'Associate'   },
      { id: 'az-104', code: 'AZ-104', name: 'Azure Administrator',                      dataFile: '/data/exam_az104.json', questions: 606, level: 'Associate'   },
      { id: 'az-120', code: 'AZ-120', name: 'Azure for SAP Workloads',                  level: 'Associate'   },
      { id: 'az-140', code: 'AZ-140', name: 'Azure Virtual Desktop',                    level: 'Associate'   },
      { id: 'az-203', code: 'AZ-203', name: 'Developing Solutions for Azure',           level: 'Associate'   },
      { id: 'az-204', code: 'AZ-204', name: 'Azure Developer',                          level: 'Associate'   },
      { id: 'az-220', code: 'AZ-220', name: 'Azure IoT Developer',                      level: 'Associate'   },
      { id: 'az-300', code: 'AZ-300', name: 'Azure Architect Technologies',             level: 'Associate'   },
      { id: 'az-301', code: 'AZ-301', name: 'Azure Architect Design',                   level: 'Associate'   },
      { id: 'az-303', code: 'AZ-303', name: 'Azure Architect Technologies',             level: 'Associate'   },
      { id: 'az-304', code: 'AZ-304', name: 'Azure Architect Design',                   level: 'Associate'   },
      { id: 'az-305', code: 'AZ-305', name: 'Azure Solutions Architect',                level: 'Expert'      },
      { id: 'az-305', code: 'AZ-305', name: 'Designing Azure Infrastructure Solutions',  dataFile: '/data/exam_az305.json', questions: 286, level: 'Expert'      },
      { id: 'az-700', code: 'AZ-700', name: 'Azure Network Engineer Associate',          dataFile: '/data/exam_az700.json', questions: 356, level: 'Associate'   },
      { id: 'az-800', code: 'AZ-800', name: 'Administering Windows Server Hybrid Core', dataFile: '/data/exam_az800.json', questions: 244, level: 'Associate'   },
      { id: 'az-400', code: 'AZ-400', name: 'DevOps Engineer',                          dataFile: '/data/exam_az400.json', questions: 559, level: 'Expert'      },
      { id: 'az-500', code: 'AZ-500', name: 'Azure Security Engineer',                  level: 'Associate'   },
      { id: 'az-600', code: 'AZ-600', name: 'Azure Stack Hub Operator',                 level: 'Associate'   },
      { id: 'az-700', code: 'AZ-700', name: 'Azure Network Engineer',                   level: 'Associate'   },
      { id: 'az-720', code: 'AZ-720', name: 'Troubleshooting Azure Connectivity',       level: 'Associate'   },
      { id: 'az-800', code: 'AZ-800', name: 'Windows Server Hybrid Core Infra.',        level: 'Associate'   },
      { id: 'az-801', code: 'AZ-801', name: 'Windows Server Hybrid Adv. Services',      level: 'Associate'   },
      { id: 'az-900', code: 'AZ-900', name: 'Azure Fundamentals',         dataFile: '/data/exam_63.json', questions: 472, level: 'Fundamental',  examTopicsPath: 'microsoft/az-900' },
      { id: 'dp-300', code: 'DP-300', name: 'Azure Database Administrator', dataFile: '/data/exam_dp300.json', questions: 364, level: 'Associate',   examTopicsPath: 'microsoft/dp-300' },
      { id: 'dp-900', code: 'DP-900', name: 'Azure Data Fundamentals',      dataFile: '/data/exam_74.json', questions: 303, level: 'Fundamental', examTopicsPath: 'microsoft/dp-900' },
      { id: 'dp-600', code: 'DP-600', name: 'Microsoft Fabric Analytics Engineer', dataFile: '/data/exam_dp600.json', questions: 198, level: 'Associate' },
      { id: 'dp-700', code: 'DP-700', name: 'Implementing Data Eng. Using Microsoft Fabric', dataFile: '/data/exam_dp700.json', questions: 118, level: 'Associate' },
      { id: 'pl-300', code: 'PL-300', name: 'Power BI Data Analyst',         dataFile: '/data/exam_pl300.json', questions: 370, level: 'Associate' },
    ],
  },
  {
    id: 'aws',
    name: 'AWS',
    color: '#FF9900',
    bgGradient: 'from-orange-950 to-slate-900',
    logo: '☁',
    logoImg: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Amazon_Web_Services_Logo.svg/960px-Amazon_Web_Services_Logo.svg.png',
    exams: [
      { id: 'aif-c01', code: 'AIF-C01', name: 'AWS Certified AI Practitioner', dataFile: '/data/exam_aifC01.json', questions: 233, level: 'Fundamental' },
      { id: 'clf-c02', code: 'CLF-C02', name: 'Cloud Practitioner',    dataFile: '/data/exam_clf_c02.json', questions: 718, level: 'Fundamental' },
      { id: 'saa-c03', code: 'SAA-C03', name: 'Solutions Architect',      dataFile: '/data/exam_saa_c03.json',  questions: 1019, level: 'Associate'   },
      { id: 'dva-c02', code: 'DVA-C02', name: 'Developer Associate',      dataFile: '/data/exam_dva_c02.json',  questions: 556,  level: 'Associate'   },
      { id: 'dea-c01', code: 'DEA-C01', name: 'Data Engineer Associate',  dataFile: '/data/exam_dea_c01.json',  questions: 366,  level: 'Associate'   },
    ],
  },
  {
    id: 'google',
    name: 'Google Cloud',
    color: '#4285F4',
    bgGradient: 'from-indigo-950 to-slate-900',
    logo: '◈',
    logoImg: 'https://e7.pngegg.com/pngimages/569/340/png-clipart-google-cloud-platform-cloud-computing-cloud-storage-google-storage-cloud-security-text-logo.png',
    exams: [
      { id: 'ace',  code: 'ACE',  name: 'Associate Cloud Engineer', level: 'Associate'   },
      { id: 'pca',  code: 'PCA',  name: 'Professional Cloud Arch.', level: 'Professional'},
    ],
  },
  {
    id: 'isaca',
    name: 'ISACA',
    color: '#8B5CF6',
    bgGradient: 'from-purple-950 to-slate-900',
    logo: '⬡',
    exams: [
      { id: 'cisa', code: 'CISA', name: 'Certified Information Systems Auditor',  level: 'Professional' },
      { id: 'cism', code: 'CISM', name: 'Certified Information Security Manager', level: 'Professional' },
    ],
  },
  {
    id: 'cdmp',
    name: 'CDMP',
    color: '#14B8A6',
    bgGradient: 'from-teal-950 to-slate-900',
    logo: '◭',
    exams: [
      { id: 'dmf', code: 'DMF', name: 'Data Management Fundamentals', dataFile: '/data/exam_dmf.json', questions: 295, level: 'Fundamental', examTopicsPath: 'cdmp/dmf' },
    ],
  },
  {
    id: 'fortinet',
    name: 'Fortinet',
    color: '#EE3124',
    bgGradient: 'from-red-950 to-slate-900',
    logo: '🛡️',
    logoImg: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Fortinet_logo.svg/3840px-Fortinet_logo.svg.png',
    exams: [
      { id: 'fcf',  code: 'FCF',   name: 'Certified Fundamentals in Cybersecurity', level: 'Fundamental'  },
      { id: 'nse4-fgt-ad-7-6', code: 'NSE4_FGT_AD-7.6', name: 'Fortinet NSE 4 - FortiOS 7.6 Administrator', dataFile: '/data/exam_nse4_fgt.json', questions: 84, level: 'Associate' },
      { id: 'nse7', code: 'NSE 7', name: 'Network Security Architect',              level: 'Professional' },
    ],
  },
]

// ─── Types de preguntas ───────────────────────────────────────────────────────

interface QuestionImage {
  path: string
  alt?: string
  inOption?: boolean
  optionLetter?: string | null
  inAnswer?: boolean
}

interface Question {
  number: string
  questionType?: string
  questionText?: string
  translation?: string
  explanation?: string
  options?: string[]
  correctAnswer?: string
  statements?: { text: string; answer: string }[]
  dropdownOptions?: string[]
  learnMore?: Array<string | { text: string; url: string }>
  images?: (string | QuestionImage)[]
}

interface ExamData {
  examId: number
  examTitle: string
  totalQuestions: number
  scrapedAt: string
  questions: Question[]
}

type FilterType = 'all' | 'mc' | 'yn' | 'img' | 'noanswer' | 'withanswer'

// ─── Tag system ───────────────────────────────────────────────────────────────

interface TagDef { label: string; color: string }

const TAG_RULES: (TagDef & { pattern: RegExp })[] = [
  // Identidad y acceso
  { label: 'Azure AD',              color: 'violet', pattern: /azure active directory|azure ad\b|entra id/i },
  { label: 'RBAC',                  color: 'violet', pattern: /\brbac\b|role.based access|role assignment/i },
  { label: 'MFA',                   color: 'violet', pattern: /multi.factor|mfa\b|conditional access/i },
  { label: 'SSO',                   color: 'violet', pattern: /single sign.on|\bsso\b/i },
  // Gobernanza
  { label: 'Azure Policy',          color: 'blue',   pattern: /azure policy/i },
  { label: 'Resource Lock',         color: 'blue',   pattern: /resource lock/i },
  { label: 'Management Groups',     color: 'blue',   pattern: /management group/i },
  { label: 'Blueprints',            color: 'blue',   pattern: /blueprint/i },
  { label: 'Cumplimiento',          color: 'blue',   pattern: /compliance|trust center|regulatory/i },
  // Redes
  { label: 'Virtual Network',       color: 'cyan',   pattern: /virtual network|\bvnet\b/i },
  { label: 'VPN',                   color: 'cyan',   pattern: /\bvpn\b|site.to.site|point.to.site/i },
  { label: 'ExpressRoute',          color: 'cyan',   pattern: /expressroute/i },
  { label: 'Load Balancer',         color: 'cyan',   pattern: /load balancer/i },
  { label: 'App Gateway',           color: 'cyan',   pattern: /application gateway/i },
  { label: 'Firewall / DDoS',       color: 'cyan',   pattern: /\bfirewall\b|\bddos\b/i },
  { label: 'DNS / CDN',             color: 'cyan',   pattern: /\bdns\b|\bcdn\b|traffic manager/i },
  // Cómputo
  { label: 'Máquinas Virtuales',    color: 'orange', pattern: /virtual machine|\bvm\b/i },
  { label: 'App Service',           color: 'orange', pattern: /app service|web app/i },
  { label: 'Azure Functions',       color: 'orange', pattern: /azure functions|serverless/i },
  { label: 'Contenedores / AKS',    color: 'orange', pattern: /container|kubernetes|\baks\b|docker/i },
  { label: 'Virtual Desktop',       color: 'orange', pattern: /virtual desktop/i },
  { label: 'Scale Sets',            color: 'orange', pattern: /scale set/i },
  // Almacenamiento
  { label: 'Blob Storage',          color: 'teal',   pattern: /blob storage|blob service/i },
  { label: 'Azure Files',           color: 'teal',   pattern: /azure files|file share|file service/i },
  { label: 'Data Lake',             color: 'teal',   pattern: /data lake/i },
  { label: 'Storage Account',       color: 'teal',   pattern: /storage account/i },
  { label: 'Redundancia',           color: 'teal',   pattern: /redundanc|\blrs\b|\bgrs\b|\bzrs\b|\bra-grs\b/i },
  // Bases de datos
  { label: 'Cosmos DB',             color: 'indigo', pattern: /cosmos db/i },
  { label: 'Azure SQL',             color: 'indigo', pattern: /sql database|sql server|azure sql/i },
  { label: 'PostgreSQL / MySQL',    color: 'indigo', pattern: /postgresql|mysql|mariadb/i },
  // Seguridad
  { label: 'Defender for Cloud',    color: 'red',    pattern: /security center|defender for cloud|microsoft defender/i },
  { label: 'Key Vault',             color: 'red',    pattern: /key vault/i },
  { label: 'Cifrado',               color: 'red',    pattern: /encrypt|certificate|tls|ssl/i },
  { label: 'Sentinel',              color: 'red',    pattern: /sentinel/i },
  { label: 'Zero Trust',            color: 'red',    pattern: /zero trust|defense.in.depth/i },
  // Monitoreo
  { label: 'Azure Monitor',         color: 'yellow', pattern: /azure monitor|log analytics|application insights/i },
  { label: 'Service Health',        color: 'yellow', pattern: /service health|planned maintenance/i },
  { label: 'Azure Advisor',         color: 'yellow', pattern: /azure advisor/i },
  // Alta disponibilidad
  { label: 'Availability Zones',    color: 'green',  pattern: /availability zone/i },
  { label: 'Availability Sets',     color: 'green',  pattern: /availability set/i },
  { label: 'SLA / Uptime',          color: 'green',  pattern: /\bsla\b|uptime|99\.\d+\s*%/i },
  { label: 'Disaster Recovery',     color: 'green',  pattern: /disaster recovery|site recovery/i },
  // Costos
  { label: 'Precios / Costos',      color: 'amber',  pattern: /pricing|cost management|\btco\b|budget/i },
  { label: 'CapEx / OpEx',          color: 'amber',  pattern: /capex|opex|pay.as.you.go|expenditure/i },
  { label: 'Reservas / Ahorro',     color: 'amber',  pattern: /reserved instance|hybrid benefit/i },
  // Modelos de servicio
  { label: 'IaaS',                  color: 'slate',  pattern: /\biaas\b|infrastructure as a service/i },
  { label: 'PaaS',                  color: 'slate',  pattern: /\bpaas\b|platform as a service/i },
  { label: 'SaaS',                  color: 'slate',  pattern: /\bsaas\b|software as a service/i },
  { label: 'Modelo de nube',        color: 'slate',  pattern: /public cloud|private cloud|hybrid cloud/i },
  { label: 'Resp. Compartida',      color: 'slate',  pattern: /shared responsibility/i },
  // Migración y DevOps
  { label: 'Migración',             color: 'purple', pattern: /azure migrate|\bmigrat/i },
  { label: 'IaC / ARM',             color: 'purple', pattern: /arm template|\bbicep\b|terraform|infrastructure as code/i },
  { label: 'DevOps',                color: 'purple', pattern: /devops|pipeline|\bci\/cd\b/i },
  // IA / ML
  { label: 'IA / ML',               color: 'pink',   pattern: /machine learning|cognitive service|\bai\b|artificial intelligence|bot service/i },
  // Geografía / Regiones
  { label: 'Regiones',              color: 'gray',   pattern: /\bregion\b|geography|geograph/i },
  { label: 'Gov Cloud',             color: 'gray',   pattern: /azure government|sovereign/i },
  { label: 'Marketplace',           color: 'gray',   pattern: /marketplace/i },
]

const TAG_COLOR: Record<string, string> = {
  violet: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
  blue:   'bg-blue-900/40 text-blue-300 border-blue-700/50',
  cyan:   'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  orange: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  teal:   'bg-teal-900/40 text-teal-300 border-teal-700/50',
  indigo: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50',
  red:    'bg-red-900/40 text-red-300 border-red-700/50',
  yellow: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  green:  'bg-green-900/40 text-green-300 border-green-700/50',
  amber:  'bg-amber-900/40 text-amber-300 border-amber-700/50',
  slate:  'bg-slate-800 text-slate-400 border-slate-600',
  purple: 'bg-purple-900/40 text-purple-300 border-purple-700/50',
  pink:   'bg-pink-900/40 text-pink-300 border-pink-700/50',
  gray:   'bg-gray-800/60 text-gray-400 border-gray-600/50',
}

/** Dado "Question 42" o "Pregunta 42" devuelve el número entero */
function parseQuestionNumber(numStr: string): number | null {
  const m = numStr?.match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

/** Calcula la página en examprepper (5 preguntas por página) */
function examPage(questionNumber: number): number {
  return Math.ceil(questionNumber / 5)
}

function getQuestionTags(q: Question): TagDef[] {
  const corpus = [q.number, q.questionText, ...(q.options ?? []), q.correctAnswer]
    .filter(Boolean).join(' ')
  return TAG_RULES.filter(r => r.pattern.test(corpus))
}

function TagChip({
  tag, active, onClick,
}: { tag: TagDef; active?: boolean; onClick?: (label: string) => void }) {
  const base = TAG_COLOR[tag.color] ?? TAG_COLOR.slate
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick?.(tag.label) }}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all duration-100
        ${base}
        ${active ? 'ring-1 ring-offset-1 ring-offset-transparent ring-current opacity-100' : 'opacity-80 hover:opacity-100'}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {active && <span>✕</span>}
      {tag.label}
    </button>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getType(q: Question) {
  if (q.images?.length) return 'img'
  if (q.options?.length === 2 && q.options.some(o => /yes|no|sí/i.test(o))) return 'yn'
  if (q.options?.length) return 'mc'
  return 'other'
}

function isCorrectOpt(opt: string, correctAnswer?: string): boolean {
  if (!correctAnswer || !opt) return false
  const ans = correctAnswer.trim()
  const optLetter = opt.trim().charAt(0).toUpperCase()
  // Respuesta como una o varias letras (A, AD, ABC...): verificar si la letra de la opción está incluida
  if (/^[A-E]+$/i.test(ans)) return ans.toUpperCase().includes(optLetter)
  // Respuesta como texto completo
  return ans.toLowerCase().includes(opt.substring(0, 12).toLowerCase().trim())
}

function chooseNLabel(correctAnswer?: string): string | null {
  if (!correctAnswer) return null
  const count = correctAnswer.trim().length
  if (count === 2) return 'Selecciona dos'
  if (count === 3) return 'Selecciona tres'
  if (count >= 4) return `Selecciona ${count}`
  return null
}

const LEVEL_ORDER: Record<string, number> = {
  Fundamental:  0,
  Associate:    1,
  Professional: 2,
  Expert:       3,
  Specialty:    4,
}

const LEVEL_COLOR: Record<string, string> = {
  Fundamental:  'text-emerald-400 bg-emerald-900/30 border-emerald-800',
  Associate:    'text-blue-400    bg-blue-900/30    border-blue-800',
  Expert:       'text-amber-400   bg-amber-900/30   border-amber-800',
  Professional: 'text-purple-400  bg-purple-900/30  border-purple-800',
  Specialty:    'text-rose-400    bg-rose-900/30    border-rose-800',
}

// ─── Level 1: Provider cards ─────────────────────────────────────────────────

function ProviderCard({ p, onClick }: { p: ProviderConfig; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left overflow-hidden rounded-2xl bg-[#0e0e12] border border-white/[0.08] transition-all duration-200
        hover:border-white/15 hover:shadow-2xl hover:shadow-black/70"
      style={{ aspectRatio: '16/9' }}
    >
      {/* logo grande sangrando en esquina superior izquierda */}
      {p.logoImg ? (
        <img
          src={p.logoImg}
          alt=""
          aria-hidden
          className="absolute -top-3 -left-3 h-[90%] w-auto object-contain pointer-events-none opacity-100"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        <span aria-hidden className="absolute -top-2 -left-2 text-8xl pointer-events-none leading-none opacity-90">
          {p.logo}
        </span>
      )}

      {/* overlay degradado oscuro inferior */}
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
      <span className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent pointer-events-none" />
      {/* sombra diagonal desde mitad inferior hacia cuadro amarillo */}
      <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 35%, transparent 65%)' }} />

      {/* texto superpuesto sobre el logo, en la parte inferior */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
        <h3 className="text-[15px] font-bold text-white leading-tight tracking-tight drop-shadow-lg">{p.name}</h3>
        <p className="text-[12px] text-slate-400 mt-0.5 drop-shadow-lg">{p.exams.length} exams</p>
      </div>
    </button>
  )
}

// ─── Level 2: Exam cards ──────────────────────────────────────────────────────

function ExamCard({ exam, provider, onClick }: { exam: ExamConfig; provider: ProviderConfig; onClick: () => void }) {
  const available = !!exam.dataFile
  return (
    <button
      onClick={available ? onClick : undefined}
      style={{ backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' }}
      className={`relative w-full text-left bg-white/[0.05] border rounded-lg p-3 shadow-lg shadow-black/20 transition-all duration-200 ${
        available
          ? 'border-white/[0.1] hover:border-white/25 hover:bg-white/[0.08] cursor-pointer group'
          : 'border-white/[0.06] opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className="text-[11px] font-mono font-bold" style={{ color: provider.color }}>{exam.code}</span>
        {available
          ? <ChevronRight size={13} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
          : <Lock size={11} className="text-slate-700" />
        }
      </div>
      <h4 className="text-xs font-semibold text-slate-200 mb-1.5 leading-snug line-clamp-2">{exam.name}</h4>
      <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${LEVEL_COLOR[exam.level]}`}>
        {exam.level}
      </span>
      {available && exam.questions && (
        <p className="text-[10px] text-slate-500 mt-1.5">{exam.questions} preguntas</p>
      )}
      {!available && (
        <p className="text-[10px] text-slate-600 italic mt-1.5">Próximamente</p>
      )}
    </button>
  )
}

// ─── Level 3: Question card ───────────────────────────────────────────────────

function TypeBadge({ type }: { type: ReturnType<typeof getType> }) {
  const cfg = {
    mc:    { label: 'Múltiple opción', cls: 'bg-blue-900/50 text-blue-300 border-blue-800' },
    yn:    { label: 'Sí / No',         cls: 'bg-green-900/50 text-green-300 border-green-800' },
    img:   { label: 'Con imagen',      cls: 'bg-purple-900/50 text-purple-300 border-purple-800' },
    other: { label: 'Abierta',         cls: 'bg-slate-800 text-slate-400 border-slate-700' },
  }[type]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
}

function QuestionCard({
  q, qEs, index, activeTag, onTagClick, examId, examTopicsPath,
}: {
  q: Question
  qEs?: Question
  index: number
  activeTag: string | null
  onTagClick: (label: string) => void
  examId: number
  examTopicsPath?: string
}) {
  const [open,        setOpen]        = useState(false)
  const [es,          setEs]          = useState(false)
  const [selected,    setSelected]    = useState<number | null>(null)
  const [verified,    setVerified]    = useState(false)
  const [showAns,     setShowAns]     = useState(false)
  const [mdRowAnswers, setMdRowAnswers] = useState<Record<number, string>>({})
  const [ynRowAnswers, setYnRowAnswers] = useState<Record<number, 'Yes' | 'No'>>({})
  const [showExpl,      setShowExpl]      = useState(false)
  const [explEs,        setExplEs]        = useState(false)
  const [explEsText,    setExplEsText]    = useState<string | null>(null)
  const [explEsLoading, setExplEsLoading] = useState(false)
  const [xlat,          setXlat]          = useState<{ text: string; opts: string[]; ans: string } | null>(null)
  const [xlatLoading,   setXlatLoading]   = useState(false)
  const [xlatError,     setXlatError]     = useState(false)

  const shown = es && qEs ? qEs
              : xlat      ? { ...q, questionText: xlat.text, options: xlat.opts, correctAnswer: xlat.ans }
              :               q
  const type  = getType(q)
  const tags  = useMemo(() => getQuestionTags(q), [q])

  const hasOptions  = (shown.options?.length ?? 0) > 0
  const hasAnswer   = !!shown.correctAnswer

  const selectedIsCorrect = verified && selected !== null
    && isCorrectOpt(shown.options![selected], shown.correctAnswer)

  const handleSelect = (i: number) => {
    if (verified) return
    setSelected(prev => prev === i ? null : i)
  }

  const reset = () => { setSelected(null); setVerified(false); setShowAns(false); setShowExpl(false); setExplEs(false); setMdRowAnswers({}); setYnRowAnswers({}) }

  const toggleExplEs = async () => {
    if (explEs) { setExplEs(false); return }
    if (explEsText) { setExplEs(true); return }
    if (!q.explanation) return
    setExplEsLoading(true)
    try {
      const r = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.explanation)}&langpair=en|es`,
        { signal: AbortSignal.timeout(10000) }
      )
      const d = await r.json()
      setExplEsText((d.responseData?.translatedText as string) || q.explanation)
      setExplEs(true)
    } catch {
      setExplEs(true)
      setExplEsText(q.explanation)
    } finally {
      setExplEsLoading(false)
    }
  }

  const translate = async () => {
    if (xlat || xlatLoading) { setXlat(null); return }
    setXlatLoading(true); setXlatError(false)
    try {
      const tx = async (str: string) => {
        const r = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(str)}&langpair=en|es`,
          { signal: AbortSignal.timeout(8000) }
        )
        const d = await r.json()
        return (d.responseData?.translatedText as string) || str
      }
      const [text, ...opts] = await Promise.all([
        tx(q.questionText || ""),
        ...((q.options ?? []).map(o => tx(o))),
      ])
      const ans = q.correctAnswer ? await tx(q.correctAnswer) : ""
      setXlat({ text, opts, ans })
    } catch {
      setXlatError(true)
    } finally {
      setXlatLoading(false)
    }
  }

  const handleToggleOpen = () => {
    setOpen(o => !o)
    reset()
  }

  return (
    <div className={`bg-white/[0.04] backdrop-blur-xl border rounded-xl overflow-hidden transition-all duration-200 ${
      open ? 'border-primary/40' : 'border-border hover:border-slate-600'
    }`}>

      {/* ── Header ── */}
      <button
        onClick={handleToggleOpen}
        className="w-full text-left hover:bg-white/5 transition-colors px-4 pt-3 pb-2.5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-mono text-slate-500 shrink-0">#{q.number}</span>
            <span className="text-sm text-slate-300 truncate">
              {(() => { const t = shown.questionText?.split('\n')[0] || shown.number; return t.length > 110 ? t.slice(0, 110) + '…' : t })()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {verified && (
              selectedIsCorrect
                ? <CheckCircle size={13} className="text-emerald-400" />
                : <XCircle     size={13} className="text-red-400" />
            )}
            {q.images?.length ? <ImageIcon size={13} className="text-purple-400" /> : null}
            {examId && (() => {
              const n = parseQuestionNumber(q.number)
              if (!n) return null
              const url = `https://www.examprepper.co/exam/${examId}/${examPage(n)}`
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Ver pregunta ${n} en examprepper.co`}
                  onClick={e => e.stopPropagation()}
                  className="flex items-center justify-center w-6 h-6 rounded border bg-slate-800 border-slate-600 text-slate-400 hover:text-sky-400 hover:border-sky-500/60 transition-colors"
                >
                  <ExternalLink size={11} />
                </a>
              )
            })()}
            {examTopicsPath && (() => {
              const n = parseQuestionNumber(q.number)
              if (!n) return null
              const etPage = Math.ceil(n / 5)
              const url = `https://www.examtopics.com/exams/${examTopicsPath}/view/${etPage}/`
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Ver pregunta ${n} en ExamTopics`}
                  onClick={e => e.stopPropagation()}
                  className="flex items-center justify-center gap-0.5 px-1.5 h-6 rounded border bg-slate-800 border-slate-600 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/60 transition-colors text-[10px] font-bold"
                >
                  ET <ExternalLink size={9} />
                </a>
              )
            })()}
            {!qEs && (
              <button
                type="button"
                title={xlat ? "Volver al inglés" : "Traducir al español"}
                onClick={e => { e.stopPropagation(); translate() }}
                disabled={xlatLoading}
                className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                  xlat
                    ? "bg-amber-900/50 border-amber-600/60 text-amber-300"
                    : xlatError
                    ? "bg-red-900/40 border-red-600/50 text-red-400"
                    : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
                } disabled:opacity-40`}
              >
                {xlatLoading ? "..." : xlat ? "🇪🇸" : "🇺🇸"}
              </button>
            )}
            {qEs && (
              <button
                type="button"
                title={es ? 'Ver en inglés' : 'Ver en español'}
                onClick={e => { e.stopPropagation(); setEs(v => !v); reset() }}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                  es
                    ? 'bg-amber-900/50 border-amber-600/60 text-amber-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
                }`}
              >
                {es ? '🇪🇸' : '🇺🇸'}
              </button>
            )}
            {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
          </div>
        </div>

        {/* Fila 2: tags */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {tags.slice(0, 4).map(tag => (
            <TagChip key={tag.label} tag={tag} active={activeTag === tag.label} onClick={onTagClick} />
          ))}
          {tags.length > 4 && (
            <span className="text-[10px] text-slate-600">+{tags.length - 4} más</span>
          )}
        </div>
      </button>

      {/* ── Contenido expandido ── */}
      {open && (
        <div className="px-4 pb-4 border-t border-border/50 pt-4 space-y-4">

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <TagChip key={tag.label} tag={tag} active={activeTag === tag.label} onClick={onTagClick} />
              ))}
            </div>
          )}

          {shown.questionText && (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{shown.questionText}</p>
          )}

          {q.translation && !xlat && !es && (
            <div className="border-l-2 border-slate-700 pl-3 -mt-1">
              <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide mb-0.5">Traducción</p>
              <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap italic">{q.translation}</p>
            </div>
          )}

          {shown.images?.filter(img => {
            const info = typeof img === 'string' ? null : img
            return !info?.inOption && !info?.inAnswer
          }).map((img, i) => {
            const src = typeof img === 'string' ? img : img.path
            const alt = typeof img === 'string' ? '' : (img.alt || '')
            return (
              <img key={i} src={src} alt={alt}
                className="max-w-full rounded-lg border border-white/10 mt-1 mx-auto block"
                onError={e => (e.currentTarget.style.display = 'none')} />
            )
          })}

          {hasOptions && (
            <div className="space-y-2">
              {chooseNLabel(shown.correctAnswer) && (
                <p className="text-xs font-medium text-amber-400/80 bg-amber-900/20 border border-amber-700/30 rounded px-2.5 py-1 inline-block mb-1">
                  {chooseNLabel(shown.correctAnswer)}
                </p>
              )}
              {shown.options!.map((opt, i) => {
                const isSelected  = selected === i
                const isCorrect   = isCorrectOpt(opt, shown.correctAnswer)

                const revealMode = verified || showAns
                let cls = 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-white/5 hover:border-slate-500 cursor-pointer'
                if (!revealMode) {
                  if (isSelected) cls = 'bg-primary/20 border-primary/70 text-white cursor-pointer'
                } else {
                  if (isCorrect)               cls = 'bg-emerald-900/30 border-emerald-600/60 text-emerald-300 cursor-default'
                  else if (verified && isSelected) cls = 'bg-red-900/30 border-red-600/60 text-red-300 cursor-default'
                  else                         cls = 'bg-slate-800/30 border-slate-700/30 text-slate-500 cursor-default opacity-60'
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-all duration-150 ${cls}`}
                  >
                    {revealMode && isCorrect && <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />}
                    {verified && isSelected && !isCorrect && <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                    {!revealMode && isSelected && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-primary bg-primary/40 shrink-0 mt-0.5" />
                    )}
                    {!revealMode && !isSelected && (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0 mt-0.5" />
                    )}
                    <span className="flex flex-col gap-1.5 min-w-0">
                      <span>{opt}</span>
                      {(() => {
                        const letter = opt.match(/^([A-E])\./)?.[1]
                        if (!letter) return null
                        const optImgs = (q.images ?? []).filter(img =>
                          typeof img !== 'string' && img.inOption && img.optionLetter === letter
                        ) as QuestionImage[]
                        return optImgs.map((img, ii) => (
                          <img key={ii} src={img.path} alt={img.alt || ''}
                            className="max-w-full rounded border border-white/10 mt-0.5"
                            onError={e => (e.currentTarget.style.display = 'none')} />
                        ))
                      })()}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {verified && hasOptions && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold ${
              selectedIsCorrect
                ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400'
                : 'bg-red-900/20 border-red-700/40 text-red-400'
            }`}>
              {selectedIsCorrect
                ? <><CheckCircle size={15} /> ¡Correcto!</>
                : <><XCircle     size={15} /> Incorrecto — la respuesta correcta está resaltada en verde</>
              }
            </div>
          )}

          {q.questionType === 'yes-no' && q.statements?.length && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-slate-400 font-normal pb-2 pr-4">Statement</th>
                  <th className="w-14 text-center text-slate-400 font-normal pb-2">Yes</th>
                  <th className="w-14 text-center text-slate-400 font-normal pb-2">No</th>
                </tr>
              </thead>
              <tbody>
                {q.statements.map((stmt, si) => {
                  const revealed = showAns
                  const userAns  = ynRowAnswers[si]
                  const correct  = stmt.answer as 'Yes' | 'No'
                  return (
                    <tr key={si} className="border-b border-white/5">
                      <td className="py-2.5 pr-4 text-slate-300 text-[13px] leading-snug align-middle">{stmt.text}</td>
                      {(['Yes', 'No'] as const).map(val => {
                        const sel = userAns === val
                        const isCorrect = val === correct
                        let cls = 'w-8 h-8 rounded-full border text-xs font-medium transition-colors '
                        if (revealed && isCorrect)              cls += 'bg-emerald-500/30 border-emerald-500 text-emerald-300'
                        else if (revealed && sel && !isCorrect) cls += 'bg-red-500/20 border-red-500 text-red-300'
                        else if (revealed)                      cls += 'border-white/10 text-slate-600 cursor-default'
                        else if (sel)                           cls += 'bg-teal-500/20 border-teal-500 text-teal-200 cursor-pointer'
                        else                                    cls += 'border-white/10 text-slate-500 hover:border-slate-500 hover:text-slate-300 cursor-pointer'
                        return (
                          <td key={val} className="text-center py-2.5 align-middle">
                            <button className={cls}
                              onClick={() => { if (!revealed) setYnRowAnswers(prev => ({ ...prev, [si]: val })) }}
                              disabled={revealed}>
                              {val[0]}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {q.questionType === 'multi-dropdown' && q.statements?.length && (
            <div className="space-y-2">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-slate-500 font-normal pb-1.5 pr-3">Requirement</th>
                    <th className="text-left text-slate-500 font-normal pb-1.5">Solution</th>
                  </tr>
                </thead>
                <tbody>
                  {q.statements.map((stmt, si) => {
                    const val      = mdRowAnswers[si] ?? ''
                    const isRight  = val.trim().toLowerCase() === stmt.answer.toLowerCase()
                    const revealed = verified || showAns
                    const opts     = q.dropdownOptions ?? []
                    return (
                      <tr key={si} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-3 text-slate-400 align-top w-1/2">{stmt.text}</td>
                        <td className="py-2 align-top">
                          {revealed ? (
                            <div className={`px-2 py-1 rounded text-[11px] ${isRight ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
                              {isRight
                                ? <><CheckCircle size={10} className="inline mr-1" />{stmt.answer}</>
                                : <><XCircle size={10} className="inline mr-1" />{val ? <><span className="line-through opacity-50">{val}</span> → </> : ''}<span className="text-emerald-300">{stmt.answer}</span></>
                              }
                            </div>
                          ) : opts.length > 0 ? (
                            <select
                              value={val}
                              onChange={e => setMdRowAnswers(prev => ({ ...prev, [si]: e.target.value }))}
                              className="w-full px-2 py-1 rounded bg-slate-800 border border-white/10 text-slate-200 text-[11px] focus:outline-none focus:border-teal-500/50 cursor-pointer"
                            >
                              <option value="">Select…</option>
                              {opts.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-300 text-[11px]">SELECT…</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!verified && !showAns && q.dropdownOptions && Object.keys(mdRowAnswers).length === q.statements.length && (
                <button
                  onClick={() => setVerified(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/50 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
                >
                  <CheckCircle size={13} /> Verificar respuesta
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {hasOptions && selected !== null && !verified && (
              <button
                onClick={() => setVerified(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/50 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
              >
                <CheckCircle size={13} /> Verificar respuesta
              </button>
            )}

            {(verified || (!hasOptions && showAns)) && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs font-semibold hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={12} /> Reintentar
              </button>
            )}

            {(hasAnswer || !!q.explanation) && (
              <button
                onClick={() => setShowAns(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs font-semibold hover:bg-white/5 transition-colors ml-auto"
              >
                {showAns ? <><EyeOff size={12} /> Hide Answer</> : <><Eye size={12} /> Answer</>}
              </button>
            )}
          </div>

          {(showAns || verified) && (hasAnswer || !!q.explanation) && (
            <div className="bg-emerald-900/15 border border-emerald-700/40 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-emerald-500 font-semibold uppercase tracking-wide">Respuesta correcta</p>
                {q.explanation && (
                  <button
                    type="button"
                    title={showExpl ? 'Ocultar explicación' : 'Ver explicación'}
                    onClick={() => setShowExpl(v => !v)}
                    className={`w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center transition-colors ${
                      showExpl
                        ? 'bg-blue-500/30 border-blue-400/60 text-blue-200'
                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-blue-400/60 hover:text-blue-300'
                    }`}
                  >
                    i
                  </button>
                )}
              </div>
              {q.questionType === 'multi-dropdown' && q.statements?.length ? (
                <table className="w-full text-xs mt-0.5">
                  <tbody>
                    {q.statements.map((stmt, si) => (
                      <tr key={si} className="border-b border-emerald-800/30 last:border-0">
                        <td className="py-1.5 pr-3 text-slate-400 align-top w-1/2">{stmt.text}</td>
                        <td className="py-1.5 text-emerald-300 font-medium align-top">→ {stmt.answer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-emerald-300 leading-relaxed">
                  {shown.correctAnswer && /^[A-E]{2,}$/i.test(shown.correctAnswer.trim())
                    ? shown.correctAnswer.trim().toUpperCase().split('').join(', ')
                    : shown.correctAnswer}
                </p>
              )}
              {shown.images?.filter(img => typeof img !== 'string' && img.inAnswer).map((img, i) => {
                const info = img as QuestionImage
                return (
                  <img key={i} src={info.path} alt={info.alt || ''}
                    className="max-w-full rounded-lg border border-emerald-700/30 mt-2 mx-auto block"
                    onError={e => (e.currentTarget.style.display = 'none')} />
                )
              })}
              {showExpl && q.explanation && (
                <div className="mt-2 pt-2 border-t border-emerald-800/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Explicación</p>
                    <button
                      type="button"
                      onClick={toggleExplEs}
                      disabled={explEsLoading}
                      title={explEs ? 'Ver en inglés' : 'Ver en español'}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors disabled:opacity-50 ${
                        explEs
                          ? 'bg-amber-900/50 border-amber-600/60 text-amber-300'
                          : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-amber-500/60 hover:text-amber-300'
                      }`}
                    >
                      {explEsLoading ? '…' : explEs ? '🇪🇸' : '🇺🇸'}
                    </button>
                  </div>
                  <p className="text-xs text-blue-300 leading-relaxed">
                    {explEs && explEsText ? explEsText : q.explanation}
                  </p>
                  {q.learnMore && q.learnMore.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-emerald-800/30">
                      <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Learn More</p>
                      <ul className="space-y-0.5">
                        {q.learnMore.map((ref, ri) => {
                          const text = typeof ref === 'string' ? ref : ref.text
                          const url  = typeof ref === 'string' ? '' : ref.url
                          return (
                            <li key={ri} className="flex items-start gap-1 text-[11px] leading-snug">
                              <span className="mt-0.5 shrink-0 text-slate-600">›</span>
                              {url ? (
                                <a href={url} target="_blank" rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                                  {text}
                                </a>
                              ) : (
                                <span className="text-slate-400">{text}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Modo Examen — tipos ──────────────────────────────────────────────────────

interface ExamModeCfg {
  numQuestions: number
  timeLimitMin: number
  randomOrder:  boolean
  onlyWithAnswer: boolean
  translateToEs: boolean
}
interface ExamModeAns { selected: number[]; confirmed: boolean; flagged: boolean }

function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ─── Modo Examen — Modal de configuración ────────────────────────────────────

function ExamConfigModal({
  total, withAnswer, onStart, onClose,
}: {
  total: number; withAnswer: number
  onStart: (cfg: ExamModeCfg) => void
  onClose: () => void
}) {
  const [numQ,        setNumQ]        = useState<number>(25)
  const [timeLimit,   setTimeLimit]   = useState<number>(0)
  const [random,      setRandom]      = useState(true)
  const [onlyAns,     setOnlyAns]     = useState(true)
  const [translateEs, setTranslateEs] = useState(false)

  const pool    = onlyAns ? withAnswer : total
  const actualQ = numQ === -1 ? pool : Math.min(numQ, pool)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <GraduationCap size={13} className="text-teal-400" />
            </div>
            <span className="font-semibold text-white text-sm">Configurar Examen</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">

          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Número de preguntas</p>
            <div className="grid grid-cols-5 gap-2">
              {([10, 25, 50, 100, -1] as number[]).map(n => (
                <button key={n} onClick={() => setNumQ(n)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                    numQ === n
                      ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                      : 'bg-white/[0.04] border-white/[0.07] text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}>
                  {n === -1 ? 'Todas' : n}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">
              {actualQ} preguntas de {pool} disponibles
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Límite de tiempo</p>
            <div className="grid grid-cols-4 gap-2">
              {[0, 30, 60, 90].map(t => (
                <button key={t} onClick={() => setTimeLimit(t)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                    timeLimit === t
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-white/[0.04] border-white/[0.07] text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}>
                  {t === 0 ? 'Sin límite' : `${t} min`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Opciones</p>
            {([
              { key: 'r', label: 'Orden aleatorio',              val: random,       set: setRandom       },
              { key: 'a', label: 'Solo preguntas con respuesta', val: onlyAns,      set: setOnlyAns      },
              { key: 't', label: 'Traducir todo al español',     val: translateEs,  set: setTranslateEs  },
            ] as { key: string; label: string; val: boolean; set: (v: boolean) => void }[]).map(({ key, label, val, set }) => (
              <button key={key} onClick={() => set(!val)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
                <span className="text-sm text-slate-300">{label}</span>
                <div className={`relative w-9 h-5 rounded-full border transition-all ${val ? 'bg-teal-500/30 border-teal-500/50' : 'bg-white/5 border-white/10'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${val ? 'left-4' : 'left-0.5'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={() => onStart({ numQuestions: actualQ, timeLimitMin: timeLimit, randomOrder: random, onlyWithAnswer: onlyAns, translateToEs: translateEs })}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <Play size={14} />
            Iniciar · {actualQ} preguntas {timeLimit > 0 ? `· ${timeLimit} min` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modo Examen — Pantalla pregunta a pregunta ───────────────────────────────

function ExamScreen({
  questions, config, onFinish,
}: {
  questions: Question[]; config: ExamModeCfg
  onFinish: (answers: ExamModeAns[]) => void
}) {
  const total = questions.length
  const [current,     setCurrent]     = useState(0)
  const [answers,     setAnswers]     = useState<ExamModeAns[]>(questions.map(() => ({ selected: [], confirmed: false, flagged: false })))
  const [ynAnswers,   setYnAnswers]   = useState<Record<number, Record<number, string>>>({})
  const [mdAnswers,   setMdAnswers]   = useState<Record<number, Record<number, string>>>({})
  const [hsAnswers,   setHsAnswers]   = useState<Record<number, string>>({})
  const [timeLeft,    setTimeLeft]    = useState(config.timeLimitMin * 60)
  const [showExit,    setShowExit]    = useState(false)

  const [xlat,        setXlat]        = useState<{ text: string; opts: string[]; explanation?: string } | null>(null)
  const [xlatLoading, setXlatLoading] = useState(false)
  const [xlatError,   setXlatError]   = useState(false)

  const doTranslate = async (idx: number) => {
    setXlatLoading(true); setXlatError(false)
    try {
      const tx = async (str: string) => {
        if (!str) return str
        const r = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(str)}&langpair=en|es`,
          { signal: AbortSignal.timeout(8000) }
        )
        const d = await r.json()
        return (d.responseData?.translatedText as string) || str
      }
      const q = questions[idx]
      const tasks: Promise<string>[] = [
        tx(q.questionText || ''),
        ...(q.options ?? []).map(o => tx(o)),
        tx(q.explanation || ''),
      ]
      const results = await Promise.all(tasks)
      const optCount = (q.options ?? []).length
      const text = results[0]
      const opts = results.slice(1, 1 + optCount)
      const explanation = results[1 + optCount] || undefined
      setXlat({ text, opts, explanation })
    } catch { setXlatError(true) }
    finally { setXlatLoading(false) }
  }

  useEffect(() => {
    setXlat(null); setXlatError(false)
    if (config.translateToEs) doTranslate(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  const translate = async () => {
    if (xlat) { setXlat(null); return }
    if (xlatLoading) return
    await doTranslate(current)
  }

  useEffect(() => {
    if (config.timeLimitMin === 0) return
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); onFinish(answers); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const q   = questions[current]
  const ans = answers[current]
  const progress = (current / total) * 100
  const timerRed = config.timeLimitMin > 0 && timeLeft < 60
  const timerAmb = config.timeLimitMin > 0 && timeLeft < 300 && !timerRed

  const displayText = xlat ? xlat.text : (q.questionText ?? '')
  const displayOpts = xlat ? xlat.opts  : (q.options ?? [])

  const selectOpt = (idx: number) => {
    if (ans.confirmed) return
    setAnswers(prev => prev.map((a, i) => {
      if (i !== current) return a
      const already = a.selected.includes(idx)
      return { ...a, selected: already ? a.selected.filter(s => s !== idx) : [...a.selected, idx] }
    }))
  }
  const confirmAns = () => {
    if (ans.selected.length === 0) return
    setAnswers(prev => prev.map((a, i) => i === current ? { ...a, confirmed: true } : a))
  }
  const goNext = () => {
    if (current < total - 1) setCurrent(c => c + 1)
    else onFinish(answers)
  }
  const goPrev = () => { if (current > 0) setCurrent(c => c - 1) }
  const toggleFlag = () => {
    setAnswers(prev => prev.map((a, i) => i === current ? { ...a, flagged: !a.flagged } : a))
  }

  const toggleYN = (qIdx: number, stmtIdx: number, value: string) => {
    if (answers[qIdx].confirmed) return
    setYnAnswers(prev => ({ ...prev, [qIdx]: { ...(prev[qIdx] ?? {}), [stmtIdx]: value } }))
  }
  const ynAllAnswered = (qIdx: number, q: Question) =>
    (q.statements ?? []).every((_, i) => ynAnswers[qIdx]?.[i] !== undefined)
  const ynIsCorrect = (qIdx: number, q: Question) =>
    (q.statements ?? []).every((s, i) => ynAnswers[qIdx]?.[i] === s.answer)

  const mdAllAnswered = (qIdx: number, q: Question) =>
    (q.statements ?? []).every((_, i) => (mdAnswers[qIdx]?.[i] ?? '').trim().length > 0)
  const hsAllAnswered = (qIdx: number) => (hsAnswers[qIdx] ?? '').trim().length > 0

  const answeredCount = answers.filter(a => a.confirmed).length
  const flaggedCount  = answers.filter(a => a.flagged).length

  return (
    <div className="fixed inset-0 z-40 bg-[#07070F] flex flex-col overflow-hidden">

      <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#07070F]/95 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button onClick={() => setShowExit(true)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors text-xs">
            <ArrowLeft size={14} /> Salir
          </button>

          <span className="text-xs text-slate-400 flex items-center gap-2">
            <span><span className="text-white font-bold">{current + 1}</span>/{total}</span>
            {answeredCount > 0 && <span className="text-slate-600">· {answeredCount} respondidas</span>}
            {flaggedCount > 0 && <span className="text-amber-500/70">· {flaggedCount} marcadas</span>}
          </span>

          <div className="flex items-center gap-3">
            {config.timeLimitMin > 0 && (
              <div className={`flex items-center gap-1 text-sm font-mono font-bold ${timerRed ? 'text-red-400 animate-pulse' : timerAmb ? 'text-amber-400' : 'text-slate-400'}`}>
                <Clock size={12} />
                {fmtTime(timeLeft)}
              </div>
            )}
            <button onClick={() => onFinish(answers)}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-teal-600/20 border border-teal-500/40 text-teal-400 hover:bg-teal-600/30 transition-colors font-semibold">
              Finalizar
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mt-2.5">
          <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">

          <div className="mb-7">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold text-teal-500/60 uppercase tracking-widest">{q.number}</span>
              {config.translateToEs ? (
                <button
                  onClick={() => xlat ? setXlat(null) : doTranslate(current)}
                  disabled={xlatLoading}
                  title={xlat ? 'Ver en inglés' : 'Ver en español'}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold transition-colors disabled:opacity-40 ${
                    xlatLoading
                      ? 'bg-white/[0.04] border-white/[0.08] text-slate-500'
                      : xlatError
                        ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                        : xlat
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                          : 'bg-white/[0.05] border-white/[0.10] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {xlatLoading ? <RefreshCw size={9} className="animate-spin" /> : xlatError ? '✕ ESP' : xlat ? 'ESP' : 'ENG'}
                </button>
              ) : (
                <button
                  onClick={translate}
                  disabled={xlatLoading}
                  title={xlat ? 'Ver original' : 'Traducir al español'}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold transition-colors disabled:opacity-40 ${
                    xlat
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                      : xlatError
                        ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                        : 'bg-white/[0.05] border-white/[0.10] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {xlatLoading ? (
                    <RefreshCw size={9} className="animate-spin" />
                  ) : xlat ? (
                    <span>🇪🇸 ES</span>
                  ) : xlatError ? (
                    <span>✕ retry</span>
                  ) : (
                    <span>🇺🇸→🇪🇸</span>
                  )}
                </button>
              )}
              {getQuestionTags(q).slice(0, 3).map(tag => {
                const cls = TAG_COLOR[tag.color] ?? TAG_COLOR.slate
                return (
                  <span key={tag.label} className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
                    {tag.label}
                  </span>
                )
              })}
            </div>
            <p className="text-white text-[15px] leading-relaxed">{displayText}</p>

            {/* imágenes asociadas a la pregunta (no a opciones, no a respuesta) */}
            {q.images?.filter(img => {
              const info = typeof img === 'string' ? null : img
              return !info?.inOption && !info?.inAnswer
            }).map((img, i) => {
              const src = typeof img === 'string' ? img : img.path
              const alt = typeof img === 'string' ? '' : (img.alt || '')
              return (
                <img key={i} src={src} alt={alt}
                  className="max-w-full rounded-lg border border-white/10 mt-3 mx-auto block"
                  onError={e => (e.currentTarget.style.display = 'none')} />
              )
            })}
          </div>

          <div className="space-y-3 mb-8">
            {q.questionType === 'yes-no' ? (
              // ── Formato Yes/No ─────────────────────────────────────────────
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-slate-400 font-normal pb-2 pr-4">Statement</th>
                    <th className="w-16 text-center text-slate-400 font-normal pb-2">Yes</th>
                    <th className="w-16 text-center text-slate-400 font-normal pb-2">No</th>
                  </tr>
                </thead>
                <tbody>
                  {(q.statements ?? []).map((stmt, si) => {
                    const confirmed  = ans.confirmed
                    const userAns    = ynAnswers[current]?.[si]
                    return (
                      <tr key={si} className="border-b border-white/5">
                        <td className="py-2.5 pr-4 text-slate-300 text-[13px] leading-snug align-middle">{stmt.text}</td>
                        {(['Yes', 'No'] as const).map(val => {
                          const selected = userAns === val
                          const correct  = val === stmt.answer
                          let cls = 'w-8 h-8 rounded-full border text-xs font-medium transition-colors '
                          if (confirmed && correct)         cls += 'bg-emerald-500/30 border-emerald-500 text-emerald-300'
                          else if (confirmed && selected && !correct) cls += 'bg-red-500/20 border-red-500 text-red-300'
                          else if (confirmed)               cls += 'border-white/10 text-slate-600 cursor-default'
                          else if (selected)                cls += 'bg-teal-500/20 border-teal-500 text-teal-200 cursor-pointer'
                          else                              cls += 'border-white/10 text-slate-500 hover:border-slate-500 hover:text-slate-300 cursor-pointer'
                          return (
                            <td key={val} className="text-center py-2.5 align-middle">
                              <button className={cls} onClick={() => toggleYN(current, si, val)} disabled={confirmed}>
                                {val[0]}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : q.questionType === 'multi-dropdown' ? (
              // ── Formato Multi-dropdown ──────────────────────────────────────
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-slate-400 font-normal pb-2 pr-4">Requirement</th>
                    <th className="text-left text-slate-400 font-normal pb-2">Solution</th>
                  </tr>
                </thead>
                <tbody>
                  {(q.statements ?? []).map((stmt, si) => {
                    const confirmed = ans.confirmed
                    const userVal   = mdAnswers[current]?.[si] ?? ''
                    const isRight   = userVal.trim().toLowerCase() === stmt.answer.toLowerCase()
                    const opts      = q.dropdownOptions ?? []
                    return (
                      <tr key={si} className="border-b border-white/5">
                        <td className="py-2.5 pr-4 text-slate-300 text-[13px] leading-snug align-top w-1/2">{stmt.text}</td>
                        <td className="py-2.5 align-top">
                          {confirmed ? (
                            <div className={`px-3 py-1.5 rounded-lg text-[13px] ${isRight ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
                              {isRight
                                ? <><CheckCircle size={12} className="inline mr-1.5" />{userVal || stmt.answer}</>
                                : <><XCircle size={12} className="inline mr-1.5" /><span className="line-through opacity-50">{userVal}</span> → <span className="text-emerald-300">{stmt.answer}</span></>
                              }
                            </div>
                          ) : opts.length > 0 ? (
                            <select
                              value={userVal}
                              onChange={e => setMdAnswers(prev => ({ ...prev, [current]: { ...(prev[current] ?? {}), [si]: e.target.value } }))}
                              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 text-[13px] focus:outline-none focus:border-teal-500/50 cursor-pointer"
                            >
                              <option value="">Select…</option>
                              {opts.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={userVal}
                              onChange={e => setMdAnswers(prev => ({ ...prev, [current]: { ...(prev[current] ?? {}), [si]: e.target.value } }))}
                              placeholder="Type the solution…"
                              className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-[13px] placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : q.questionType === 'hotspot' ? (
              // ── Formato Hotspot ─────────────────────────────────────────────
              <div className="space-y-3">
                <p className="text-slate-400 text-sm">Select the correct item in the image or type your answer:</p>
                {ans.confirmed ? (
                  <div className={`px-4 py-3 rounded-xl border text-sm ${
                    (hsAnswers[current] ?? '').trim().toLowerCase() === (q.correctAnswer ?? '').toLowerCase()
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-500/10 border-red-500/40 text-red-300'
                  }`}>
                    {(hsAnswers[current] ?? '').trim().toLowerCase() === (q.correctAnswer ?? '').toLowerCase()
                      ? <><CheckCircle size={14} className="inline mr-2" />{hsAnswers[current]}</>
                      : <><XCircle size={14} className="inline mr-2" /><span className="line-through opacity-60">{hsAnswers[current]}</span> → <span className="text-emerald-300">{q.correctAnswer}</span></>
                    }
                  </div>
                ) : (
                  <input
                    type="text"
                    value={hsAnswers[current] ?? ''}
                    onChange={e => setHsAnswers(prev => ({ ...prev, [current]: e.target.value }))}
                    placeholder="Type your answer…"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                  />
                )}
              </div>
            ) : (
              // ── Formato MC/dropdown ─────────────────────────────────────────
              displayOpts.map((opt, idx) => {
                const sel       = ans.selected.includes(idx)
                const confirmed = ans.confirmed
                const correct   = isCorrectOpt(q.options?.[idx] ?? opt, q.correctAnswer)
                let cls = 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.07] hover:border-slate-600 cursor-pointer'
                if (confirmed) {
                  if (correct)      cls = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200 cursor-default'
                  else if (sel)     cls = 'bg-red-500/10 border-red-500/50 text-red-300 cursor-default'
                  else              cls = 'bg-white/[0.02] border-white/[0.04] text-slate-600 cursor-default'
                } else if (sel)     cls = 'bg-teal-500/10 border-teal-500/60 text-teal-200 cursor-pointer'
                const letter = opt.match(/^([A-E])\./)?.[1]
                const optImgs = letter
                  ? (q.images ?? []).filter(img =>
                      typeof img !== 'string' && img.inOption && img.optionLetter === letter
                    ) as QuestionImage[]
                  : []
                return (
                  <button key={idx} onClick={() => selectOpt(idx)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 flex items-start gap-3 ${cls}`}>
                    <span className="text-xs font-bold mt-0.5 flex-shrink-0 opacity-70">{opt.charAt(0)}.</span>
                    <span className="text-sm leading-relaxed flex-1 flex flex-col gap-1.5">
                      <span>{opt.slice(opt.indexOf('.') + 1).trim()}</span>
                      {optImgs.map((img, ii) => (
                        <img key={ii} src={img.path} alt={img.alt || ''}
                          className="max-w-full rounded border border-white/10 mt-0.5 block"
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      ))}
                    </span>
                    {confirmed && correct && <CheckCircle size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />}
                    {confirmed && sel && !correct && <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />}
                  </button>
                )
              })
            )}
          </div>

          {/* Show Answer */}
          {!ans.confirmed && (
            <button
              onClick={
                q.questionType === 'yes-no' ? () => {
                  if (!ynAllAnswered(current, q)) return
                  const encoded = (q.statements ?? []).map((_, si) =>
                    ynAnswers[current]?.[si] === 'Yes' ? si * 2 : si * 2 + 1
                  )
                  setAnswers(prev => prev.map((a, i) => i === current ? { ...a, confirmed: true, selected: encoded } : a))
                }
                : q.questionType === 'multi-dropdown' ? () => {
                  if (!mdAllAnswered(current, q)) return
                  const allOk = (q.statements ?? []).every((s, si) =>
                    (mdAnswers[current]?.[si] ?? '').trim().toLowerCase() === s.answer.toLowerCase()
                  )
                  setAnswers(prev => prev.map((a, i) => i === current ? { ...a, confirmed: true, selected: [allOk ? 1 : 0] } : a))
                }
                : q.questionType === 'hotspot' ? () => {
                  if (!hsAllAnswered(current)) return
                  const ok = (hsAnswers[current] ?? '').trim().toLowerCase() === (q.correctAnswer ?? '').toLowerCase()
                  setAnswers(prev => prev.map((a, i) => i === current ? { ...a, confirmed: true, selected: [ok ? 1 : 0] } : a))
                }
                : confirmAns
              }
              disabled={
                q.questionType === 'yes-no' ? !ynAllAnswered(current, q)
                : q.questionType === 'multi-dropdown' ? !mdAllAnswered(current, q)
                : q.questionType === 'hotspot' ? !hsAllAnswered(current)
                : ans.selected.length === 0
              }
              className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-35 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors mb-3">
              Show Answer
            </button>
          )}

          {/* Explanation + Learn More */}
          {ans.confirmed && (q.explanation || (q.learnMore && q.learnMore.length > 0)) && (
            <div className="bg-slate-800/60 border border-white/[0.08] rounded-xl px-4 py-3.5 space-y-2.5 mb-3">
              {q.explanation && (
                <div>
                  <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-1">Explicación</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{xlat?.explanation ?? q.explanation}</p>
                </div>
              )}
              {q.learnMore && q.learnMore.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Learn More</p>
                  <ul className="space-y-1">
                    {q.learnMore.map((item, i) => {
                      const text = typeof item === 'string' ? item : item.text
                      const url  = typeof item === 'string' ? null  : item.url
                      return (
                        <li key={i} className="text-xs">
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                              {text}
                            </a>
                          ) : (
                            <span className="text-slate-400">{text}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Imágenes de respuesta (hotspot/exhibit answer) */}
          {ans.confirmed && q.images?.some(img => typeof img !== 'string' && img.inAnswer) && (
            <div className="mb-3">
              {q.images.filter(img => typeof img !== 'string' && img.inAnswer).map((img, i) => {
                const info = img as QuestionImage
                return (
                  <img key={i} src={info.path} alt={info.alt || ''}
                    className="max-w-full rounded-xl border border-emerald-700/30 mt-2 mx-auto block"
                    onError={e => (e.currentTarget.style.display = 'none')} />
                )
              })}
            </div>
          )}

          {/* Navegación: Anterior · Revisar Después · Siguiente */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={goPrev} disabled={current === 0}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-sm font-semibold">
              <ChevronLeft size={15} /> Anterior
            </button>
            <button onClick={toggleFlag}
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border transition-colors text-sm font-semibold ${
                ans.flagged
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 hover:bg-amber-500/25'
                  : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-amber-300'
              }`}>
              <Bookmark size={14} className={ans.flagged ? 'fill-amber-300' : ''} />
              {ans.flagged ? 'Marcada' : 'Revisar después'}
            </button>
            <button onClick={goNext}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary hover:opacity-90 text-white font-semibold text-sm transition-colors">
              {current < total - 1 ? 'Siguiente' : 'Ver resultados'}
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {showExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 max-w-xs w-full mx-4 text-center">
            <AlertTriangle size={28} className="text-amber-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1.5">¿Salir del examen?</h3>
            <p className="text-slate-400 text-xs mb-5">Se perderá el progreso actual.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowExit(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5 transition-colors">
                Continuar
              </button>
              <button onClick={() => onFinish(answers)}
                className="flex-1 py-2.5 rounded-xl bg-red-600/70 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modo Examen — Resultados ─────────────────────────────────────────────────

function ExamResults({
  questions, answers, elapsedSec, exam, provider, config, onRetry, onClose,
}: {
  questions: Question[]; answers: ExamModeAns[]
  elapsedSec: number
  exam?: ExamConfig; provider?: ProviderConfig; config?: ExamModeCfg
  onRetry: () => void; onClose: () => void
}) {
  const total    = questions.length
  const correct  = answers.filter((a, i) => {
    const q = questions[i]
    if (!a.confirmed || a.selected.length === 0) return false
    if (q.questionType === 'yes-no' && q.statements?.length) {
      return q.statements.every((stmt, si) => {
        const isYes = a.selected.includes(si * 2)
        return (isYes && stmt.answer === 'Yes') || (!isYes && stmt.answer === 'No')
      })
    }
    // multi-dropdown y hotspot: selected=[1] = correcto, [0] = incorrecto
    if (q.questionType === 'multi-dropdown' || q.questionType === 'hotspot') {
      return a.selected[0] === 1
    }
    const expectedCount = /^[A-E]+$/i.test(q.correctAnswer?.trim() ?? '') ? (q.correctAnswer?.trim().length ?? 1) : 1
    return a.selected.length === expectedCount && a.selected.every(si => isCorrectOpt(q.options?.[si] ?? '', q.correctAnswer))
  }).length
  const skipped  = answers.filter(a => !a.confirmed).length
  const wrong    = total - correct - skipped
  const pct      = Math.round((correct / (total - skipped || 1)) * 100)
  const passed   = pct >= 70
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (!exam) return
    fetch('/api/certifications/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_id:   provider?.id   ?? '',
        provider_name: provider?.name ?? '',
        exam_id:       exam.id,
        exam_code:     exam.code,
        exam_name:     exam.name,
        score_pct:     pct,
        correct,
        wrong,
        skipped,
        total,
        elapsed_sec:   elapsedSec,
        config:        config ?? {},
      }),
    }).catch(() => { /* silent — no bloquea la UI */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      <div className={`rounded-2xl border p-6 text-center ${passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <div className="flex items-center justify-center mb-3">
          <Trophy size={32} className={passed ? 'text-amber-400' : 'text-slate-600'} />
        </div>
        <div className={`text-6xl font-black mb-1 ${passed ? 'text-emerald-400' : 'text-red-400'}`}>{pct}%</div>
        <div className={`text-sm font-semibold mb-4 ${passed ? 'text-emerald-300' : 'text-red-300'}`}>
          {passed ? '¡Aprobado!' : 'No aprobado — sigue practicando'}
        </div>
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-emerald-400 font-bold text-lg">{correct}</div>
            <div className="text-slate-500 text-xs">Correctas</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 font-bold text-lg">{wrong}</div>
            <div className="text-slate-500 text-xs">Incorrectas</div>
          </div>
          {skipped > 0 && (
            <div className="text-center">
              <div className="text-amber-400 font-bold text-lg">{skipped}</div>
              <div className="text-slate-500 text-xs">Sin responder</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-slate-300 font-bold text-lg">{fmtTime(elapsedSec)}</div>
            <div className="text-slate-500 text-xs">Tiempo</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
          <BookOpen size={14} /> Volver a estudiar
        </button>
        <button onClick={onRetry}
          className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
          <RotateCcw size={14} /> Nuevo examen
        </button>
      </div>

      <div className="bg-white/[0.04] backdrop-blur-xl border border-border rounded-xl overflow-hidden">
        <button onClick={() => setShowDetail(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-sm text-slate-400">
          <span className="font-medium text-slate-300">Revisar respuestas</span>
          {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showDetail && (
          <div className="divide-y divide-white/[0.04] border-t border-white/[0.05]">
            {questions.map((q, i) => {
              const a       = answers[i]
              const ok      = a.confirmed && a.selected.length > 0 && (
                (q.questionType === 'yes-no' && q.statements?.length)
                  ? q.statements.every((s, si) => { const isY = a.selected.includes(si*2); return (isY && s.answer==='Yes')||(!isY && s.answer==='No') })
                  : (q.questionType === 'multi-dropdown' || q.questionType === 'hotspot')
                    ? a.selected[0] === 1
                    : a.selected.every(si => isCorrectOpt(q.options?.[si] ?? '', q.correctAnswer))
                      && a.selected.length === ((/^[A-E]+$/i.test(q.correctAnswer?.trim() ?? '')) ? (q.correctAnswer?.trim().length ?? 1) : 1)
              )
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-start gap-2 mb-1.5">
                    {!a.confirmed
                      ? <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center"><span className="text-[8px] text-amber-400">—</span></span>
                      : ok
                        ? <CheckCircle size={14} className="flex-shrink-0 text-emerald-400 mt-0.5" />
                        : <XCircle size={14} className="flex-shrink-0 text-red-400 mt-0.5" />
                    }
                    <span className="text-xs text-slate-300 leading-relaxed">{q.questionText?.slice(0, 120)}{(q.questionText?.length ?? 0) > 120 ? '…' : ''}</span>
                  </div>
                  {!ok && q.correctAnswer && (
                    <p className="text-[11px] text-emerald-400/80 ml-6">
                      ✓ {/^[A-E]{2,}$/i.test(q.correctAnswer.trim())
                        ? q.correctAnswer.trim().toUpperCase().split('').join(', ')
                        : q.correctAnswer}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Búsqueda semántica (TF-IDF + cosine similarity) ────────────────────────

const STOP_WORDS = new Set([
  // English
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','can','this',
  'that','these','those','it','its','you','your','we','our','they','their',
  'he','she','his','her','what','which','who','how','when','where','not','no',
  'if','then','than','so','as','up','out','about','into','through','each',
  'all','both','more','most','other','some','such','only','same','also','need',
  'use','used','using','must','want','include','including','select','choose',
  'correct','answer','question','statement','following','each','per','true',
  // Spanish
  'un','una','el','la','los','las','de','del','en','al','y','o','pero','que',
  'se','con','por','para','como','más','no','si','es','son','era','fue','ser',
  'estar','tener','hacer','puede','debe','tiene','tienen','cada','todo','todos',
  'este','esta','estos','estas','cual','qué','cómo','cuál','su','sus','lo',
  'le','les','nos','también','solo','mismo','selecciona','elige','correcta',
  'respuesta','pregunta','declaración','siguiente','siguiente','verdadera',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúñüàèìòù0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function buildDocVectors(questions: Question[], idf: Map<string, number>): Map<string, number>[] {
  return questions.map(q => {
    const text = [q.questionText ?? '', q.translation ?? '', ...(q.options ?? []), q.correctAnswer ?? ''].join(' ')
    return tfidfVec(tokenize(text), idf)
  })
}

function computeIDF(questions: Question[]): Map<string, number> {
  const n = questions.length
  const df = new Map<string, number>()
  questions.forEach(q => {
    const text = [q.questionText ?? '', q.translation ?? '', ...(q.options ?? []), q.correctAnswer ?? ''].join(' ')
    const seen = new Set(tokenize(text))
    seen.forEach(term => df.set(term, (df.get(term) ?? 0) + 1))
  })
  const idf = new Map<string, number>()
  df.forEach((count, term) => idf.set(term, Math.log((n + 1) / (count + 1)) + 1))
  return idf
}

function tfidfVec(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>()
  tokens.forEach(t => tf.set(t, (tf.get(t) ?? 0) + 1))
  const vec = new Map<string, number>()
  tf.forEach((count, term) => {
    vec.set(term, (count / (tokens.length || 1)) * (idf.get(term) ?? Math.log(2)))
  })
  return vec
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0
  a.forEach((v, t) => { dot += v * (b.get(t) ?? 0); magA += v * v })
  b.forEach(v => { magB += v * v })
  if (!magA || !magB) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function SemanticSearchPanel({ questions }: { questions: Question[] }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<{ q: Question; score: number }[]>([])
  const [searched, setSearched] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const idf  = useMemo(() => computeIDF(questions), [questions])
  const vecs = useMemo(() => buildDocVectors(questions, idf), [questions, idf])

  const runSearch = () => {
    const q = query.trim()
    if (!q) return
    const qVec = tfidfVec(tokenize(q), idf)
    const scored = questions.map((question, i) => ({ q: question, score: cosineSim(qVec, vecs[i]) }))
    scored.sort((a, b) => b.score - a.score)
    setResults(scored.slice(0, 8))
    setSearched(true)
    setExpanded(null)
  }

  const reset = () => { setQuery(''); setResults([]); setSearched(false); setExpanded(null) }

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl border border-amber-500/20 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2.5">
        <Search size={14} className="text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">Buscar duplicado semántico</span>
        <span className="ml-auto text-[10px] text-slate-600 font-mono">TF-IDF · cosine similarity</span>
      </div>

      <div className="px-4 py-4 space-y-3">
        <textarea
          value={query}
          onChange={e => { setQuery(e.target.value); setSearched(false) }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runSearch() }}
          placeholder="Pega aquí el texto de la nueva pregunta (inglés o español)…"
          rows={3}
          className="w-full bg-white/[0.04] border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors resize-none"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={runSearch}
            disabled={!query.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 text-sm font-semibold hover:bg-amber-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search size={13} />
            Analizar similitud
          </button>
          {searched && (
            <button onClick={reset} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1">
              ✕ Limpiar
            </button>
          )}
          <span className="ml-auto text-[10px] text-slate-600">Ctrl+Enter para buscar</span>
        </div>

        {searched && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">
              Top {results.length} más similares de {questions.length} preguntas
            </p>
            {results.map(({ q, score }) => {
              const pct  = Math.round(score * 100)
              const high = pct >= 55
              const mid  = pct >= 30 && !high
              const isOpen = expanded === q.number
              return (
                <div
                  key={q.number}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    high ? 'border-red-600/50 bg-red-950/20'
                    : mid ? 'border-amber-700/40 bg-amber-950/10'
                    :        'border-slate-700/40 bg-slate-900/30'
                  }`}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : q.number)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <span className={`shrink-0 text-xs font-bold w-12 text-right tabular-nums ${
                      high ? 'text-red-400' : mid ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                      {pct}%
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-slate-600">#{q.number}</span>
                        {high && <span className="text-[9px] font-bold text-red-400 bg-red-900/30 border border-red-700/40 px-1.5 py-0.5 rounded-full">⚠ POSIBLE DUPLICADO</span>}
                        {mid  && <span className="text-[9px] font-bold text-amber-400 bg-amber-900/30 border border-amber-700/40 px-1.5 py-0.5 rounded-full">SIMILAR</span>}
                      </div>
                      <p className="text-xs text-slate-300 truncate leading-relaxed">
                        {q.questionText?.split('\n')[0]?.slice(0, 120)}
                        {(q.questionText?.split('\n')[0]?.length ?? 0) > 120 ? '…' : ''}
                      </p>
                    </div>
                    <div className={`shrink-0 w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden`}>
                      <div
                        className={`h-full rounded-full transition-all ${high ? 'bg-red-500' : mid ? 'bg-amber-500' : 'bg-slate-600'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    {isOpen
                      ? <ChevronUp   size={13} className="shrink-0 text-slate-500" />
                      : <ChevronDown size={13} className="shrink-0 text-slate-500" />
                    }
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-0 border-t border-white/[0.05] space-y-2">
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap mt-2">
                        {q.questionText}
                      </p>
                      {q.translation && (
                        <p className="text-xs text-slate-500 leading-relaxed italic border-l-2 border-slate-700 pl-2">
                          {q.translation?.split('\n')[0]}
                        </p>
                      )}
                      {q.options && q.options.length > 0 && (
                        <div className="space-y-0.5">
                          {q.options.map((opt, i) => (
                            <p key={i} className={`text-[11px] px-2 py-1 rounded ${isCorrectOpt(opt, q.correctAnswer) ? 'text-emerald-400 bg-emerald-900/20' : 'text-slate-500'}`}>
                              {opt}
                            </p>
                          ))}
                        </div>
                      )}
                      {q.correctAnswer && (
                        <p className="text-[11px] text-emerald-400 font-medium">✓ {q.correctAnswer}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {results.length > 0 && results[0].score < 0.05 && (
              <p className="text-xs text-slate-500 text-center py-2">Sin coincidencias significativas — la pregunta parece nueva.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Level 3: Exam viewer ────────────────────────────────────────────────────

const PER_PAGE = 25

function ExamViewer({ exam, provider }: { exam: ExamConfig; provider?: ProviderConfig }) {
  const [data,   setData]   = useState<ExamData | null>(null)
  const [esData, setEsData] = useState<ExamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const [activeTag,    setActiveTag]    = useState<string | null>(null)
  const [showTagPanel, setShowTagPanel] = useState(false)
  const [tagSearch,    setTagSearch]    = useState('')

  const [showExamCfg,        setShowExamCfg]        = useState(false)
  const [showSemanticSearch, setShowSemanticSearch] = useState(false)
  const [examSession, setExamSession] = useState<{
    questions: Question[]; config: ExamModeCfg; startMs: number
  } | null>(null)
  const [examResult, setExamResult] = useState<{
    questions: Question[]; answers: ExamModeAns[]; elapsedSec: number; config: ExamModeCfg
  } | null>(null)

  const startExam = (cfg: ExamModeCfg) => {
    if (!data) return
    let pool = cfg.onlyWithAnswer ? data.questions.filter(q => !!q.correctAnswer) : data.questions
    if (cfg.randomOrder) pool = [...pool].sort(() => Math.random() - 0.5)
    pool = pool.slice(0, cfg.numQuestions)
    track('exam_start', { exam: exam.code, provider: provider?.name, num_questions: pool.length })
    setExamSession({ questions: pool, config: cfg, startMs: Date.now() })
    setShowExamCfg(false)
    setExamResult(null)
  }

  const finishExam = (answers: ExamModeAns[]) => {
    if (!examSession) return
    const elapsedSec = Math.floor((Date.now() - examSession.startMs) / 1000)
    const total   = examSession.questions.length
    const skipped = answers.filter(a => !a.confirmed).length
    const correct = answers.filter((a, i) => {
      const q = examSession.questions[i]
      if (!a.confirmed || a.selected.length === 0) return false
      if (q.questionType === 'yes-no' && q.statements?.length) {
        return q.statements.every((stmt, si) => {
          const isYes = a.selected.includes(si * 2)
          return (isYes && stmt.answer === 'Yes') || (!isYes && stmt.answer === 'No')
        })
      }
      if (q.questionType === 'multi-dropdown' || q.questionType === 'hotspot') {
        return a.selected[0] === 1
      }
      const expectedCount = /^[A-E]+$/i.test(q.correctAnswer?.trim() ?? '') ? (q.correctAnswer?.trim().length ?? 1) : 1
      return a.selected.length === expectedCount && a.selected.every(si => isCorrectOpt(q.options?.[si] ?? '', q.correctAnswer))
    }).length
    const pct = Math.round((correct / (total - skipped || 1)) * 100)
    track('exam_finish', { exam: exam.code, provider: provider?.name, score_pct: pct, correct, total, skipped, passed: pct >= 70, elapsed_sec: elapsedSec })
    setExamResult({
      questions:  examSession.questions,
      answers,
      elapsedSec,
      config:     examSession.config,
    })
    setExamSession(null)
  }

  const handleTagClick = (label: string) => {
    setActiveTag(prev => prev === label ? null : label)
    setPage(1)
  }

  useEffect(() => {
    setLoading(true); setError(null); setPage(1); setSearch(''); setData(null); setEsData(null)
    fetch(exam.dataFile!)
      .then(r => { if (!r.ok) throw new Error('No se pudo cargar'); return r.json() })
      .then((d: ExamData) => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })

    const esFile = exam.dataFile!.replace(/\.json$/, '_es.json')
    fetch(esFile)
      .then(r => r.ok ? r.json() : null)
      .then((d: ExamData | null) => setEsData(d))
      .catch(() => setEsData(null))
  }, [exam.dataFile])

  // tracking de búsqueda con debounce de 1s (mínimo 3 caracteres)
  useEffect(() => {
    if (search.trim().length < 3) return
    const timer = setTimeout(() => {
      track('search', { query: search.trim(), exam: exam.code })
    }, 1000)
    return () => clearTimeout(timer)
  }, [search, exam.code])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    return data.questions.filter(item => {
      if (q) {
        const h = [item.number, item.questionText, ...(item.options || []), item.correctAnswer].join(' ').toLowerCase()
        if (!h.includes(q)) return false
      }
      if (filter === 'noanswer')   return !item.correctAnswer
      if (filter === 'withanswer') return !!item.correctAnswer
      if (filter !== 'all') { if (getType(item) !== filter) return false }
      if (activeTag) {
        if (!getQuestionTags(item).some(t => t.label === activeTag)) return false
      }
      return true
    })
  }, [data, search, filter, activeTag])

  const allTagCounts = useMemo(() => {
    if (!data) return []
    const map = new Map<string, { tag: TagDef; count: number }>()
    data.questions.forEach(q => {
      getQuestionTags(q).forEach(tag => {
        const e = map.get(tag.label)
        if (e) e.count++
        else map.set(tag.label, { tag, count: 1 })
      })
    })
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [data])

  const visibleTags = tagSearch.trim()
    ? allTagCounts.filter(({ tag }) => tag.label.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTagCounts

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const go = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
      <RefreshCw size={18} className="animate-spin" />
      <span className="text-sm">Cargando preguntas...</span>
    </div>
  )
  if (error) return <div className="text-center py-20 text-red-400 text-sm">{error}</div>
  if (!data) return null

  if (examSession) {
    return <ExamScreen questions={examSession.questions} config={examSession.config} onFinish={finishExam} />
  }

  if (examResult) {
    return (
      <ExamResults
        questions={examResult.questions}
        answers={examResult.answers}
        elapsedSec={examResult.elapsedSec}
        exam={exam}
        provider={provider}
        config={examResult.config}
        onRetry={() => { setExamResult(null); setShowExamCfg(true) }}
        onClose={() => setExamResult(null)}
      />
    )
  }

  const withAnswer   = data.questions.filter(q => q.correctAnswer).length
  const withImg      = data.questions.filter(q => q.images?.length).length
  const withNoAnswer = data.questions.filter(q => !q.correctAnswer).length

  const STAT_CARDS: { label: string; value: number; color: string; active: string; filterKey: FilterType }[] = [
    { label: 'Total',          value: data.totalQuestions, color: 'text-blue-400',    active: 'border-blue-500/60 bg-blue-500/10',    filterKey: 'all'        },
    { label: 'Con respuesta',  value: withAnswer,           color: 'text-emerald-400', active: 'border-emerald-500/60 bg-emerald-500/10', filterKey: 'withanswer' },
    { label: 'Con imagen',     value: withImg,              color: 'text-purple-400',  active: 'border-purple-500/60 bg-purple-500/10',  filterKey: 'img'        },
    { label: 'Sin respuesta',  value: withNoAnswer,         color: 'text-amber-400',   active: 'border-amber-500/60 bg-amber-500/10',    filterKey: 'noanswer'   },
  ]

  return (
    <div className="space-y-5">

      {showExamCfg && (
        <ExamConfigModal
          total={data.totalQuestions}
          withAnswer={withAnswer}
          onStart={startExam}
          onClose={() => setShowExamCfg(false)}
        />
      )}

      <div className="flex items-stretch gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          {STAT_CARDS.map(({ label, value, color, active, filterKey }) => {
            const isActive = filter === filterKey
            return (
              <button
                key={label}
                onClick={() => { setFilter(isActive ? 'all' : filterKey); setPage(1) }}
                className={`text-left px-4 py-3 rounded-xl border transition-all duration-150 ${
                  isActive
                    ? active
                    : 'bg-white/[0.04] backdrop-blur-xl border-border hover:border-slate-500 hover:bg-white/5'
                }`}
              >
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                {isActive && <p className="text-[10px] text-slate-500 mt-1">activo · clic para quitar</p>}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setShowExamCfg(true)}
          className="flex flex-col items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-500/50 transition-all text-teal-400 min-w-[90px]"
        >
          <Play size={18} />
          <span className="text-[11px] font-semibold leading-tight text-center">Modo<br/>Examen</span>
        </button>

        <button
          onClick={() => setShowSemanticSearch(v => !v)}
          className={`flex flex-col items-center justify-center gap-1.5 px-4 py-3 rounded-xl border transition-all min-w-[90px] ${
            showSemanticSearch
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              : 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 text-amber-500'
          }`}
        >
          <Search size={18} />
          <span className="text-[11px] font-semibold leading-tight text-center">Buscar<br/>duplicado</span>
        </button>
      </div>

      {showSemanticSearch && (
        <SemanticSearchPanel questions={data.questions} />
      )}

      <div className="bg-white/[0.04] backdrop-blur-xl border border-border rounded-xl overflow-hidden">

        {/* Fila única: búsqueda + tipo + concepto */}
        <div className="flex gap-2 flex-wrap items-center px-3 py-2.5 border-b border-border/60">
          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar pregunta, opción, respuesta..."
              className="w-full bg-slate-800/50 border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <select value={filter} onChange={e => { setFilter(e.target.value as FilterType); setPage(1) }}
            className="bg-slate-800/50 border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary/60 cursor-pointer">
            <option value="all">Todos los tipos</option>
            <option value="mc">Opción múltiple</option>
            <option value="yn">Sí / No</option>
            <option value="img">Con imagen</option>
            <option value="noanswer">Sin respuesta</option>
          </select>
          <button
            onClick={() => setShowTagPanel(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
              showTagPanel || activeTag
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-slate-800/50 border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            <Filter size={13} />
            <span className="font-medium">Conceptos</span>
            {activeTag && (
              <span className="text-[10px] bg-primary/30 border border-primary/50 text-primary px-1.5 py-0.5 rounded-full font-semibold max-w-[120px] truncate">
                {activeTag}
              </span>
            )}
            <span className="text-[11px] text-slate-600">({allTagCounts.length})</span>
            {activeTag && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); setActiveTag(null); setPage(1) }}
                className="text-slate-500 hover:text-red-400 transition-colors ml-0.5"
                title="Quitar filtro"
              >✕</span>
            )}
            {showTagPanel ? <ChevronUp size={13} className="ml-0.5" /> : <ChevronDown size={13} className="ml-0.5" />}
          </button>
        </div>

        {showTagPanel && (
          <div className="border-t border-border px-4 py-3 space-y-3">

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={tagSearch}
                onChange={e => setTagSearch(e.target.value)}
                placeholder="Buscar concepto..."
                className="w-full bg-slate-800/60 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary/60 transition-colors"
              />
              {tagSearch && (
                <button
                  onClick={() => setTagSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              )}
            </div>

            {visibleTags.length === 0
              ? <p className="text-xs text-slate-600 py-2">Sin resultados para &quot;{tagSearch}&quot;</p>
              : (
                <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {visibleTags.map(({ tag, count }) => {
                    const isActive = activeTag === tag.label
                    const base = TAG_COLOR[tag.color] ?? TAG_COLOR.slate
                    return (
                      <button
                        key={tag.label}
                        onClick={() => handleTagClick(tag.label)}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-100
                          ${base}
                          ${isActive
                            ? 'ring-1 ring-offset-1 ring-offset-surface ring-current scale-105'
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                          }`}
                      >
                        {isActive && <span className="text-[9px]">✕</span>}
                        {tag.label}
                        <span className="text-[10px] opacity-60 font-normal">{count}</span>
                      </button>
                    )
                  })}
                </div>
              )
            }
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{filtered.length === data.totalQuestions ? `${data.totalQuestions} preguntas` : `${filtered.length} de ${data.totalQuestions}`}</span>
        <span>Página {page} de {totalPages || 1}</span>
      </div>

      {pageItems.length === 0
        ? <div className="text-center py-20 text-slate-600"><Search size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Sin resultados</p></div>
        : <div className="space-y-2">{pageItems.map((q, i) => {
            const enIdx = data.questions.indexOf(q)
            return (
              <QuestionCard
                key={`${q.number}-${i}`}
                q={q}
                qEs={esData?.questions[enIdx]}
                index={(page - 1) * PER_PAGE + i}
                activeTag={activeTag}
                onTagClick={handleTagClick}
                examId={data.examId}
                examTopicsPath={exam.examTopicsPath}
              />
            )
          })}</div>
      }

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 flex-wrap">
          <button onClick={() => go(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-2 text-sm rounded-lg border border-border text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
              if (idx > 0 && (arr[idx - 1] as number) !== p - 1) acc.push('...')
              acc.push(p); return acc
            }, [])
            .map((p, i) => p === '...'
              ? <span key={`d${i}`} className="text-slate-600 px-1">…</span>
              : <button key={p} onClick={() => go(p as number)}
                  className={`w-9 h-9 text-sm rounded-lg border transition-colors ${page === p ? 'bg-primary border-primary text-white font-bold' : 'border-border text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  {p}
                </button>
            )}
          <button onClick={() => go(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-2 text-sm rounded-lg border border-border text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Registros (catálogo plano, editable) ────────────────────────────────────

type Estado = 'disponible' | 'proximamente' | 'descontinuado'

interface ExamMeta {
  exam_id: string
  url: string | null
  estado: Estado
  expiracion: string | null
}

interface FlatExam {
  examId: string       // p.providerId-exam.id, único global
  code: string
  name: string
  level: string
  providerName: string
  providerColor: string
  defaultEstado: Estado
}

const ESTADO_LABEL: Record<Estado, string> = {
  disponible:    'Disponible',
  proximamente:  'Próximamente',
  descontinuado: 'Descontinuado',
}
const ESTADO_COLOR: Record<Estado, string> = {
  disponible:    'text-emerald-400 bg-emerald-900/30 border-emerald-800',
  proximamente:  'text-amber-400   bg-amber-900/30   border-amber-800',
  descontinuado: 'text-slate-400   bg-slate-800/50    border-slate-700',
}

function flattenExams(): FlatExam[] {
  return PROVIDERS.flatMap(p =>
    p.exams.map(e => ({
      examId: `${p.id}__${e.id}`,
      code: e.code,
      name: e.name,
      level: e.level,
      providerName: p.alias ? `${p.name} (${p.alias})` : p.name,
      providerColor: p.color,
      defaultEstado: (e.dataFile ? 'disponible' : 'proximamente') as Estado,
    }))
  )
}

function EditExamModal({
  exam, onClose, onSaved,
}: {
  exam: FlatExam & { meta?: ExamMeta }
  onClose: () => void
  onSaved: (meta: ExamMeta) => void
}) {
  const [url, setUrl] = useState(exam.meta?.url ?? '')
  const [estado, setEstado] = useState<Estado>(exam.meta?.estado ?? exam.defaultEstado)
  const [expiracion, setExpiracion] = useState(exam.meta?.expiracion ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/certification-meta', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: exam.examId, url: url.trim() || null, estado, expiracion: expiracion || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      onSaved(json.meta as ExamMeta)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div>
            <h3 className="text-sm font-semibold text-white">{exam.code}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{exam.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://learn.microsoft.com/..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Estado</label>
            <select
              value={estado}
              onChange={e => setEstado(e.target.value as Estado)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="disponible">Disponible</option>
              <option value="proximamente">Próximamente</option>
              <option value="descontinuado">Descontinuado</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Expiración</label>
            <input
              type="date"
              value={expiracion}
              onChange={e => setExpiracion(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-xs text-rose-400">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RegistrosPanel() {
  const allExams = useMemo(() => flattenExams(), [])
  const [metaMap, setMetaMap] = useState<Record<string, ExamMeta>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<FlatExam | null>(null)

  async function load() {
    setLoading(true); setError(null); setNeedsSetup(false)
    try {
      const res = await fetch('/api/admin/certification-meta')
      const json = await res.json()
      if (!res.ok) {
        if (json.needsSetup) { setNeedsSetup(true); return }
        throw new Error(json.error || `Error ${res.status}`)
      }
      const map: Record<string, ExamMeta> = {}
      for (const m of (json.meta ?? []) as ExamMeta[]) map[m.exam_id] = m
      setMetaMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el registro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = allExams.filter(e => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return [e.code, e.name, e.providerName].join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar código, nombre o proveedor..."
            className="w-full bg-white/[0.04] backdrop-blur-xl border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
        <span className="text-xs text-slate-500">{filtered.length} de {allExams.length} registros</span>
      </div>

      {needsSetup && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          La tabla de registros aún no está creada en Supabase. Pide al administrador que ejecute el SQL de configuración inicial.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.07] overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-black/30 backdrop-blur-md border-b border-white/[0.07]">
                {['Código', 'Nombre', 'Proveedor', 'Nivel', 'Estado', 'Expiración', 'URL', 'Acción'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 size={20} className="animate-spin inline" /> <span className="ml-2 align-middle">Cargando registros…</span>
                </td></tr>
              )}
              {!loading && filtered.map(e => {
                const meta = metaMap[e.examId]
                const estado = meta?.estado ?? e.defaultEstado
                const url = meta?.url ?? null
                const expiracion = meta?.expiracion ?? null
                return (
                  <tr key={e.examId} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: e.providerColor }}>{e.code}</td>
                    <td className="px-4 py-3 text-slate-300 max-w-[260px] truncate" title={e.name}>{e.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{e.providerName}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{e.level}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[estado]}`}>
                        {ESTADO_LABEL[estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {expiracion ? (() => {
                        const d = new Date(expiracion)
                        const dd = String(d.getDate()).padStart(2, '0')
                        const mm = String(d.getMonth() + 1).padStart(2, '0')
                        return `${dd}/${mm}/${d.getFullYear()}`
                      })() : 'NA'}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px]">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 truncate transition-colors">
                          <ExternalLink size={11} className="shrink-0" /> <span className="truncate">{url}</span>
                        </a>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditing(e)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-white/[0.07] hover:bg-white/[0.05] hover:text-white transition-colors"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && !needsSetup && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditExamModal
          exam={{ ...editing, meta: metaMap[editing.examId] }}
          onClose={() => setEditing(null)}
          onSaved={(meta) => {
            setMetaMap(prev => ({ ...prev, [meta.exam_id]: meta }))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ provider, exam, onGoRoot, onGoProvider }: {
  provider?: ProviderConfig
  exam?: ExamConfig
  onGoRoot: () => void
  onGoProvider: () => void
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
      <button onClick={onGoRoot} className="hover:text-slate-300 transition-colors">Certificaciones</button>
      {provider && (
        <>
          <ChevronRight size={13} className="text-slate-700" />
          <button onClick={onGoProvider} className={`transition-colors ${exam ? 'hover:text-slate-300' : 'text-slate-300 font-medium'}`}>
            {provider.name}
          </button>
        </>
      )}
      {exam && (
        <>
          <ChevronRight size={13} className="text-slate-700" />
          <span className="text-slate-300 font-medium">{exam.code}</span>
        </>
      )}
    </nav>
  )
}

// ─── Historial ───────────────────────────────────────────────────────────────

interface HistoryRow {
  id: string
  user_id: string
  user_email: string
  provider_id: string
  provider_name: string
  exam_id: string
  exam_code: string
  exam_name: string
  score_pct: number
  correct: number
  wrong: number
  skipped: number
  total: number
  elapsed_sec: number
  config: Record<string, unknown>
  created_at: string
}

function fmtElapsed(sec: number) {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}m ${s}s`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function HistoryPanel() {
  const [rows,      setRows]      = useState<HistoryRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [examFilter, setExamFilter] = useState('')
  const [expanded,  setExpanded]  = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null); setNeedsSetup(false)
    try {
      const res  = await fetch('/api/certifications/history?limit=200')
      const json = await res.json()
      if (!res.ok) {
        if (json.needsSetup) { setNeedsSetup(true); return }
        throw new Error(json.error ?? `Error ${res.status}`)
      }
      setRows(json.rows ?? [])
      setIsAdmin(json.isAdmin ?? false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const allUsers  = useMemo(() => [...new Set(rows.map(r => r.user_email))].sort(), [rows])
  const allExams  = useMemo(() => [...new Set(rows.map(r => r.exam_code))].sort(), [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows.filter(r => {
      if (userFilter && r.user_email !== userFilter) return false
      if (examFilter && r.exam_code !== examFilter) return false
      if (q) {
        const h = [r.user_email, r.exam_code, r.exam_name, r.provider_name].join(' ').toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [rows, search, userFilter, examFilter])

  const stats = useMemo(() => {
    const total  = filtered.length
    const passed = filtered.filter(r => r.score_pct >= 70).length
    const avg    = total ? Math.round(filtered.reduce((s, r) => s + r.score_pct, 0) / total) : 0
    return { total, passed, failed: total - passed, avg }
  }, [filtered])

  if (needsSetup) return (
    <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-5 py-4 space-y-3">
      <p className="text-amber-300 font-semibold text-sm">La tabla <code>exam_history</code> no existe en Supabase.</p>
      <p className="text-amber-200/70 text-xs">Ejecuta el siguiente SQL en tu proyecto Supabase (SQL Editor):</p>
      <pre className="bg-black/40 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto whitespace-pre">{`CREATE TABLE exam_history (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id),
  user_email    text NOT NULL,
  provider_id   text NOT NULL DEFAULT '',
  provider_name text NOT NULL DEFAULT '',
  exam_id       text NOT NULL,
  exam_code     text NOT NULL,
  exam_name     text NOT NULL,
  score_pct     int  NOT NULL,
  correct       int  NOT NULL,
  wrong         int  NOT NULL,
  skipped       int  NOT NULL,
  total         int  NOT NULL,
  elapsed_sec   int  NOT NULL DEFAULT 0,
  config        jsonb,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE exam_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON exam_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_insert" ON exam_history FOR INSERT WITH CHECK (user_id = auth.uid());`}</pre>
      <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-amber-600/30 border border-amber-600/50 text-amber-300 hover:bg-amber-600/50 transition-colors">
        Reintentar
      </button>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar examen, proveedor..."
            className="w-full bg-white/[0.04] border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary/60 transition-colors" />
        </div>
        {isAdmin && allUsers.length > 1 && (
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
            className="bg-white/[0.04] border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-primary/60 transition-colors">
            <option value="">Todos los usuarios</option>
            {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
        {allExams.length > 1 && (
          <select value={examFilter} onChange={e => setExamFilter(e.target.value)}
            className="bg-white/[0.04] border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-primary/60 transition-colors">
            <option value="">Todos los exámenes</option>
            {allExams.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button onClick={load} title="Actualizar" className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-white/[0.04] text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ejecuciones', value: stats.total,  color: 'text-blue-400'    },
            { label: 'Aprobadas',   value: stats.passed,  color: 'text-emerald-400' },
            { label: 'Reprobadas',  value: stats.failed,  color: 'text-red-400'     },
            { label: 'Promedio',    value: `${stats.avg}%`, color: stats.avg >= 70 ? 'text-emerald-400' : 'text-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/[0.04] border border-border rounded-xl px-4 py-3">
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Estado */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Cargando historial…
        </div>
      )}
      {error && !loading && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      {/* Tabla */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">Sin ejecuciones registradas.</div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(row => {
            const passed = row.score_pct >= 70
            const open   = expanded === row.id
            return (
              <div key={row.id} className={`bg-white/[0.04] border rounded-xl overflow-hidden transition-all ${open ? 'border-primary/40' : 'border-border hover:border-slate-600'}`}>
                <button onClick={() => setExpanded(open ? null : row.id)}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors">
                  {/* Score badge */}
                  <span className={`shrink-0 w-12 text-center text-sm font-black rounded-lg py-1 ${passed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                    {row.score_pct}%
                  </span>
                  {/* Exam info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-200">{row.exam_code}</span>
                      <span className="text-[10px] text-slate-500 truncate">{row.exam_name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {isAdmin && <span className="text-[10px] text-slate-500">{row.user_email}</span>}
                      <span className="text-[10px] text-slate-600">{fmtDate(row.created_at)}</span>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 text-xs shrink-0">
                    <span className="text-emerald-400">{row.correct} ✓</span>
                    <span className="text-red-400">{row.wrong} ✗</span>
                    {row.skipped > 0 && <span className="text-slate-500">{row.skipped} —</span>}
                    <span className="text-slate-500">{fmtElapsed(row.elapsed_sec)}</span>
                  </div>
                  {open ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
                </button>

                {open && (
                  <div className="border-t border-border/50 px-4 py-4 space-y-3">
                    {/* Barra de progreso */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>{row.correct} correctas · {row.wrong} incorrectas{row.skipped > 0 ? ` · ${row.skipped} sin responder` : ''}</span>
                        <span>{row.total} preguntas</span>
                      </div>
                      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(row.correct / row.total) * 100}%` }} />
                        <div className="bg-red-500/70 h-full transition-all"  style={{ width: `${(row.wrong   / row.total) * 100}%` }} />
                      </div>
                    </div>
                    {/* Detalles */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wide">Proveedor</p>
                        <p className="text-slate-200 font-medium mt-0.5">{row.provider_name || '—'}</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wide">Tiempo</p>
                        <p className="text-slate-200 font-medium mt-0.5">{fmtElapsed(row.elapsed_sec)}</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wide">Resultado</p>
                        <p className={`font-bold mt-0.5 ${passed ? 'text-emerald-400' : 'text-red-400'}`}>{passed ? 'Aprobado' : 'Reprobado'}</p>
                      </div>
                      {row.config && Object.keys(row.config).length > 0 && (
                        <div className="col-span-2 sm:col-span-3 bg-white/[0.03] rounded-lg px-3 py-2">
                          <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Configuración</p>
                          <div className="flex flex-wrap gap-2">
                            {(row.config.randomOrder as boolean) && <span className="text-[10px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full">Aleatorio</span>}
                            {(row.config.onlyWithAnswer as boolean) && <span className="text-[10px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full">Solo con respuesta</span>}
                            {(row.config.translateToEs as boolean) && <span className="text-[10px] bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded-full">Traducido ESP</span>}
                            {(row.config.timeLimitMin as number) > 0 && <span className="text-[10px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full">{row.config.timeLimitMin as number} min</span>}
                          </div>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="col-span-2 sm:col-span-3 bg-white/[0.03] rounded-lg px-3 py-2">
                          <p className="text-slate-500 text-[10px] uppercase tracking-wide">Usuario</p>
                          <p className="text-slate-200 font-medium mt-0.5">{row.user_email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

type View = 'providers' | 'exams' | 'viewer'
type MainTab = 'catalogo' | 'registros' | 'historial'

export default function CertificacionesView() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [mainTab, setMainTab] = useState<MainTab>('catalogo')

  // Derivar estado desde la URL: /certificaciones[/providerId[/examId]]
  const segments       = pathname.replace(/^\/certificaciones\/?/, '').split('/').filter(Boolean)
  const providerSlug   = segments[0] ?? null
  const examSlug       = segments[1] ?? null

  const selectedProvider = providerSlug ? (PROVIDERS.find(p => p.id === providerSlug) ?? null) : null
  const selectedExam     = (selectedProvider && examSlug)
    ? (selectedProvider.exams.find(e => e.id === examSlug) ?? null)
    : null

  const view: View = selectedExam ? 'viewer' : selectedProvider ? 'exams' : 'providers'

  const selectProvider = (p: ProviderConfig) => router.push(`/certificaciones/${p.id}`)
  const selectExam     = (e: ExamConfig)      => router.push(`/certificaciones/${selectedProvider!.id}/${e.id}`)
  const goProvider     = ()                   => router.push(`/certificaciones/${selectedProvider!.id}`)
  const goProviders    = ()                   => router.push('/certificaciones')

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar
        title="Certificaciones"
        tabs={([
          { id: 'catalogo'  as MainTab, label: 'Catálogo',  icon: LayoutGrid },
          { id: 'registros' as MainTab, label: 'Registros', icon: ListChecks },
          { id: 'historial' as MainTab, label: 'Historial',  icon: Clock      },
        ]).map(({ id, label, icon: Icon }) => {
          const active = id === mainTab
          return (
            <button
              key={id}
              onClick={() => {
                setMainTab(id)
                if (id === 'catalogo') router.push('/certificaciones')
              }}
              className={`flex items-center gap-1.5 h-full px-3 text-xs font-medium border-b-2 transition-colors ${
                active
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          )
        })}
      />
      <div className="px-5 py-5 w-full space-y-4">

        {mainTab === 'registros' && <RegistrosPanel />}
        {mainTab === 'historial' && <HistoryPanel />}

        {mainTab === 'catalogo' && (
        <>
        {/* ── Nivel 1: Proveedores ── */}
        {view === 'providers' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {PROVIDERS.map(p => (
              <ProviderCard
                key={p.id}
                p={p}
                onClick={() => selectProvider(p)}
              />
            ))}
          </div>
        )}

        {/* ── Nivel 2: Exámenes ── */}
        {view === 'exams' && selectedProvider && (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={goProviders}
                title="Volver a proveedores"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="inline-flex h-11 items-center rounded-xl bg-white/10 px-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-md">
                {selectedProvider.logoImg ? (
                  <img src={selectedProvider.logoImg} alt={`Logo ${selectedProvider.name}`} className="h-6 w-auto max-w-[130px] object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <span className="text-2xl leading-none" style={{ color: selectedProvider.color }}>{selectedProvider.logo}</span>
                )}
              </span>
              <h2 className="text-lg font-bold text-white">
                {selectedProvider.name}
                {selectedProvider.alias && <span className="text-slate-500 font-normal"> ({selectedProvider.alias})</span>}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {[...selectedProvider.exams]
                .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
                .map(e => (
                  <ExamCard key={e.id} exam={e} provider={selectedProvider} onClick={() => selectExam(e)} />
                ))}
            </div>
          </>
        )}

        {/* ── Nivel 3: Viewer ── */}
        {view === 'viewer' && selectedProvider && selectedExam && (
          <>
            <div className="flex items-center gap-3 pb-2 border-b border-border">
              <button
                onClick={goProvider}
                title="Volver a exámenes"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="inline-flex h-9 items-center rounded-lg bg-white/10 px-2 ring-1 ring-inset ring-white/15 backdrop-blur-md">
                {selectedProvider.logoImg ? (
                  <img src={selectedProvider.logoImg} alt={`Logo ${selectedProvider.name}`} className="h-5 w-auto max-w-[110px] object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <span className="text-xl leading-none" style={{ color: selectedProvider.color }}>{selectedProvider.logo}</span>
                )}
              </span>
              <div>
                <h2 className="text-base font-bold text-white">{selectedExam.code} — {selectedExam.name}</h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[selectedExam.level]}`}>
                  {selectedExam.level}
                </span>
              </div>
            </div>
            <ExamViewer exam={selectedExam} provider={selectedProvider} />
          </>
        )}
        </>
        )}

      </div>
    </div>
  )
}
