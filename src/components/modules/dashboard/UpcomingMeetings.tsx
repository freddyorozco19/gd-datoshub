"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";

const mockMeetings = [
  {
    id: "1",
    title: "Demo producto - Empresa ABC",
    date: "Hoy, 3:00 PM",
    status: "programada",
  },
  {
    id: "2",
    title: "Follow-up Tech Solutions",
    date: "Mañana, 10:00 AM",
    status: "programada",
  },
  {
    id: "3",
    title: "Propuesta DataCorp",
    date: "Jue 29 Mayo, 2:00 PM",
    status: "programada",
  },
];

export default function UpcomingMeetings() {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            Próximas reuniones
          </span>
        </div>
        <Link
          href="/reuniones"
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          Ver todas
        </Link>
      </div>
      <div className="divide-y divide-slate-50">
        {mockMeetings.map((m) => (
          <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-500 shrink-0">
              <CalendarDays size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {m.title}
              </p>
              <p className="text-xs text-slate-400">{m.date}</p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">
              {m.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
