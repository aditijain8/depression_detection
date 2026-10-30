"use client";

import { create } from "zustand";
import { chatApi } from "@/lib/api";
import type { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: number | null;
  latestRiskLabel: string | null;
  showCrisisAlert: boolean;

  sendMessage: (text: string) => Promise<void>;
  dismissCrisisAlert: () => void;
  clearChat: () => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  sessionId: null,
  latestRiskLabel: null,
  showCrisisAlert: false,

  sendMessage: async (text: string) => {
    if (!text.trim()) return;

    // Optimistic user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    const history = get()
      .messages.slice(-14)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    set((state) => ({
      messages: [...state.messages, userMsg],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await chatApi.send({
        message: text.trim(),
        session_id: get().sessionId ?? undefined,
        history,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        created_at: new Date().toISOString(),
        analysis: response.analysis,
        crisis_alert: response.crisis_alert,
      };

      set((state) => ({
        messages: [...state.messages, assistantMsg],
        isLoading: false,
        sessionId: response.session_id,
        latestRiskLabel: response.analysis.risk_label,
        showCrisisAlert: response.crisis_alert,
      }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to send message";
      set({ isLoading: false, error: errMsg });
    }
  },

  dismissCrisisAlert: () => set({ showCrisisAlert: false }),

  clearChat: () =>
    set({
      messages: [],
      sessionId: null,
      error: null,
      latestRiskLabel: null,
      showCrisisAlert: false,
    }),

  setError: (error) => set({ error }),
}));
