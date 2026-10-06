import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { DashboardType, RUBRIC, layersFor, rubricAsText } from "./rubric";
import { ModelOutputSchema, ModelOutput, Report } from "./schema";

// Free-tier models, tried in order when one is overloaded. GEMINI_MODEL, if set, goes first.
// Checked against ai.google.dev/gemini-api/docs/models on 2026-10-06. Google retires model
// names for new keys, so if one starts 404ing it is dropped here and the next one is used.
const MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
].filter((m, i, all) => all.indexOf(m) === i);

// Overloaded (503), rate-limited (429) or internal (500) errors are worth retrying.
const isTransient = (err: unknown) => err instanceof ApiError && [429, 500, 503].includes(err.status);
// A 404 means this key cannot use that model name at all, so retrying it is pointless —
// move straight on to the next model in the list.
const isModelGone = (err: unknown) => err instanceof ApiError && err.status === 404;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_PROMPT = `You are a senior UX researcher and information designer running a heuristic evaluation of a dashboard screenshot.

Work through every heuristic in the rubric you are given, looking closely at the actual pixels: read the numbers, labels, axes, legends and colours. Report only problems you can point to on this screen, each with concrete evidence (quote the label, value or element). Do not report a problem you are guessing at; if something cannot be judged from a static screenshot (for example hover behaviour), skip it.

Severity uses Nielsen's scale: 1 cosmetic, 2 minor, 3 major, 4 catastrophe (misleads the user or blocks the main task). Do not report severity 0 items.

For each issue give box_2d, the bounding box of the element at fault as [ymin, xmin, ymax, xmax] normalised to 0-1000. Make the box tight around that element.

Score each layer 0-100, where 100 means no issues found for that layer and each issue lowers the score in proportion to its severity. Write recommendations a designer can act on directly. List genuine strengths worth keeping. Keep the summary to two or three sentences.

Finally, propose 3 to 6 concrete UI components or patterns this screen should adopt, in suggested_components. Name a real, recognised pattern a designer could go and build \u2014 for example a comparison matrix, breadcrumb trail, segmented control, sparkline, small multiples, bullet chart, data table with sticky header, filter chip bar, empty state, skeleton loader, drill-down drawer, annotation callout, legend with direct labels, time-range picker, KPI card with delta, progressive disclosure accordion. Do not invent names. For each one: "pattern" is the pattern's common name, "name" is what you would call it on this specific screen, "why" ties it to a problem you actually found here, and "replaces" names the element or gap on screen it would take the place of. Only propose a component that solves something you reported or observed; do not pad the list.`;

const { $schema: _ignored, ...RESPONSE_SCHEMA } = z.toJSONSchema(ModelOutputSchema);

let serverClient: GoogleGenAI | null = null;
function getClient(apiKey?: string) {
  // A visitor's own key gets a one-off client; it is never stored on the server.
  if (apiKey) return new GoogleGenAI({ apiKey });
  serverClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return serverClient;
}

export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export async function evaluateScreenshot(opts: {
  imageBase64: string;
  mediaType: ImageMediaType;
  dashboardType: DashboardType | "auto";
  context?: string;
  apiKey?: string;
}): Promise<Report> {
  const auto = opts.dashboardType === "auto";
  const layers = auto ? RUBRIC : layersFor(opts.dashboardType as DashboardType);

  const typeInstruction = auto
    ? `First decide which dashboard type this is (analytics, finance, enterprise or infographic) and set detected_type. Evaluate the general layers plus ONLY the domain pack that matches the detected type; leave the other packs out of layer_scores and issues.`
    : `This is a ${opts.dashboardType} dashboard; set detected_type to "${opts.dashboardType}". Evaluate every layer below.`;

  const userText = [
    typeInstruction,
    opts.context ? `Context from the designer about this screen:\n${opts.context}` : "",
    `# Rubric\n\n${rubricAsText(layers)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const request = (model: string) => getClient(opts.apiKey).models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: opts.mediaType, data: opts.imageBase64 } }, { text: userText }],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 32000,
    },
  });

  // Try each model twice before moving to the next one.
  let response: Awaited<ReturnType<typeof request>> | undefined;
  let model = MODELS[0];
  let lastError: unknown;
  for (const candidate of MODELS) {
    for (let attempt = 0; attempt < 2 && !response; attempt++) {
      try {
        response = await request(candidate);
        model = candidate;
      } catch (err) {
        lastError = err;
        if (isModelGone(err)) break;
        if (!isTransient(err)) throw err;
        await sleep(2000);
      }
    }
    if (response) break;
  }
  if (!response) {
    if (isModelGone(lastError)) {
      throw new Error(
        "Google no longer offers any of the models this app asks for. The model list in lib/evaluate.ts needs updating.",
      );
    }
    throw lastError;
  }

  const finish = response.candidates?.[0]?.finishReason;
  if (finish === "MAX_TOKENS") {
    throw new Error("The evaluation was too long and got cut off. Try again, or crop the screenshot.");
  }
  if (!response.text) {
    throw new Error(
      response.promptFeedback?.blockReason || finish
        ? `The model declined to evaluate this image (${response.promptFeedback?.blockReason ?? finish}).`
        : "The model returned an empty response. Try again.",
    );
  }

  let parsed: ModelOutput;
  try {
    parsed = ModelOutputSchema.parse(JSON.parse(response.text));
  } catch {
    throw new Error("The model's response could not be read as an evaluation. Try again.");
  }
  return finalise(parsed, opts.dashboardType, model);
}

function finalise(result: ModelOutput, requested: string, model: string): Report {
  const type = (requested === "auto" ? result.detected_type : requested) as DashboardType;
  const allowed = new Set(layersFor(type).map((l) => l.id));
  const allowedHeuristics = new Set(layersFor(type).flatMap((l) => l.heuristics.map((h) => h.id)));
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  const layer_scores = result.layer_scores
    .filter((s) => allowed.has(s.layer_id))
    .map((s) => ({ ...s, score: Math.round(clamp(s.score, 0, 100)) }));

  const issues = result.issues
    .filter((i) => allowedHeuristics.has(i.heuristic_id))
    .map(({ box_2d, ...i }) => {
      const [y0, x0, y1, x1] = box_2d.map((n) => clamp(n, 0, 1000));
      return {
        ...i,
        severity: clamp(Math.round(i.severity), 1, 4),
        region: {
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          width: Math.abs(x1 - x0),
          height: Math.abs(y1 - y0),
        },
      };
    })
    .sort((a, b) => b.severity - a.severity);

  const overall_score = layer_scores.length
    ? Math.round(layer_scores.reduce((sum, s) => sum + s.score, 0) / layer_scores.length)
    : 0;

  return {
    detected_type: type,
    summary: result.summary,
    strengths: result.strengths,
    suggested_components: result.suggested_components,
    dashboard_type: type,
    layer_scores,
    issues,
    overall_score,
    model,
    created_at: new Date().toISOString(),
  };
}
