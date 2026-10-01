import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "SalseRos — Sociales de salsa en Rosario",
  description:
    "Encontrá los próximos sociales de salsa y bachata en Rosario.",
  openGraph: {
    title: "SalseRos",
    description: "La agenda salsera de Rosario.",
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
