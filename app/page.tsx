"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DASHBOARD_TYPES, RUBRIC } from "@/lib/rubric";
import { Report, SEVERITY_LABELS } from "@/lib/schema";
import { reportToMarkdown, reportToJson } from "@/lib/markdown";
import { FEEDBACK_MAILTO, PROFILE } from "@/lib/profile";

const MAX_EDGE = 2400;
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

const sevColor = (s: number) => `var(--sev-${s})`;
const layerName = (id: string) => RUBRIC.find((l) => l.id === id)?.name ?? id;
const heuristicName = (id: string) =>
  RUBRIC.flatMap((l) => l.heuristics).find((h) => h.id === id)?.name ?? id;

// Shrinks very large screenshots so the upload stays under the API's image limits.
async function prepareImage(file: File): Promise<{ blob: Blob; url: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_UPLOAD_BYTES && file.type !== "image/gif") {
    return { blob: file, url: URL.createObjectURL(file) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
  if (blob.size > MAX_UPLOAD_BYTES) {
    blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.9));
  }
  return { blob, url: URL.createObjectURL(blob) };
}

function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

type Access = { serverKey: boolean; demoLimit: number; demoLeft: number };

export default function Home() {
  const [image, setImage] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [type, setType] = useState("auto");
  const [context, setContext] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [ownKey, setOwnKey] = useState("");
  const [mode, setMode] = useState<"demo" | "own">("demo");
  const [access, setAccess] = useState<Access>({ serverKey: true, demoLimit: 3, demoLeft: 3 });
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pendingExport, setPendingExport] = useState<"md" | "json" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("he-access-code");
      if (saved) setAccessCode(saved);
      const savedKey = localStorage.getItem("he-gemini-key");
      if (savedKey) {
        setOwnKey(savedKey);
        setMode("own");
      }
    } catch {}
    fetch("/api/evaluate")
      .then((r) => r.json())
      .then((d: Access) => {
        setAccess(d);
        if (!d.serverKey) setMode("own");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Upload a PNG, JPEG or WebP screenshot.");
      return;
    }
    setError(null);
    setReport(null);
    const prepared = await prepareImage(file);
    setImage({ ...prepared, name: file.name });
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) onFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  const usingOwnKey = mode === "own" && ownKey.trim().length > 0;
  const demoSpent = access.serverKey && access.demoLeft <= 0;
  const canRun = Boolean(image) && !loading && (usingOwnKey || (mode === "demo" && access.serverKey && !demoSpent));

  async function run() {
    if (!image) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setActive(null);
    try {
      const form = new FormData();
      form.append("image", image.blob, image.name);
      form.append("type", type);
      form.append("context", context);
      const headers: Record<string, string> = {};
      if (usingOwnKey) headers["x-gemini-key"] = ownKey.trim();
      else if (accessCode) headers["x-access-code"] = accessCode;
      const res = await fetch("/api/evaluate", { method: "POST", body: form, headers });
      const data = await res.json().catch(() => ({ error: `Server error (${res.status}).` }));
      if (res.status === 401) setNeedsCode(true);
      if (data?.needKey) setMode("own");
      if (!res.ok) throw new Error(data.error ?? `Server error (${res.status}).`);
      try {
        if (accessCode) localStorage.setItem("he-access-code", accessCode);
        if (usingOwnKey) localStorage.setItem("he-gemini-key", ownKey.trim());
      } catch {}
      if (typeof data.demo_left === "number") setAccess((a) => ({ ...a, demoLeft: data.demo_left }));
      setReport(data as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const baseName = image?.name.replace(/\.[^.]+$/, "") ?? "dashboard";

  function runExport(kind: "md" | "json") {
    if (!report || !image) return;
    if (kind === "md") download(`${baseName}-review.md`, reportToMarkdown(report, image.name), "text/markdown");
    else download(`${baseName}-review.json`, reportToJson(report, image.name), "application/json");
    setPendingExport(null);
  }

  return (
    <main className="page">
      <header className="header">
        <div className="brand">
          <p className="eyebrow">AI-assisted design experiment</p>
          <h1>Dashboard Heuristic Evaluator</h1>
          <p className="lede">
            Upload a dashboard screenshot and get a scored heuristic review: what's wrong, where it is on the screen,
            how serious it is, and what to do about it.
          </p>
          <p className="byline">
            Built by{" "}
            <a href={PROFILE.links.portfolio} target="_blank" rel="noopener noreferrer">
              {PROFILE.name}
            </a>
            , {PROFILE.role.split(" · ")[0]} at {PROFILE.place}
          </p>
          <nav className="links" aria-label="Aman Mujawar's profiles">
            <a href={PROFILE.links.portfolio} target="_blank" rel="noopener noreferrer">
              Portfolio
            </a>
            <a href={PROFILE.links.linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
            <a href={PROFILE.links.behance} target="_blank" rel="noopener noreferrer">
              Behance
            </a>
            <a href={FEEDBACK_MAILTO}>Email</a>
          </nav>
        </div>
      </header>

      <section className="card setup">
        <div
          className={`drop ${drag ? "drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFile(e.dataTransfer.files[0]);
          }}
        >
          {image ? (
            <img src={image.url} alt="Uploaded screenshot" />
          ) : (
            <>
              <strong>Drop a dashboard screenshot here</strong>
              <span className="hint">or click to choose a file, or paste with Ctrl+V</span>
              <span className="hint">PNG, JPEG or WebP · nothing is stored after the review</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        <div>
          <div className="field">
            <label htmlFor="type">What kind of dashboard is this?</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="auto">Work it out for me</option>
              {DASHBOARD_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <span className="hint-text">Picking a type turns on the extra checks for that kind of screen.</span>
          </div>

          <div className="field">
            <label htmlFor="context">Who is it for? (optional)</label>
            <textarea
              id="context"
              placeholder="e.g. 'CFO reviewing weekly cash position before a Monday call'"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <span className="hint-text">A line of context makes the findings noticeably sharper.</span>
          </div>

          <div className="field">
            <label id="access-label">Which key should run the review?</label>
            <div className="segmented" role="radiogroup" aria-labelledby="access-label">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "demo"}
                className={mode === "demo" ? "on" : ""}
                disabled={!access.serverKey}
                onClick={() => setMode("demo")}
              >
                Aman&apos;s demo key
                <small>
                  {!access.serverKey
                    ? "Not available here"
                    : demoSpent
                      ? "Used up for today"
                      : `${access.demoLeft} of ${access.demoLimit} reviews left today`}
                </small>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "own"}
                className={mode === "own" ? "on" : ""}
                onClick={() => setMode("own")}
              >
                My own key
                <small>Free from Google · no limit from us</small>
              </button>
            </div>
            {mode === "own" && (
              <>
                <input
                  id="key"
                  type="password"
                  placeholder="Paste your Gemini API key"
                  value={ownKey}
                  onChange={(e) => setOwnKey(e.target.value)}
                />
                <span className="hint-text">
                  Create one free at{" "}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                    Google AI Studio
                  </a>
                  . It stays in your browser and is sent only to Google to run your review.
                </span>
              </>
            )}
            {mode === "demo" && access.serverKey && !demoSpent && (
              <span className="hint-text">Shared allowance, so it can run out. Your own key never does.</span>
            )}
            {mode === "demo" && access.serverKey && demoSpent && (
              <span className="hint-text">
                That's the demo used up for today. Switch to your own key to keep going — it&apos;s free and takes about
                a minute to set up.
              </span>
            )}
          </div>

          {needsCode && mode === "demo" && (
            <div className="field">
              <label htmlFor="code">Access code</label>
              <input id="code" type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />
            </div>
          )}

          <button className="btn" disabled={!canRun} onClick={run}>
            {loading ? "Reviewing…" : "Review this screen"}
          </button>
          {loading && (
            <div className="progress">
              <span className="spinner" /> Walking the rubric, checking every chart and label ({elapsed}s). Usually
              about a minute.
            </div>
          )}
          {error && <div className="error">{error}</div>}
        </div>
      </section>

      {report && image && (
        <section className="report">
          <div className="card summary">
            <ScoreRing score={report.overall_score} />
            <div>
              <div className="meta">
                <span className="pill">{DASHBOARD_TYPES.find((t) => t.id === report.dashboard_type)?.label}</span>
                <span className="pill">{report.issues.length} issues</span>
                {[4, 3].map((s) => {
                  const n = report.issues.filter((i) => i.severity === s).length;
                  return n ? (
                    <span key={s} className="pill" style={{ color: sevColor(s) }}>
                      {n} {SEVERITY_LABELS[s].toLowerCase()}
                    </span>
                  ) : null;
                })}
              </div>
              <p style={{ margin: 0 }}>{report.summary}</p>
              <div className="layers">
                {report.layer_scores.map((l) => (
                  <div className="layer" key={l.layer_id} tabIndex={0}>
                    <div className="name">{layerName(l.layer_id)}</div>
                    <div className="num">{l.score}</div>
                    <div className="bar">
                      <div style={{ width: `${l.score}%` }} />
                    </div>
                    <div className="popover">
                      <strong>
                        {layerName(l.layer_id)} · {l.score}/100
                      </strong>
                      <span>{l.rationale}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="workspace">
            <div className="card canvas">
              <div className="shot">
                <img src={image.url} alt="Evaluated screenshot" />
                {report.issues.map((issue, i) => {
                  const r = issue.region;
                  const style = { "--c": sevColor(issue.severity) } as React.CSSProperties;
                  return (
                    <div key={i}>
                      <div
                        className={`box ${active === i ? "active" : ""}`}
                        style={{
                          ...style,
                          left: `${r.x / 10}%`,
                          top: `${r.y / 10}%`,
                          width: `${r.width / 10}%`,
                          height: `${r.height / 10}%`,
                        }}
                      />
                      <button
                        className={`pin ${active === i ? "active" : ""}`}
                        style={{ ...style, left: `${r.x / 10}%`, top: `${r.y / 10}%` }}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => {
                          setActive(i);
                          document.getElementById(`issue-${i}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }}
                        aria-label={`Issue ${i + 1}`}
                      >
                        {i + 1}
                      </button>
                      {active === i && (
                        <div
                          className={`pin-popup ${r.x > 550 ? "left" : ""}`}
                          style={{ ...style, left: `${r.x / 10}%`, top: `${r.y / 10}%` }}
                        >
                          <span className="sev">
                            {issue.severity} · {SEVERITY_LABELS[issue.severity]}
                          </span>
                          <strong>{issue.title}</strong>
                          <span className="fix">{issue.recommendation}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="issues">
              <div className="toolbar">
                <h2>What to fix</h2>
                <span className="help" tabIndex={0} aria-label="What the severity numbers mean">
                  ?
                  <span className="popover">
                    <strong>Severity</strong>
                    <span>1 cosmetic · 2 minor · 3 major · 4 catastrophe (misleads the viewer or blocks the task).</span>
                    <span>Hover a card or a numbered pin to see where on the screen it is.</span>
                  </span>
                </span>
                <button className="btn secondary" onClick={() => setPendingExport("md")}>
                  Export Markdown
                </button>
                <button className="btn secondary" onClick={() => setPendingExport("json")}>
                  Export JSON
                </button>
              </div>
              {report.issues.length === 0 && (
                <div className="card issue">Nothing flagged against the rubric. Worth a human pass anyway.</div>
              )}
              {report.issues.map((issue, i) => (
                <article
                  key={i}
                  id={`issue-${i}`}
                  className={`card issue ${active === i ? "active" : ""}`}
                  style={{ "--c": sevColor(issue.severity) } as React.CSSProperties}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <h3>
                    <span className="num">{i + 1}</span> {issue.title}
                  </h3>
                  <div className="tags">
                    <span className="sev">
                      {issue.severity} · {SEVERITY_LABELS[issue.severity]}
                    </span>
                    <span className="pill">
                      {issue.heuristic_id} {heuristicName(issue.heuristic_id)}
                    </span>
                  </div>
                  <dl>
                    <dt>Evidence</dt>
                    <dd>{issue.evidence}</dd>
                    <dt>Why it matters</dt>
                    <dd>{issue.why_it_matters}</dd>
                    <dt>Fix</dt>
                    <dd>{issue.recommendation}</dd>
                  </dl>
                </article>
              ))}
            </div>
          </div>

          {report.strengths.length > 0 && (
            <div className="card strengths">
              <h2>Worth keeping</h2>
              <ul>
                {report.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {pendingExport && (
        <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={() => setPendingExport(null)}>
          <div className="dialog card" onClick={(e) => e.stopPropagation()}>
            <h2 id="dlg-title">One thing before you take this away</h2>
            <p>
              The rules behind these scores are still being tuned. {PROFILE.name.split(" ")[0]} is actively refining
              what the evaluator checks and what counts as a serious problem.
            </p>
            <p>
              If a finding felt wrong, or it missed something obvious on your screen, that's exactly what he'd like to
              hear.
            </p>
            <div className="dialog-actions">
              <a className="btn secondary" href={FEEDBACK_MAILTO}>
                Send feedback
              </a>
              <button className="btn" onClick={() => runExport(pendingExport)}>
                Download {pendingExport === "md" ? "Markdown" : "JSON"}
              </button>
            </div>
            <button className="dialog-close" onClick={() => setPendingExport(null)} aria-label="Close">
              ×
            </button>
          </div>
        </div>
      )}

      <footer className="site-footer">
        <div className="about">
          <h2>Why I built this</h2>
          {PROFILE.why.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="contact card">
          <p className="eyebrow">Made by</p>
          <h3>{PROFILE.name}</h3>
          <p className="role">
            {PROFILE.role}
            <br />
            {PROFILE.place}
          </p>
          <nav className="links stacked" aria-label="Contact Aman Mujawar">
            <a href={PROFILE.links.portfolio} target="_blank" rel="noopener noreferrer">
              Portfolio ↗
            </a>
            <a href={PROFILE.links.linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn ↗
            </a>
            <a href={PROFILE.links.behance} target="_blank" rel="noopener noreferrer">
              Behance ↗
            </a>
            <a href={FEEDBACK_MAILTO}>{PROFILE.email}</a>
          </nav>
        </div>
        <p className="smallprint">
          Findings are generated by AI from a static screenshot and should be checked by a designer. Interactive
          behaviour — hover, filtering, loading states — can't be judged from an image. Screenshots are sent to Google's
          Gemini API for the review and are not stored by this site.
        </p>
      </footer>
    </main>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--good)" : score >= 60 ? "var(--sev-2)" : "var(--sev-4)";
  return (
    <div className="score-ring">
      <svg width="120" height="120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <div className="value">
        <strong>{score}</strong>
        <span>out of 100</span>
      </div>
    </div>
  );
}
