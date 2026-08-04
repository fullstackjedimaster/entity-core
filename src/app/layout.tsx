import type { Metadata } from "next";
import { Inter } from "next/font/google";

import AuthWrapper from "@/components/AuthWrapper";
import { EmbedHeightReporter, EmbedTokenListener } from "@fsj/demo-kit";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Entity Core",
  description: "Schema-driven dynamic forms and secured CRUD workflows",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <EmbedTokenListener />
        <div id="entity-core-embed-content">
          <AuthWrapper>{children}</AuthWrapper>
        </div>
        <EmbedHeightReporter contentRootId="entity-core-embed-content" />
      </body>
    </html>
  );
}
