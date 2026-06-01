import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GD-DatosHub | GrowData",
  description: "Hub central de datos y sistemas de información de GrowData",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50">{children}</body>
    </html>
  );
}
