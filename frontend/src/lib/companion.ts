import type { AnalysisResult, RiskLabel } from "@/types";

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export const SYSTEM_PROMPT = `You are Aura, a warm, emotionally attuned supportive companion in a mental-wellbeing app. You are NOT a doctor and never diagnose, but you talk the way a caring, steady friend with good listening skills would.

How you talk:
- Respond to what the person ACTUALLY just said. If they greet you ("hi", "hello", "hey"), greet them back warmly and invite them to share, in one or two short sentences. Do not jump into heavy topics they have not raised.
- Match their energy and length. Short casual message -> short warm reply. Someone pouring their heart out -> a fuller reply.
- First reflect the specific feeling or situation in your own words (show you really heard them, use their details), validate it, THEN, only if it fits, ask ONE gentle open question. Never ask more than one question.
- Sound human: natural, plain language, contractions. No bullet lists, headings, or clinical jargon. Usually 2-5 sentences.
- Never open with "I'm sorry to hear that" every time, and never repeat phrases you already used earlier in the conversation. Vary your wording.
- Don't rush to fix. Offer a coping idea (breathing, grounding, a small step, reaching out to someone) only when they seem ready or ask, and offer it as an invitation, not an order.
- Don't be preachy, don't lecture, don't say "as an AI". Don't over-recommend therapy; mention professional help gently when the pain is persistent or heavy.
- Celebrate good news genuinely. Not every message is a crisis.
- If they mention suicide, self-harm, or not wanting to be alive: stay calm and close, take it seriously, thank them for telling you, ask directly and kindly whether they are thinking of ending their life or are safe right now, encourage them to contact local emergency services or a crisis line (in the US call or text 988; elsewhere findahelpline.com), and encourage reaching a trusted person. Do not leave them alone in the conversation.`;

const NEGATIVE: Record<string, string[]> = {
  sadness: ["sad", "depressed", "down", "empty", "hopeless", "crying", "cry", "miserable", "unhappy", "numb", "grief", "heartbroken", "low"],
  anxiety: ["anxious", "anxiety", "worried", "worry", "panic", "nervous", "scared", "afraid", "overwhelmed", "stressed", "stress", "on edge"],
  loneliness: ["lonely", "alone", "isolated", "nobody", "no one", "no friends", "left out", "invisible"],
  exhaustion: ["tired", "exhausted", "drained", "burnt out", "burned out", "can't sleep", "insomnia", "no energy", "fatigue"],
  anger: ["angry", "furious", "frustrated", "irritated", "annoyed", "hate", "resent"],
  worthlessness: ["worthless", "useless", "failure", "burden", "stupid", "not good enough", "hate myself", "ashamed", "guilty"],
};
const POSITIVE = ["happy", "good", "great", "better", "joy", "love", "excited", "calm", "peaceful", "grateful", "proud", "relieved", "amazing", "wonderful", "fine", "okay", "ok", "got the job", "promoted", "passed", "won", "excited", "thrilled", "accepted", "succeeded", "finally"];
const CRISIS = [
  "kill myself", "end my life", "suicide", "suicidal", "want to die", "wanna die", "better off dead", "don't want to live", "dont want to live",
  "no reason to live", "end it all", "hurt myself", "harm myself", "self harm", "self-harm", "cut myself", "take my own life", "not wake up",
];

const CRISIS_RE = /(don'?t|do not|dont|no longer|never)\s+(want|wanna)\s+to\s+(live|be alive|exist|be here|wake up)|(wish|hope)\s+i\s+(was|were)\s+(dead|never born)|(want|wanna|going|plan(ning)?)\s+to\s+(die|disappear forever)|(end|ending)\s+(it all|everything|my life)|kill(ing)?\s+myself/;
const isCrisis = (t: string) => CRISIS.some((w) => t.includes(w)) || CRISIS_RE.test(t);

function has(text: string, w: string) {
  return text.includes(w);
}

// "not good", "don't feel great", "not okay" etc. mean the opposite of the positive word
const NEGATED_POS_RE = /\b(not|n't|never|no|isn'?t|aren'?t|wasn'?t|don'?t|doesn'?t|didn'?t|cannot|can'?t|hardly)\b(\s+\w+){0,2}?\s+(good|great|well|fine|okay|ok|happy|better|alright|right)\b/g;

export function analyze(message: string, history: HistoryTurn[] = []): AnalysisResult {
  const original = message.toLowerCase();
  const negated = (original.match(NEGATED_POS_RE) ?? []).length;
  const t = original.replace(NEGATED_POS_RE, " ");
  const recentUser = history.filter((h) => h.role === "user").slice(-3).map((h) => h.content.toLowerCase());

  let emotion = "neutral";
  let negCount = 0;
  let best = 0;
  for (const [label, words] of Object.entries(NEGATIVE)) {
    const c = words.filter((w) => has(t, w)).length;
    negCount += c;
    if (c > best) {
      best = c;
      emotion = label;
    }
  }
  const posCount = POSITIVE.filter((w) => new RegExp(`\\b${w}\\b`).test(t)).length;
  if (negated > 0 && negCount === 0) {
    negCount = negated;
    emotion = "sadness";
  } else if (posCount > 0 && negCount === 0) emotion = "joy";
  const crisis = isCrisis(t);
  const priorNeg = recentUser.reduce(
    (n, m) => n + Object.values(NEGATIVE).flat().filter((w) => has(m, w)).length,
    0
  );

  let risk = 0.12 + Math.min(negCount, 4) * 0.14 + Math.min(priorNeg, 4) * 0.03 - Math.min(posCount, 2) * 0.06;
  if (crisis) risk = 0.95;
  risk = Math.max(0.03, Math.min(0.99, risk));
  const label: RiskLabel = risk >= 0.65 ? "high" : risk >= 0.35 ? "medium" : "low";

  if (emotion === "neutral" && posCount > 0) emotion = "joy";
  const sentiment = crisis ? -0.9 : Math.max(-1, Math.min(1, (posCount - negCount) * 0.25));
  const stop = new Set(["this", "that", "with", "have", "just", "been", "feel", "feeling", "really", "about", "what", "were", "they", "them", "very", "much", "like"]);
  const keywords = Array.from(new Set(t.replace(/[^a-z\s']/g, " ").split(/\s+/).filter((w) => w.length > 3 && !stop.has(w)))).slice(0, 5);

  return {
    sentiment_score: parseFloat(sentiment.toFixed(3)),
    risk_score: parseFloat(risk.toFixed(3)),
    risk_label: label,
    top_keywords: keywords.length ? keywords : ["feeling", "today"],
    confidence: crisis ? 0.95 : parseFloat((0.65 + Math.min(negCount + posCount, 3) * 0.08).toFixed(3)),
    emotion_label: emotion,
  };
}

// ---------- Local fallback responder (used when no GROQ_API_KEY) ----------

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Turn "my boss yelled at me" style fragments into something we can echo back.
function topicOf(msg: string): string | null {
  const m = msg.match(/\b(?:because of|about|with|at|after|when|since)\s+(my\s+[a-z]+(?:\s+[a-z]+)?|work|school|college|exams?|the job|my job|him|her|them|everything)\b/i);
  return m ? m[1].toLowerCase() : null;
}

export function fallbackReply(message: string, history: HistoryTurn[], analysis: AnalysisResult): string {
  const raw = message.trim();
  const t = raw.toLowerCase().replace(/[!.?]+$/g, "").trim();
  const seed = hash(raw) + history.length;
  const turn = history.filter((h) => h.role === "user").length; // 0 = first message
  const lastAssistant = [...history].reverse().find((h) => h.role === "assistant")?.content ?? "";
  const used = (s: string) => lastAssistant.includes(s);

  if (isCrisis(t)) {
    return "Thank you for telling me this. I'm really glad you did, and I'm taking it seriously. You don't have to carry this alone right now. Are you thinking about ending your life, and are you safe at this moment? If you might act on these thoughts, please call or text 988 (in the US) or your local emergency number right now, or tell someone near you. If you're elsewhere, findahelpline.com lists lines by country. I'm here and I'm staying with you in this conversation.";
  }

  if (/^(hi+|hii+|hello+|hey+|heya|hiya|yo|sup|good (morning|afternoon|evening)|namaste|howdy)\b/.test(t) && t.split(/\s+/).length <= 4) {
    const greetings = [
      "Hello! I'm really glad you stopped by. How are you feeling today?",
      "Hi there 😊 It's good to see you. How's your day been so far?",
      "Hey! Welcome. Take your time, there's no rush. What's on your mind today?",
    ];
    return pick(greetings, seed);
  }

  if (/^how are you/.test(t) || /^how('s| is) it going/.test(t) || /^what'?s up/.test(t)) {
    return "Thanks for asking, that's kind of you. I'm here and fully focused on you. How are *you* doing today, really?";
  }

  if (/^(thanks|thank you|thx|ty)\b/.test(t)) {
    return "You're very welcome. I'm glad this helped, even a little. Is there anything else weighing on you that you'd like to talk through?";
  }

  if (/^(bye|goodbye|good night|gn|see you|talk later)\b/.test(t)) {
    return "Take good care of yourself. Be gentle with yourself tonight. I'll be here whenever you want to talk again. 💙";
  }

  if (/^(ok|okay|k|hmm+|idk|i don'?t know|nothing|not much|nm)$/.test(t)) {
    return pick(
      [
        "That's completely okay. You don't need the right words. Sometimes it helps to start small: if you had to describe today in one word, what would it be?",
        "No pressure at all. We can just sit with it for a moment. Is it more of a heavy feeling, a tired one, or something you can't quite name?",
      ],
      seed
    );
  }

  if (/^(yes|yeah|yep|yup|sure|please)$/.test(t) && /breath|exercise|try/i.test(lastAssistant)) {
    return "Okay, let's do it together. Breathe in slowly through your nose for 4 counts, hold gently for 4, then breathe out through your mouth for 6. We'll repeat that three times. Tell me how your body feels afterwards, no rush.";
  }

  if (/\b(help|what should i do|what do i do|advice|suggest)\b/.test(t)) {
    return "I'm happy to help us find something small that could ease things a bit. Often the best first step is the tiniest one: a glass of water, stepping outside for two minutes, or messaging one person you trust. What feels doable for you right now?";
  }

  const topic = topicOf(raw);
  const echo = topic ? ` with ${topic}` : "";

  if (analysis.risk_label === "high") {
    return `That sounds incredibly heavy, and I'm so sorry you're carrying this${echo}. Thank you for trusting me with it. You deserve support, and you don't have to push through alone. What has felt the hardest part of it today? And is there someone you trust who could be with you or check in on you?`;
  }

  const byEmotion: Record<string, string[]> = {
    sadness: [
      `I can hear how much sadness is in that${echo}. It makes sense that you feel this way, and you don't have to hide it here. When did it start feeling this heavy?`,
      `That sounds really painful. Feeling low${echo} can be so draining, especially when it lingers. I'm right here with you. What does it feel like for you in a typical moment right now?`,
      `Thank you for putting that into words, it's not easy. Feeling this way isn't a weakness. Do you want to tell me what's been weighing on you the most?`,
    ],
    anxiety: [
      `That sounds exhausting, to have your mind racing like that${echo}. Anxiety can make everything feel urgent at once. What's the thought that keeps coming back the loudest?`,
      `Feeling overwhelmed is such a hard place to be, and it makes sense given what you're dealing with. Let's slow it down together. What is the one thing worrying you most right now?`,
    ],
    loneliness: [
      `Feeling alone can hurt in a very real way, and I'm glad you said it out loud. You're not a burden for talking about it. Is there anyone, even someone small in your day, you still feel a little connected to?`,
      `That sounds so lonely. I'm here with you, and I'm listening. What has made you feel most disconnected lately?`,
    ],
    exhaustion: [
      `It sounds like you're running on empty${echo}. That kind of tiredness isn't just about sleep, it's about carrying too much for too long. What has been taking the most out of you?`,
      `Being drained like that is hard, and I'm sorry you've been pushed so far. How have you been sleeping and eating lately? No judgment, I just want to understand.`,
    ],
    anger: [
      `It sounds like you're really frustrated${echo}, and that's valid. Anger often shows up when something matters to us or we felt wronged. What happened?`,
    ],
    worthlessness: [
      `I'm hearing a lot of pain in the way you're talking about yourself, and I want to gently say that the voice calling you worthless isn't telling the truth about who you are. Where do you think that voice comes from? I'm listening.`,
    ],
    joy: [
      `That's lovely to hear, I'm genuinely happy for you! 😊 What's been going well?`,
      `I love that. Those moments deserve to be savoured. What's made today feel good?`,
    ],
  };

  const options = byEmotion[analysis.emotion_label ?? ""];
  if (options) {
    const candidates = options.filter((o) => !used(o.slice(0, 25)));
    return pick(candidates.length ? candidates : options, seed);
  }

  const wordCount = raw.split(/\s+/).length;
  if (wordCount <= 5) {
    return pick(
      [
        "I'm listening. Tell me a bit more about that, whatever comes to mind.",
        "Thanks for sharing. Could you tell me more about what's behind that?",
      ],
      seed
    );
  }
  return pick(
    [
      `Thank you for explaining that. It sounds like there's a lot going on${echo}. How has it been affecting you day to day?`,
      `I hear you. That sounds like a lot to hold${echo}. What part of it is on your mind the most right now?`,
      `I'm glad you told me. It sounds like this matters to you. How are you feeling about it as we talk?`,
    ],
    seed + turn
  );
}
