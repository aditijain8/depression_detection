import axios from "axios";
import type {
  AuthResponse,
  ChatSendRequest,
  ChatSendResponse,
  DashboardStats,
  MoodTrendData,
  SentimentDistribution,
  BehavioralPatterns,
  RecommendationsResponse,
  User,
  AnalysisResult,
  LoginRequest,
  RegisterRequest,
} from "@/types";

// ----------------------------------------------------------------
// Axios instance — all API calls go through this.
// When the backend is ready, set NEXT_PUBLIC_API_URL in .env.local
// ----------------------------------------------------------------
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ----------------------------------------------------------------
// MOCK FLAG — flip to false once the backend is wired up
// ----------------------------------------------------------------
const USE_MOCK = true;

// ===================== MOCK DATA ================================

const mockUser: User = {
  id: 1,
  username: "demo_user",
  email: "demo@example.com",
  is_anonymous: false,
  consent_given: true,
  created_at: new Date().toISOString(),
};

const mockReplies = [
  "Thank you for sharing that with me. It sounds like you've been going through a difficult time. Would you like to talk more about what's been bothering you?",
  "I hear you, and your feelings are completely valid. Sometimes just acknowledging how we feel can be a helpful first step. What do you think might help you feel a bit better today?",
  "It takes courage to express how you're feeling. I'm here to listen without judgment. Would you like to explore some coping strategies together?",
  "I appreciate you opening up. Remember, it's okay to not be okay sometimes. Have you been able to talk to someone you trust about how you've been feeling?",
  "That sounds really challenging. I want you to know that what you're experiencing matters. Would it help to try a simple breathing exercise together?",
];

function randomMockAnalysis(text: string): AnalysisResult {
  const lowerText = text.toLowerCase();
  const negativeWords = ["sad", "hopeless", "depressed", "anxious", "tired", "alone", "worthless", "crying", "hurt", "pain", "die", "kill"];
  const positiveWords = ["happy", "good", "great", "better", "joy", "love", "excited", "calm", "peaceful", "grateful"];

  const negCount = negativeWords.filter((w) => lowerText.includes(w)).length;
  const posCount = positiveWords.filter((w) => lowerText.includes(w)).length;

  let riskScore: number;
  if (negCount >= 3) riskScore = 0.7 + Math.random() * 0.3;
  else if (negCount >= 1) riskScore = 0.35 + Math.random() * 0.3;
  else if (posCount >= 1) riskScore = Math.random() * 0.2;
  else riskScore = 0.2 + Math.random() * 0.2;

  const riskLabel = riskScore >= 0.65 ? "high" : riskScore >= 0.35 ? "medium" : "low";
  const sentimentScore = posCount > negCount ? 0.1 + Math.random() * 0.5 : negCount > posCount ? -(0.1 + Math.random() * 0.5) : -0.05 + Math.random() * 0.1;

  const keywords = text.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);

  return {
    sentiment_score: parseFloat(sentimentScore.toFixed(3)),
    risk_score: parseFloat(riskScore.toFixed(3)),
    risk_label: riskLabel,
    top_keywords: keywords.length > 0 ? keywords : ["feeling", "today"],
    confidence: parseFloat((0.6 + Math.random() * 0.35).toFixed(3)),
    emotion_label: negCount > posCount ? "sadness" : posCount > negCount ? "joy" : "neutral",
  };
}

const mockDashboardStats: DashboardStats = {
  total_messages: 47,
  avg_sentiment_7d: -0.12,
  avg_risk_7d: 0.38,
  current_streak_days: 5,
};

function generateMockMoodTrend(days: number): MoodTrendData {
  const dates: string[] = [];
  const sentimentScores: number[] = [];
  const riskScores: number[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
    sentimentScores.push(parseFloat((-0.3 + Math.random() * 0.6).toFixed(2)));
    riskScores.push(parseFloat((0.2 + Math.random() * 0.5).toFixed(2)));
  }
  return { dates, sentiment_scores: sentimentScores, risk_scores: riskScores };
}

const mockSentimentDist: SentimentDistribution = { positive: 18, neutral: 12, negative: 17 };

const mockBehavior: BehavioralPatterns = {
  late_night_days: 4,
  avg_message_length: 82.5,
  most_active_hour: 21,
  weekly_frequency: [3, 5, 7, 4, 8, 6, 2],
};

const mockRecommendations: Record<string, RecommendationsResponse> = {
  low: {
    recommendations: [
      { category: "activity", title: "Morning Walk", description: "Take a 15-minute walk in the morning sun to boost serotonin.", priority: 1 },
      { category: "breathing", title: "Box Breathing", description: "Try 4-4-4-4 breathing: inhale 4s, hold 4s, exhale 4s, hold 4s.", priority: 2 },
      { category: "social", title: "Call a Friend", description: "Reach out to someone you trust for a casual conversation.", priority: 3 },
      { category: "journaling", title: "Gratitude Journal", description: "Write down 3 things you're grateful for today.", priority: 4 },
      { category: "activity", title: "Listen to Music", description: "Create a playlist of songs that uplift your mood.", priority: 5 },
    ],
  },
  medium: {
    recommendations: [
      { category: "journaling", title: "Mood Journal", description: "Document your feelings and identify patterns in your emotions.", priority: 1 },
      { category: "activity", title: "Gentle Exercise", description: "Try yoga or stretching for 20 minutes to release tension.", priority: 2 },
      { category: "breathing", title: "Deep Breathing", description: "Practice diaphragmatic breathing for 5 minutes.", priority: 3 },
      { category: "social", title: "Support Circle", description: "Share how you're feeling with a trusted friend or family.", priority: 4 },
      { category: "activity", title: "Mindful Walk", description: "Walk slowly and notice 5 things you can see, 4 you hear, 3 you touch.", priority: 5 },
      { category: "journaling", title: "Thought Record", description: "Write down a negative thought and challenge it with evidence.", priority: 6 },
      { category: "activity", title: "Creative Outlet", description: "Draw, paint, or write something — expression helps process emotions.", priority: 7 },
    ],
  },
  high: {
    recommendations: [
      { category: "professional_help", title: "Talk to a Professional", description: "Consider reaching out to iCall (9152987821) or Vandrevala Foundation (1860-2662-345).", priority: 1 },
      { category: "breathing", title: "Grounding Exercise", description: "5-4-3-2-1: Name 5 things you see, 4 hear, 3 touch, 2 smell, 1 taste.", priority: 2 },
      { category: "social", title: "Reach Out Now", description: "Please talk to someone you trust about how you're feeling.", priority: 3 },
      { category: "activity", title: "Safety Plan", description: "Identify safe places and people you can contact when feeling overwhelmed.", priority: 4 },
      { category: "professional_help", title: "Crisis Helpline", description: "If you need immediate support, call NIMHANS at 080-46110007.", priority: 5 },
    ],
  },
};

// ===================== API FUNCTIONS ============================

export const authApi = {
  register: async (data: RegisterRequest): Promise<User> => {
    if (USE_MOCK) {
      await delay(500);
      return { ...mockUser, username: data.username, email: data.email };
    }
    const res = await api.post<User>("/auth/register", data);
    return res.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    if (USE_MOCK) {
      await delay(500);
      const token: AuthResponse = { access_token: "mock-jwt-token-xyz", token_type: "bearer" };
      localStorage.setItem("access_token", token.access_token);
      return token;
    }
    const res = await api.post<AuthResponse>("/auth/login", data);
    localStorage.setItem("access_token", res.data.access_token);
    return res.data;
  },

  getMe: async (): Promise<User> => {
    if (USE_MOCK) {
      await delay(200);
      return mockUser;
    }
    const res = await api.get<User>("/auth/me");
    return res.data;
  },

  giveConsent: async (): Promise<void> => {
    if (USE_MOCK) {
      await delay(200);
      return;
    }
    await api.patch("/auth/consent");
  },

  logout: () => {
    localStorage.removeItem("access_token");
  },
};

export const chatApi = {
  send: async (data: ChatSendRequest): Promise<ChatSendResponse> => {
    if (USE_MOCK) {
      // Frontend-only mode: use the built-in Next.js chat route (Groq if configured, else local responder)
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) return (await res.json()) as ChatSendResponse;
      } catch {
        // fall through to canned reply
      }
      await delay(800);
      const analysis = randomMockAnalysis(data.message);
      return {
        reply: mockReplies[Math.floor(Math.random() * mockReplies.length)],
        session_id: data.session_id ?? 1,
        analysis,
        crisis_alert: analysis.risk_label === "high",
      };
    }
    const res = await api.post<ChatSendResponse>("/chat/send", data);
    return res.data;
  },
};

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    if (USE_MOCK) {
      await delay(300);
      return mockDashboardStats;
    }
    const res = await api.get<DashboardStats>("/dashboard/stats");
    return res.data;
  },

  getMoodTrend: async (days = 30): Promise<MoodTrendData> => {
    if (USE_MOCK) {
      await delay(300);
      return generateMockMoodTrend(days);
    }
    const res = await api.get<MoodTrendData>(`/dashboard/mood?days=${days}`);
    return res.data;
  },

  getSentimentDistribution: async (): Promise<SentimentDistribution> => {
    if (USE_MOCK) {
      await delay(200);
      return mockSentimentDist;
    }
    const res = await api.get<SentimentDistribution>("/dashboard/sentiment-dist");
    return res.data;
  },

  getBehavior: async (): Promise<BehavioralPatterns> => {
    if (USE_MOCK) {
      await delay(200);
      return mockBehavior;
    }
    const res = await api.get<BehavioralPatterns>("/dashboard/behavior");
    return res.data;
  },
};

export const analysisApi = {
  analyze: async (text: string): Promise<AnalysisResult> => {
    if (USE_MOCK) {
      await delay(400);
      return randomMockAnalysis(text);
    }
    const res = await api.post<AnalysisResult>("/analyze", { text });
    return res.data;
  },
};

export const recommendApi = {
  get: async (riskLabel: string): Promise<RecommendationsResponse> => {
    if (USE_MOCK) {
      await delay(300);
      return mockRecommendations[riskLabel] ?? mockRecommendations.low;
    }
    const res = await api.get<RecommendationsResponse>(`/recommend?risk_label=${encodeURIComponent(riskLabel)}`);
    return res.data;
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default api;

// Extended analysis API with history
export const analysisHistoryApi = {
  history: async (limit = 50): Promise<any[]> => {
    if (USE_MOCK) {
      await delay(300);
      return []; // Empty for mock — no history yet
    }
    const res = await api.get(`/analyze/history?limit=${limit}`);
    return res.data;
  },

  analyzeSession: async (sessionId: number): Promise<any> => {
    if (USE_MOCK) {
      await delay(300);
      return {};
    }
    const res = await api.get(`/analyze/session/${sessionId}`);
    return res.data;
  },

  deleteAccount: async (): Promise<void> => {
    if (USE_MOCK) {
      await delay(500);
      return;
    }
    await api.delete("/auth/me");
  },
};
