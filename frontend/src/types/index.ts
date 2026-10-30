// ============================================================
// Shared TypeScript interfaces — used across frontend
// ============================================================

export type RiskLabel = "low" | "medium" | "high";

export interface User {
  id: number;
  username: string;
  email: string;
  is_anonymous: boolean;
  consent_given: boolean;
  created_at: string;
}

export interface AnalysisResult {
  sentiment_score: number;
  risk_score: number;
  risk_label: RiskLabel;
  top_keywords: string[];
  confidence: number;
  emotion_label?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  analysis?: AnalysisResult;
  crisis_alert?: boolean;
}

// ---- Auth ----
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

// ---- Chat ----
export interface ChatSendRequest {
  message: string;
  session_id?: number;
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface ChatSendResponse {
  reply: string;
  session_id: number;
  analysis: AnalysisResult;
  crisis_alert: boolean;
}

// ---- Dashboard ----
export interface DashboardStats {
  total_messages: number;
  avg_sentiment_7d: number;
  avg_risk_7d: number;
  current_streak_days: number;
}

export interface MoodTrendData {
  dates: string[];
  sentiment_scores: number[];
  risk_scores: number[];
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

export interface BehavioralPatterns {
  late_night_days: number;
  avg_message_length: number;
  most_active_hour: number;
  weekly_frequency: number[];
}

// ---- Recommendations ----
export interface Recommendation {
  category: "activity" | "journaling" | "social" | "professional_help" | "breathing";
  title: string;
  description: string;
  priority: number;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
}

// ---- Analysis ----
export interface AnalysisHistoryItem extends AnalysisResult {
  id: number;
  message_content: string;
  created_at: string;
}
