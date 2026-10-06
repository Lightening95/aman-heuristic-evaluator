import type { Metadata } from "next";
import "./globals.css";

import { PROFILE } from "@/lib/profile";

export const metadata: Metadata = {
  title: `Dashboard Heuristic Evaluator · ${PROFILE.name}`,
  description: `${PROFILE.tagline} Upload a dashboard screenshot for a scored review with annotated issues. By ${PROFILE.name}, ${PROFILE.role}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
