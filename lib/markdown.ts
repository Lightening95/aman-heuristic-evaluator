import { PROFILE } from "./profile";
import { RUBRIC } from "./rubric";
import { Report, SEVERITY_LABELS } from "./schema";

// The credit block that closes every export.
const CREDITS = [
  `## About this review`,
  ``,
  `Produced with the **Dashboard Heuristic Evaluator**, an AI-assisted design experiment by **${PROFILE.name}** — ${PROFILE.role}, ${PROFILE.place}.`,
  ``,
  `The rubric behind these scores is still being refined, so read this as a well-informed second opinion rather than a verdict. Notes on what it got right or wrong are genuinely welcome.`,
  ``,
  `- Portfolio: ${PROFILE.links.portfolio}`,
  `- LinkedIn: ${PROFILE.links.linkedin}`,
  `- Behance: ${PROFILE.links.behance}`,
  `- Email: ${PROFILE.email}`,
];

export function reportToMarkdown(report: Report, imageName: string): string {
  const layerName = (id: string) => RUBRIC.find((l) => l.id === id)?.name ?? id;
  const lines = [
    `# Heuristic review: ${imageName}`,
    ``,
    `**Overall score:** ${report.overall_score}/100 · **Type:** ${report.dashboard_type} · **Issues:** ${report.issues.length}`,
    ``,
    report.summary,
    ``,
    `## Scores by layer`,
    ``,
    `| Layer | Score | Rationale |`,
    `|---|---|---|`,
    ...report.layer_scores.map((l) => `| ${layerName(l.layer_id)} | ${l.score} | ${l.rationale.replace(/\|/g, "/")} |`),
    ``,
    `## Issues`,
    ``,
  ];
  report.issues.forEach((issue, i) => {
    lines.push(
      `### ${i + 1}. ${issue.title}`,
      ``,
      `- **Severity:** ${issue.severity} (${SEVERITY_LABELS[issue.severity]})`,
      `- **Heuristic:** ${issue.heuristic_id}`,
      `- **Evidence:** ${issue.evidence}`,
      `- **Why it matters:** ${issue.why_it_matters}`,
      `- **Fix:** ${issue.recommendation}`,
      ``,
    );
  });
  if (report.strengths.length) {
    lines.push(`## Strengths`, ``, ...report.strengths.map((s) => `- ${s}`), ``);
  }
  lines.push(
    `---`,
    ``,
    ...CREDITS,
    ``,
    `_Reviewed ${new Date(report.created_at).toLocaleString()} · model: ${report.model}_`,
  );
  return lines.join("\n");
}

// The same credits, carried inside the machine-readable export.
export function reportToJson(report: Report, imageName: string): string {
  return JSON.stringify(
    {
      screenshot: imageName,
      ...report,
      credits: {
        tool: "Dashboard Heuristic Evaluator",
        note: "An AI-assisted design experiment. The rubric is still being refined; feedback welcome.",
        author: PROFILE.name,
        role: `${PROFILE.role}, ${PROFILE.place}`,
        email: PROFILE.email,
        ...PROFILE.links,
      },
    },
    null,
    2,
  );
}
