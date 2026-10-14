import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import ToastProvider from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "cardiajuda — cuidado cardíaco contínuo",
  description: "Telemedicina focada em cuidados cardíacos: pacientes e médicos conectados.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8b008b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <div className="app-shell">{children}</div>
        <ToastProvider />
      </body>
    </html>
  );
}
