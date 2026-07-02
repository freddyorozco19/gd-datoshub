import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", weight: ["300","400","500","600","700","800"] });

export const metadata: Metadata = {
  title: "GD-DatosHub | GrowData",
  description: "Hub central de datos y sistemas de información de GrowData",
  icons: { icon: "/growdata-icon.webp" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col bg-[#07070f]">{children}</body>
    </html>
  );
}
