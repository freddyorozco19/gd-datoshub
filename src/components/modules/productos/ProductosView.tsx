"use client";

import { Package } from "lucide-react";
import Topbar from "@/components/layout/Topbar";

export default function ProductosView() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20">
            <Package size={28} className="text-orange-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-200">Productos</h2>
          <p className="text-sm text-slate-500 max-w-xs">
            Catálogo de productos y servicios de GrowData. Próximamente disponible.
          </p>
        </div>
      </main>
    </div>
  );
}
