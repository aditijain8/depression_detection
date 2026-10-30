import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, analyze, fallbackReply, type HistoryTurn } from "@/lib/companion";

export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

async function groqReply(message: string, history: HistoryTurn[], riskLabel: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const system =
    riskLabel === "high"
      ? `${SYSTEM_PROMPT}\n\nNOTE: the latest message shows signs of serious distress. Prioritise safety, warmth and presence.`
      : SYSTEM_PROMPT;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        max_tokens: 800, // gpt-oss spends part of this on reasoning
        reasoning_effort: "low",
        messages: [{ role: "system", content: system }, ...history, { role: "user", content: message }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("[chat] Groq error", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { message?: string; session_id?: number; history?: HistoryTurn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body.message ?? "").toString().trim().slice(0, 2000);
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const history: HistoryTurn[] = (Array.isArray(body.history) ? body.history : [])
    .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
    .slice(-14)
    .map((h) => ({ role: h.role, content: h.content.slice(0, 1500) }));

  const analysis = analyze(message, history);
  const reply = (await groqReply(message, history, analysis.risk_label)) ?? fallbackReply(message, history, analysis);

  return NextResponse.json({
    reply,
    session_id: body.session_id ?? 1,
    analysis,
    crisis_alert: analysis.risk_label === "high",
  });
}
