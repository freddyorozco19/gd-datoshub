"use client";

import { Users } from "lucide-react";
import Link from "next/link";

const STAGE_COLORS: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  contactado: "bg-sky-100 text-sky-700",
  calificado: "bg-violet-100 text-violet-700",
  propuesta: "bg-amber-100 text-amber-700",
  negociacion: "bg-orange-100 text-orange-700",
  ganado: "bg-emerald-100 text-emerald-700",
  perdido: "bg-slate-100 text-slate-500",
};

const mockLeads = [
  { id: "1", name: "Empresa ABC S.A.S", stage: "propuesta", company: "Sector Público" },
  { id: "2", name: "Tech Solutions Ltda", stage: "calificado", company: "Tecnología" },
  { id: "3", name: "DataCorp Colombia", stage: "negociacion", company: "Servicios" },
  { id: "4", name: "Ministerio de TIC", stage: "nuevo", company: "Gobierno" },
];

export default function RecentLeadsTable() {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Leads recientes</span>
        </div>
        <Link
          href="/leads"
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          Ver todos
        </Link>
      </div>
      <div className="divide-y divide-slate-50">
        {mockLeads.map((lead) => (
          <div
            key={lead.id}
            className="flex items-center justify-between px-5 py-3.5"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">{lead.name}</p>
              <p className="text-xs text-slate-400">{lead.company}</p>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_COLORS[lead.stage]}`}
            >
              {lead.stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
