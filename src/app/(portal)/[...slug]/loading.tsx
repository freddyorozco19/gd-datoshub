import { RefreshCw } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#07070F]">
      <div className="flex items-center gap-3 text-slate-500">
        <RefreshCw size={18} className="animate-spin" />
        <span className="text-sm">Cargando…</span>
      </div>
    </div>
  );
}
