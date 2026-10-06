import { ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { evaluateScreenshot, ImageMediaType } from "@/lib/evaluate";
import { DASHBOARD_TYPES, DashboardType } from "@/lib/rubric";

export const runtime = "nodejs";
// A thorough evaluation can take a minute or two.
export const maxDuration = 300;

const MEDIA_TYPES: ImageMediaType[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

// How many reviews one visitor may run on the demo key per day. 0 turns the demo off.
const DEMO_LIMIT = Number(process.env.DEMO_LIMIT ?? 3);

// Best-effort demo counter. It lives in memory, so it resets when the server restarts
// and is counted per server instance. Good enough to stop casual overuse of the demo key;
// it is not a hard security boundary.
const demoUse = new Map<string, number>();

function visitorId(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  return `${new Date().toISOString().slice(0, 10)}:${ip}`;
}

const demoLeft = (req: Request) => Math.max(0, DEMO_LIMIT - (demoUse.get(visitorId(req)) ?? 0));

// Tells the page which access options to offer.
export async function GET(req: Request) {
  return NextResponse.json({
    serverKey: Boolean(process.env.GEMINI_API_KEY),
    demoLimit: DEMO_LIMIT,
    demoLeft: demoLeft(req),
  });
}

export async function POST(req: Request) {
  // A visitor's own key always wins; the demo key (if any) is the fallback.
  const visitorKey = req.headers.get("x-gemini-key")?.trim() || undefined;
  const accessCode = process.env.ACCESS_CODE;
  const hasPass = Boolean(accessCode) && req.headers.get("x-access-code") === accessCode;

  if (!visitorKey) {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Add your Gemini API key to run a review." }, { status: 400 });
    }
    if (accessCode && !hasPass) {
      return NextResponse.json({ error: "Wrong or missing access code." }, { status: 401 });
    }
    // The access code is Aman's own way in, so it skips the demo counter.
    if (!hasPass && demoLeft(req) <= 0) {
      return NextResponse.json(
        {
          error:
            DEMO_LIMIT > 0
              ? `You've used all ${DEMO_LIMIT} demo reviews for today. Add your own free Gemini key to keep going — it takes a minute to create.`
              : "The demo key is switched off right now. Add your own free Gemini key to run a review.",
          needKey: true,
        },
        { status: 429 },
      );
    }
  }

  const form = await req.formData();
  const file = form.get("image");
  const typeParam = String(form.get("type") ?? "auto");
  const context = String(form.get("context") ?? "").slice(0, 2000);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No screenshot was uploaded." }, { status: 400 });
  }
  if (!MEDIA_TYPES.includes(file.type as ImageMediaType)) {
    return NextResponse.json({ error: "Upload a PNG, JPEG, WebP or GIF image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "The image is over 5 MB. Try a smaller export." }, { status: 400 });
  }
  const validTypes = ["auto", ...DASHBOARD_TYPES.map((t) => t.id)];
  const dashboardType = (validTypes.includes(typeParam) ? typeParam : "auto") as DashboardType | "auto";

  try {
    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const report = await evaluateScreenshot({
      imageBase64,
      mediaType: file.type as ImageMediaType,
      dashboardType,
      context: context || undefined,
      apiKey: visitorKey,
    });
    // Only a review that actually succeeded counts against the demo allowance.
    if (!visitorKey && !hasPass) {
      const id = visitorId(req);
      demoUse.set(id, (demoUse.get(id) ?? 0) + 1);
    }
    return NextResponse.json({ ...report, demo_left: visitorKey ? null : demoLeft(req) });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    if (err instanceof ApiError) {
      if (err.status === 503 || err.status === 500) {
        return NextResponse.json(
          { error: "Google's free Gemini models are all busy right now. Wait a minute and press Review again." },
          { status: 503 },
        );
      }
      if (err.status === 429) {
        return NextResponse.json(
          {
            error: visitorKey
              ? "Your key has hit Google's free limit. Wait a minute, or until tomorrow for the daily cap."
              : "The demo key has hit Google's free limit for now. Add your own free Gemini key, or try again later.",
            needKey: !visitorKey,
          },
          { status: 429 },
        );
      }
      if (err.status === 400 && /api key/i.test(err.message)) {
        const msg = visitorKey
          ? "That Gemini API key was rejected. Check it and try again."
          : "The demo key was rejected. Check GEMINI_API_KEY.";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      return NextResponse.json({ error: `Gemini API error (${err.status}): ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "The review failed." }, { status: 500 });
  }
}
