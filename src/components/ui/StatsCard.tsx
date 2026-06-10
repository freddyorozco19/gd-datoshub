import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  color?: "blue" | "green" | "amber" | "rose" | "violet" | "cyan";
}

const colorMap = {
  blue:   "bg-blue-500/10 text-blue-400",
  green:  "bg-emerald-500/10 text-emerald-400",
  amber:  "bg-amber-500/10 text-amber-400",
  rose:   "bg-rose-500/10 text-rose-400",
  violet: "bg-violet-500/10 text-violet-400",
  cyan:   "bg-cyan-500/10 text-cyan-400",
};

export default function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  color = "blue",
}: StatsCardProps) {
  return (
    <div className="bg-[#111120] rounded-xl border border-white/[0.07] p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-0.5">{value}</p>
        {trend && (
          <p className="text-xs mt-1">
            <span className={trend.value >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>{" "}
            <span className="text-slate-500">{trend.label}</span>
          </p>
        )}
      </div>
    </div>
  );
}
