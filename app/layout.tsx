import type { Metadata } from "next";
import "./globals.css";

import { PROFILE } from "@/lib/profile";

export const metadata: Metadata = {
  title: `Dashboard Heuristic Evaluator · ${PROFILE.name}`,
  description: `${PROFILE.tagline} Upload a dashboard screenshot for a scored review with annotated issues. By ${PROFILE.name}, ${PROFILE.role}.`,
};

// Sets the theme before the first paint so a dark-mode visitor never sees a white flash.
const THEME_SCRIPT = `
try {
  var saved = localStorage.getItem("he-theme");
  var dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
