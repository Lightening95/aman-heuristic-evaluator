import { z } from "zod";

export const SEVERITY_LABELS = ["Not a problem", "Cosmetic", "Minor", "Major", "Catastrophe"] as const;

// What the model returns. box_2d is [ymin, xmin, ymax, xmax] normalised to 0-1000,
// the convention Gemini is trained on for locating things in images.
export const ModelOutputSchema = z.object({
  detected_type: z.enum(["analytics", "finance", "enterprise", "infographic"]),
  summary: z.string(),
  layer_scores: z.array(
    z.object({
      layer_id: z.string(),
      score: z.number(),
      rationale: z.string(),
    }),
  ),
  issues: z.array(
    z.object({
      heuristic_id: z.string(),
      title: z.string(),
      severity: z.number().int(),
      evidence: z.string(),
      why_it_matters: z.string(),
      recommendation: z.string(),
      box_2d: z.array(z.number()).length(4),
    }),
  ),
  strengths: z.array(z.string()),
  suggested_components: z.array(
    z.object({
      name: z.string(),
      pattern: z.string(),
      why: z.string(),
      replaces: z.string(),
    }),
  ),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;

// Region is in 0-1000 units on each axis so it can be drawn over the screenshot at any size.
export interface Issue extends Omit<ModelOutput["issues"][number], "box_2d"> {
  region: { x: number; y: number; width: number; height: number };
}

export interface Report extends Omit<ModelOutput, "issues"> {
  issues: Issue[];
  overall_score: number;
  dashboard_type: string;
  model: string;
  created_at: string;
}
