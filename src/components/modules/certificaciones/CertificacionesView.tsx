"use client"

import { useState, useEffect, useMemo } from 'react'
import {
  Search, ChevronDown, ChevronUp, BookOpen, CheckCircle, XCircle,
  ImageIcon, Filter, RefreshCw, ChevronRight, ArrowLeft, Lock,
  Eye, EyeOff, RotateCcw, ExternalLink,
  Play, Clock, Trophy, X, GraduationCap, AlertTriangle,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar'

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
  exams: ExamConfig[]
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'microsoft',
    name: 'Microsoft',
    color: '#0078d4',
    bgGradient: 'from-blue-950 to-slate-900',
    logo: '⊞',
    logoImg: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRPZEN2r056LDjjb6IT5qShwFPl4uJy1-BAgP0hGMmiqQ&s=10',
    exams: [
      { id: 'ai-100', code: 'AI-100', name: 'Designing/Implementing Azure AI Solution', level: 'Associate'   },
      { id: 'ai-102', code: 'AI-102', name: 'Azure AI Engineer',                        level: 'Associate'   },
      { id: 'ai-900', code: 'AI-900', name: 'Azure AI Fundamentals',                    level: 'Fundamental' },
      { id: 'az-100', code: 'AZ-100', name: 'Azure Infrastructure and Deployment',      level: 'Associate'   },
      { id: 'az-103', code: 'AZ-103', name: 'Azure Administrator',                      level: 'Associate'   },
      { id: 'az-104', code: 'AZ-104', name: 'Azure Administrator',                      level: 'Associate'   },
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
      { id: 'az-400', code: 'AZ-400', name: 'DevOps Engineer',                          level: 'Expert'      },
      { id: 'az-500', code: 'AZ-500', name: 'Azure Security Engineer',                  level: 'Associate'   },
      { id: 'az-600', code: 'AZ-600', name: 'Azure Stack Hub Operator',                 level: 'Associate'   },
      { id: 'az-700', code: 'AZ-700', name: 'Azure Network Engineer',                   level: 'Associate'   },
      { id: 'az-720', code: 'AZ-720', name: 'Troubleshooting Azure Connectivity',       level: 'Associate'   },
      { id: 'az-800', code: 'AZ-800', name: 'Windows Server Hybrid Core Infra.',        level: 'Associate'   },
      { id: 'az-801', code: 'AZ-801', name: 'Windows Server Hybrid Adv. Services',      level: 'Associate'   },
      { id: 'az-900', code: 'AZ-900', name: 'Azure Fundamentals',         dataFile: '/data/exam_63.json', questions: 472, level: 'Fundamental',  examTopicsPath: 'microsoft/az-900' },
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
      { id: 'clf-c02', code: 'CLF-C02', name: 'Cloud Practitioner',    level: 'Fundamental' },
      { id: 'saa-c03', code: 'SAA-C03', name: 'Solutions Architect',   level: 'Associate'   },
      { id: 'dva-c02', code: 'DVA-C02', name: 'Developer Associate',   level: 'Associate'   },
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
      { id: 'nse4', code: 'NSE 4', name: 'Network Security Professional',           level: 'Associate'    },
      { id: 'nse7', code: 'NSE 7', name: 'Network Security Architect',              level: 'Professional' },
    ],
  },
]

// ─── Types de preguntas ───────────────────────────────────────────────────────

interface Question {
  number: string
  questionText?: string
  options?: string[]
  correctAnswer?: string
  images?: string[]
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
  // Respuesta como letra sola (A-E): comparar primer carácter de la opción
  if (/^[A-E]$/i.test(ans)) return opt.trim().charAt(0).toUpperCase() === ans.toUpperCase()
  // Respuesta como texto completo: verificar que la respuesta contiene los primeros 12 chars de la opción
  return ans.toLowerCase().includes(opt.substring(0, 12).toLowerCase().trim())
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
  const available = p.exams.filter(e => e.dataFile).length
  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left overflow-hidden rounded-2xl border border-white/10 p-6 transition-all duration-300
        bg-gradient-to-br ${p.bgGradient}
        hover:border-white/25 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50`}
    >
      {/* resplandor de marca */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity duration-500"
        style={{ background: p.color }}
      />

      <div className="relative flex h-full flex-col">
        {/* ── top: logo + flecha ── */}
        <div className="flex items-start justify-between">
          <span className="inline-flex h-12 items-center rounded-xl bg-white/10 px-3 ring-1 ring-inset ring-white/15 backdrop-blur-md">
            {p.logoImg ? (
              <img
                src={p.logoImg}
                alt={`Logo ${p.name}`}
                className="h-7 w-auto max-w-[140px] object-contain"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <span className="text-3xl leading-none" style={{ color: p.color }}>{p.logo}</span>
            )}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition-all duration-300 group-hover:bg-white/10 group-hover:text-white group-hover:translate-x-0.5">
            <ChevronRight size={15} />
          </span>
        </div>

        {/* ── título + meta ── */}
        <div className="mt-5">
          <h3 className="text-lg font-bold text-white">{p.name}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {p.exams.length} exámenes
            {available > 0 && (
              <span className="text-emerald-400"> · {available} disponible{available > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>

        {/* ── chips de exámenes ── */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {p.exams.map(e => (
            <span
              key={e.id}
              title={`${e.name}${e.dataFile ? ' · disponible' : ' · próximamente'}`}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                e.dataFile
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.03] text-slate-500'
              }`}
            >
              {e.dataFile && <span className="h-1 w-1 rounded-full bg-emerald-400" />}
              {e.code}
            </span>
          ))}
        </div>
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
      className={`relative w-full text-left bg-surface border rounded-lg p-3 transition-all duration-200 ${
        available
          ? 'border-border hover:border-white/25 hover:bg-white/5 cursor-pointer group'
          : 'border-border/50 opacity-50 cursor-not-allowed'
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
  const [xlat,        setXlat]        = useState<{ text: string; opts: string[]; ans: string } | null>(null)
  const [xlatLoading, setXlatLoading] = useState(false)
  const [xlatError,   setXlatError]   = useState(false)

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

  const reset = () => { setSelected(null); setVerified(false); setShowAns(false) }

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
    <div className={`bg-surface border rounded-xl overflow-hidden transition-all duration-200 ${
      open ? 'border-primary/40' : 'border-border hover:border-slate-600'
    }`}>

      {/* ── Header ── */}
      <button
        onClick={handleToggleOpen}
        className="w-full text-left hover:bg-white/5 transition-colors px-4 pt-3 pb-2.5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-mono text-slate-500 shrink-0">#{index + 1}</span>
            <span className="text-sm text-slate-300 truncate">
              {shown.questionText?.split('\n')[0]?.slice(0, 110) || shown.number}
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

        {/* Fila 2: TypeBadge + tags */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <TypeBadge type={type} />
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

          {shown.images?.map((src, i) => (
            <img key={i} src={src} alt="" className="max-w-full rounded-lg border border-border"
              onError={e => (e.currentTarget.style.display = 'none')} />
          ))}

          {hasOptions && (
            <div className="space-y-2">
              {shown.options!.map((opt, i) => {
                const isSelected  = selected === i
                const isCorrect   = isCorrectOpt(opt, shown.correctAnswer)

                let cls = 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-white/5 hover:border-slate-500 cursor-pointer'
                if (!verified) {
                  if (isSelected) cls = 'bg-primary/20 border-primary/70 text-white cursor-pointer'
                } else {
                  if (isCorrect)               cls = 'bg-emerald-900/30 border-emerald-600/60 text-emerald-300 cursor-default'
                  else if (isSelected)         cls = 'bg-red-900/30 border-red-600/60 text-red-300 cursor-default'
                  else                         cls = 'bg-slate-800/30 border-slate-700/30 text-slate-500 cursor-default opacity-60'
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-all duration-150 ${cls}`}
                  >
                    {verified && isCorrect   && <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />}
                    {verified && isSelected && !isCorrect && <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                    {!verified && isSelected && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-primary bg-primary/40 shrink-0 mt-0.5" />
                    )}
                    {!verified && !isSelected && (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0 mt-0.5" />
                    )}
                    <span>{opt}</span>
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

            {hasAnswer && (
              <button
                onClick={() => setShowAns(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs font-semibold hover:bg-white/5 transition-colors ml-auto"
              >
                {showAns ? <><EyeOff size={12} /> Ocultar respuesta</> : <><Eye size={12} /> Ver respuesta</>}
              </button>
            )}
          </div>

          {(showAns || verified) && hasAnswer && (
            <div className="bg-emerald-900/15 border border-emerald-700/40 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-emerald-500 font-semibold uppercase tracking-wide mb-1">Respuesta correcta</p>
              <p className="text-sm text-emerald-300 leading-relaxed">{shown.correctAnswer}</p>
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
}
interface ExamModeAns { selected: number | null; confirmed: boolean }

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
  const [numQ,      setNumQ]      = useState<number>(25)
  const [timeLimit, setTimeLimit] = useState<number>(0)
  const [random,    setRandom]    = useState(true)
  const [onlyAns,   setOnlyAns]   = useState(true)

  const pool    = onlyAns ? withAnswer : total
  const actualQ = numQ === -1 ? pool : Math.min(numQ, pool)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-[#0D0D1A] border border-white/10 rounded-2xl shadow-2xl">

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
              { key: 'r', label: 'Orden aleatorio',              val: random,  set: setRandom  },
              { key: 'a', label: 'Solo preguntas con respuesta', val: onlyAns, set: setOnlyAns },
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
            onClick={() => onStart({ numQuestions: actualQ, timeLimitMin: timeLimit, randomOrder: random, onlyWithAnswer: onlyAns })}
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
  const [answers,     setAnswers]     = useState<ExamModeAns[]>(questions.map(() => ({ selected: null, confirmed: false })))
  const [timeLeft,    setTimeLeft]    = useState(config.timeLimitMin * 60)
  const [showExit,    setShowExit]    = useState(false)

  const [xlat,        setXlat]        = useState<{ text: string; opts: string[] } | null>(null)
  const [xlatLoading, setXlatLoading] = useState(false)
  const [xlatError,   setXlatError]   = useState(false)

  useEffect(() => { setXlat(null); setXlatError(false) }, [current])

  const translate = async () => {
    if (xlat) { setXlat(null); return }
    if (xlatLoading) return
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
      const q = questions[current]
      const [text, ...opts] = await Promise.all([
        tx(q.questionText || ''),
        ...(q.options ?? []).map(o => tx(o)),
      ])
      setXlat({ text, opts })
    } catch { setXlatError(true) }
    finally { setXlatLoading(false) }
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
    setAnswers(prev => prev.map((a, i) => i === current ? { ...a, selected: idx } : a))
  }
  const confirmAns = () => {
    if (ans.selected === null) return
    setAnswers(prev => prev.map((a, i) => i === current ? { ...a, confirmed: true } : a))
  }
  const goNext = () => {
    if (current < total - 1) setCurrent(c => c + 1)
    else onFinish(answers)
  }

  const answeredCount = answers.filter(a => a.confirmed).length

  return (
    <div className="fixed inset-0 z-40 bg-[#07070F] flex flex-col overflow-hidden">

      <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#07070F]/95 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button onClick={() => setShowExit(true)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors text-xs">
            <ArrowLeft size={14} /> Salir
          </button>

          <span className="text-xs text-slate-400">
            <span className="text-white font-bold">{current + 1}</span>/{total}
            {answeredCount > 0 && <span className="ml-2 text-slate-600">· {answeredCount} respondidas</span>}
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
            </div>
            <p className="text-white text-[15px] leading-relaxed">{displayText}</p>
          </div>

          <div className="space-y-3 mb-8">
            {displayOpts.map((opt, idx) => {
              const sel       = ans.selected === idx
              const confirmed = ans.confirmed
              const correct   = isCorrectOpt(q.options?.[idx] ?? opt, q.correctAnswer)
              let cls = 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.07] hover:border-slate-600 cursor-pointer'
              if (confirmed) {
                if (correct)      cls = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200 cursor-default'
                else if (sel)     cls = 'bg-red-500/10 border-red-500/50 text-red-300 cursor-default'
                else              cls = 'bg-white/[0.02] border-white/[0.04] text-slate-600 cursor-default'
              } else if (sel)     cls = 'bg-teal-500/10 border-teal-500/60 text-teal-200 cursor-pointer'
              return (
                <button key={idx} onClick={() => selectOpt(idx)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 flex items-start gap-3 ${cls}`}>
                  <span className="text-xs font-bold mt-0.5 flex-shrink-0 opacity-70">{opt.charAt(0)}.</span>
                  <span className="text-sm leading-relaxed flex-1">{opt.slice(opt.indexOf('.') + 1).trim()}</span>
                  {confirmed && correct && <CheckCircle size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />}
                  {confirmed && sel && !correct && <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />}
                </button>
              )
            })}
          </div>

          {!ans.confirmed ? (
            <button onClick={confirmAns} disabled={ans.selected === null}
              className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-35 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors">
              Verificar respuesta
            </button>
          ) : (
            <button onClick={goNext}
              className="w-full py-3.5 rounded-xl bg-primary hover:opacity-90 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
              {current < total - 1 ? 'Siguiente pregunta' : 'Ver resultados'}
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>

      {showExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[#0D0D1A] border border-white/10 rounded-2xl p-6 max-w-xs w-full mx-4 text-center">
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
  questions, answers, elapsedSec, onRetry, onClose,
}: {
  questions: Question[]; answers: ExamModeAns[]
  elapsedSec: number
  onRetry: () => void; onClose: () => void
}) {
  const total    = questions.length
  const correct  = answers.filter((a, i) => a.confirmed && isCorrectOpt(questions[i].options?.[a.selected!] ?? '', questions[i].correctAnswer)).length
  const skipped  = answers.filter(a => !a.confirmed).length
  const wrong    = total - correct - skipped
  const pct      = Math.round((correct / (total - skipped || 1)) * 100)
  const passed   = pct >= 70
  const [showDetail, setShowDetail] = useState(false)

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

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <button onClick={() => setShowDetail(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-sm text-slate-400">
          <span className="font-medium text-slate-300">Revisar respuestas</span>
          {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showDetail && (
          <div className="divide-y divide-white/[0.04] border-t border-white/[0.05]">
            {questions.map((q, i) => {
              const a       = answers[i]
              const selOpt  = a.selected !== null ? (q.options?.[a.selected] ?? '') : null
              const ok      = a.confirmed && selOpt ? isCorrectOpt(selOpt, q.correctAnswer) : false
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
                    <p className="text-[11px] text-emerald-400/80 ml-6">✓ {q.correctAnswer}</p>
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

// ─── Level 3: Exam viewer ────────────────────────────────────────────────────

const PER_PAGE = 25

function ExamViewer({ exam }: { exam: ExamConfig; provider?: ProviderConfig }) {
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

  const [showExamCfg, setShowExamCfg] = useState(false)
  const [examSession, setExamSession] = useState<{
    questions: Question[]; config: ExamModeCfg; startMs: number
  } | null>(null)
  const [examResult, setExamResult] = useState<{
    questions: Question[]; answers: ExamModeAns[]; elapsedSec: number
  } | null>(null)

  const startExam = (cfg: ExamModeCfg) => {
    if (!data) return
    let pool = cfg.onlyWithAnswer ? data.questions.filter(q => !!q.correctAnswer) : data.questions
    if (cfg.randomOrder) pool = [...pool].sort(() => Math.random() - 0.5)
    pool = pool.slice(0, cfg.numQuestions)
    setExamSession({ questions: pool, config: cfg, startMs: Date.now() })
    setShowExamCfg(false)
    setExamResult(null)
  }

  const finishExam = (answers: ExamModeAns[]) => {
    if (!examSession) return
    setExamResult({
      questions:  examSession.questions,
      answers,
      elapsedSec: Math.floor((Date.now() - examSession.startMs) / 1000),
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
                    : 'bg-surface border-border hover:border-slate-500 hover:bg-white/5'
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
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar pregunta, opción, respuesta..."
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500" />
          <select value={filter} onChange={e => { setFilter(e.target.value as FilterType); setPage(1) }}
            className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-primary/60 cursor-pointer">
            <option value="all">Todos los tipos</option>
            <option value="mc">Opción múltiple</option>
            <option value="yn">Sí / No</option>
            <option value="img">Con imagen</option>
            <option value="noanswer">Sin respuesta</option>
          </select>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">

        <button
          onClick={() => setShowTagPanel(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Filter size={14} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-300">Filtrar por concepto</span>
            {activeTag && (
              <span className="text-[10px] bg-primary/20 border border-primary/40 text-primary px-2 py-0.5 rounded-full font-semibold">
                {activeTag}
              </span>
            )}
            <span className="text-[11px] text-slate-600">
              {allTagCounts.length} conceptos
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeTag && (
              <button
                onClick={e => { e.stopPropagation(); setActiveTag(null); setPage(1) }}
                className="text-[11px] text-slate-500 hover:text-red-400 transition-colors px-2 py-0.5 rounded border border-slate-700 hover:border-red-500/50"
              >
                ✕ Quitar
              </button>
            )}
            {showTagPanel
              ? <ChevronUp size={14} className="text-slate-500" />
              : <ChevronDown size={14} className="text-slate-500" />
            }
          </div>
        </button>

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

// ─── Main view ────────────────────────────────────────────────────────────────

type View = 'providers' | 'exams' | 'viewer'

export default function CertificacionesView() {
  const [view, setView] = useState<View>('providers')
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null)
  const [selectedExam, setSelectedExam] = useState<ExamConfig | null>(null)

  const goRoot     = () => { setView('providers'); setSelectedProvider(null); setSelectedExam(null) }
  const goProvider = () => { setView('exams'); setSelectedExam(null) }
  const selectProvider = (p: ProviderConfig) => { setSelectedProvider(p); setView('exams') }
  const selectExam     = (e: ExamConfig)      => { setSelectedExam(e);    setView('viewer') }

  return (
    <div className="flex flex-col h-full overflow-auto bg-[#07070F]">
      <Topbar title="Certificaciones" subtitle="Exámenes de práctica por proveedor" />
      <div className="px-5 py-5 w-full space-y-4">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="mb-2">
              <Breadcrumb
                provider={selectedProvider ?? undefined}
                exam={selectedExam ?? undefined}
                onGoRoot={goRoot}
                onGoProvider={goProvider}
              />
            </div>
          </div>
          {view !== 'providers' && (
            <button
              onClick={view === 'viewer' ? goProvider : goRoot}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={15} />
              Volver
            </button>
          )}
        </div>

        {/* ── Nivel 1: Proveedores ── */}
        {view === 'providers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROVIDERS.map(p => <ProviderCard key={p.id} p={p} onClick={() => selectProvider(p)} />)}
          </div>
        )}

        {/* ── Nivel 2: Exámenes ── */}
        {view === 'exams' && selectedProvider && (
          <>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 items-center rounded-xl bg-white/10 px-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-md">
                {selectedProvider.logoImg ? (
                  <img src={selectedProvider.logoImg} alt={`Logo ${selectedProvider.name}`} className="h-6 w-auto max-w-[130px] object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <span className="text-2xl leading-none" style={{ color: selectedProvider.color }}>{selectedProvider.logo}</span>
                )}
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">{selectedProvider.name}</h2>
                <p className="text-xs text-slate-500">{selectedProvider.exams.length} exámenes · {selectedProvider.exams.filter(e => e.dataFile).length} disponibles</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {selectedProvider.exams.map(e => (
                <ExamCard key={e.id} exam={e} provider={selectedProvider} onClick={() => selectExam(e)} />
              ))}
            </div>
          </>
        )}

        {/* ── Nivel 3: Viewer ── */}
        {view === 'viewer' && selectedProvider && selectedExam && (
          <>
            <div className="flex items-center gap-3 pb-2 border-b border-border">
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

      </div>
    </div>
  )
}
