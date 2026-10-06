// The heuristic rubric. Edit this file to change what the evaluator checks.
// Each layer is scored 0-100; domain packs only apply to matching dashboard types.

export type DashboardType = "analytics" | "finance" | "enterprise" | "infographic";

export interface Heuristic {
  id: string;
  name: string;
  question: string;
}

export interface Layer {
  id: string;
  name: string;
  // Omit to apply to every dashboard type.
  appliesTo?: DashboardType[];
  heuristics: Heuristic[];
}

export const DASHBOARD_TYPES: { id: DashboardType; label: string }[] = [
  { id: "analytics", label: "Analytics / data viz" },
  { id: "finance", label: "Finance" },
  { id: "enterprise", label: "Enterprise / operations" },
  { id: "infographic", label: "Infographic / editorial" },
];

export const RUBRIC: Layer[] = [
  {
    id: "usability",
    name: "Core usability",
    heuristics: [
      { id: "U1", name: "Visibility of system status", question: "Is data freshness, loading state, and last-updated time visible?" },
      { id: "U2", name: "Match with the real world", question: "Are domain terms, units, currency and time periods the ones users expect?" },
      { id: "U3", name: "User control and freedom", question: "Can users reset filters, drill back up, and undo view changes?" },
      { id: "U4", name: "Consistency and standards", question: "Does the same metric, colour, or control look and behave the same everywhere?" },
      { id: "U5", name: "Error prevention", question: "Are invalid filter combinations or misleading selections prevented?" },
      { id: "U6", name: "Recognition rather than recall", question: "Are legends, labels and active filters visible rather than hidden in hovers or memory?" },
      { id: "U7", name: "Flexibility and efficiency", question: "Are there saved views, exports, shortcuts or customisation for frequent users?" },
      { id: "U8", name: "Aesthetic and minimalist design", question: "Is every element earning its place, with no decorative noise competing with data?" },
      { id: "U9", name: "Error recovery", question: "Are empty, error and no-data states explained with a way forward?" },
      { id: "U10", name: "Help and documentation", question: "Are metric definitions and calculation notes available where needed?" },
    ],
  },
  {
    id: "dashboard",
    name: "Dashboard design",
    heuristics: [
      { id: "D1", name: "Purpose and hierarchy", question: "Is the most important KPI the most prominent, and does the screen answer a clear question?" },
      { id: "D2", name: "Layout and scanning", question: "Is content grouped logically on a consistent grid that supports F/Z reading order?" },
      { id: "D3", name: "Density and data-ink", question: "Is the ratio of data to non-data ink high, without chartjunk or overcrowding?" },
      { id: "D4", name: "Context for numbers", question: "Does each KPI have a comparison (target, previous period, benchmark) and a trend?" },
      { id: "D5", name: "Overview, zoom, details on demand", question: "Does the screen give an overview first with a clear path to detail?" },
      { id: "D6", name: "Scope clarity", question: "Is it obvious which filters, segment and time range the screen is showing?" },
    ],
  },
  {
    id: "dataviz",
    name: "Data visualization integrity",
    heuristics: [
      { id: "V1", name: "Chart type fits the task", question: "Does each chart type suit its job (comparison, trend, part-to-whole, distribution, correlation)?" },
      { id: "V2", name: "Honest axes and scales", question: "Do bar charts start at zero, are scales consistent across small multiples, and are dual axes avoided or clear?" },
      { id: "V3", name: "Labelling", question: "Do charts have titles, units and axis labels, preferring direct labels over legend lookup?" },
      { id: "V4", name: "Colour use", question: "Are categorical, sequential and diverging palettes used correctly with a limited number of hues?" },
      { id: "V5", name: "No distortion", question: "Are 3D effects, area distortion and overloaded pie/donut charts avoided?" },
      { id: "V6", name: "Number formatting", question: "Are precision, separators and K/M/B abbreviations consistent and appropriate?" },
    ],
  },
  {
    id: "accessibility",
    name: "Accessibility",
    heuristics: [
      { id: "A1", name: "Text contrast", question: "Does text meet 4.5:1 contrast (3:1 for large text)?" },
      { id: "A2", name: "Graphic contrast", question: "Do chart marks, lines and UI controls meet 3:1 contrast against their background?" },
      { id: "A3", name: "Not colour alone", question: "Is meaning (status, series, up/down) also carried by shape, label, pattern or position?" },
      { id: "A4", name: "Colour-vision safety", question: "Would the palette still be distinguishable with red-green colour blindness?" },
      { id: "A5", name: "Readable sizes", question: "Are text sizes and interactive targets large enough to read and hit?" },
    ],
  },
  {
    id: "finance",
    name: "Finance pack",
    appliesTo: ["finance"],
    heuristics: [
      { id: "F1", name: "Sign conventions", question: "Are negatives shown consistently (minus, brackets, colour plus symbol)?" },
      { id: "F2", name: "Currency and period labels", question: "Are currency, units (thousands/millions) and reporting period always stated?" },
      { id: "F3", name: "Appropriate precision", question: "Is decimal precision suited to the audience and consistent across the screen?" },
      { id: "F4", name: "Variance shown fully", question: "Are variances shown as both absolute and percentage, with clear direction?" },
      { id: "F5", name: "Reconciliation", question: "Are totals and subtotals visible so figures can be checked?" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise pack",
    appliesTo: ["enterprise"],
    heuristics: [
      { id: "E1", name: "Status semantics", question: "Are RAG/status colours consistent, defined, and accessible?" },
      { id: "E2", name: "Alert prioritisation", question: "Do the most urgent items stand out over routine information?" },
      { id: "E3", name: "Role relevance", question: "Is the content focused on what this role needs to decide or act on?" },
      { id: "E4", name: "Table usability", question: "Do tables have right-aligned numbers, clear headers, sorting cues and readable row density?" },
    ],
  },
  {
    id: "infographic",
    name: "Infographic pack",
    appliesTo: ["infographic"],
    heuristics: [
      { id: "I1", name: "Narrative flow", question: "Is there a clear reading path that tells a story from headline to detail?" },
      { id: "I2", name: "Annotated insight", question: "Is the key takeaway called out with annotation rather than left for the reader to find?" },
      { id: "I3", name: "Source and date", question: "Are data sources and dates cited?" },
    ],
  },
];

export function layersFor(type: DashboardType): Layer[] {
  return RUBRIC.filter((l) => !l.appliesTo || l.appliesTo.includes(type));
}

export function rubricAsText(layers: Layer[]): string {
  return layers
    .map(
      (l) =>
        `## Layer "${l.id}": ${l.name}\n` +
        l.heuristics.map((h) => `- ${h.id} ${h.name}: ${h.question}`).join("\n"),
    )
    .join("\n\n");
}
