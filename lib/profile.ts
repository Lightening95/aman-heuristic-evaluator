// Everything about Aman that appears on the page or in exports lives here.
// Edit the words and links in this one file; the rest of the app reads from it.

export const PROFILE = {
  name: "Aman Mujawar",
  role: "Product Designer · UX Research · Interaction Design",
  place: "IIT Delhi",
  email: "amanbdes22@gmail.com",
  links: {
    portfolio: "https://amanuxpf.framer.website",
    linkedin: "https://www.linkedin.com/in/aman-mujawar-476056250/",
    behance: "https://www.behance.net/amanmujawar",
  },

  // Shown under "Why I built this" on the page.
  why: [
    "Dashboards are where good intentions quietly fail. A bar chart starting at 4.2M instead of zero, a palette nobody can tell apart, a KPI with no comparison to judge it against — none of it looks broken, and all of it changes the decision someone makes from that screen.",
    "Heuristic evaluation catches exactly those problems, but a careful pass takes an afternoon per screen, so it usually gets skipped. This tool hands the repetitive part — walking the checklist, pointing at the element, writing it up — to a vision model, while the judgement stays a design decision: the rubric, the severity scale, and what counts as a real problem are all mine to tune.",
    "It's one of a series of AI-assisted design experiments I'm building. The rules behind it are still changing, so treat the output as a well-read second opinion, not a verdict.",
  ],

  // One-liner used in exports and meta description.
  tagline: "A heuristic evaluator for dashboard screens, built as an AI-assisted design experiment.",
} as const;

export const FEEDBACK_MAILTO =
  `mailto:${PROFILE.email}` +
  `?subject=${encodeURIComponent("Feedback on the Dashboard Heuristic Evaluator")}` +
  `&body=${encodeURIComponent(
    "Hi Aman,\n\nI tried the evaluator on a dashboard and here's what I thought:\n\n" +
      "What it got right:\n\nWhat it got wrong or missed:\n\nAnything else:\n\n",
  )}`;
