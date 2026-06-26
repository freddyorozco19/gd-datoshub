import Sidebar from "@/components/layout/Sidebar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* fondo decorativo — manchas orgánicas difusas, fijas al viewport, detrás de todo
            el contenido de cualquier página. Da pie al efecto "liquid glass" de los paneles. */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 right-[5%] w-[480px] h-[420px] bg-indigo-500/25 blur-[120px]"
            style={{ borderRadius: "62% 38% 45% 55% / 55% 45% 60% 40%" }} />
          <div className="absolute top-[22%] left-[28%] w-[380px] h-[340px] bg-sky-500/20 blur-[110px]"
            style={{ borderRadius: "40% 60% 55% 45% / 45% 55% 40% 60%" }} />
          <div className="absolute top-[2%] left-[8%] w-[340px] h-[380px] bg-slate-300/10 blur-[120px]"
            style={{ borderRadius: "55% 45% 60% 40% / 40% 60% 45% 55%" }} />
          <div className="absolute top-[48%] right-[18%] w-[320px] h-[300px] bg-teal-400/20 blur-[110px]"
            style={{ borderRadius: "45% 55% 40% 60% / 60% 40% 55% 45%" }} />
        </div>
        {children}
      </div>
    </div>
  );
}
