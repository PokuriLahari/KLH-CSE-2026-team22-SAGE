// ==================================================
// SAGE ASSISTANT API BOUNDARY (FRONTEND-ONLY)
// ==================================================
// Principles:
// 1. Communicates with Spring Boot backend at /api/sage/ask through shared apiClient.
// 2. NO direct calls to Gemini or external LLMs from React.
// 3. NO API secrets, API keys, or provider tokens in frontend code.
// 4. Honest error handling with user-safe messaging (no leaked stack traces).
// 5. Clean request/response contract adapter for backend compatibility.
// ==================================================

import { apiClient } from "../api/client.ts"

export type SageContext = {
  taskIds?: string[]
  goalIds?: string[]
  includeTodaySchedule?: boolean
  includeUpcomingExams?: boolean
  userTimezone?: string
  currentDate?: string
  currentDayOfWeek?: string
  currentTime?: string
  currentHour?: number
}

export type SageAttachment = {
  mimeType: string
  data: string
  name?: string
}

export type SageRequest = {
  message: string
  conversationId?: string
  context?: SageContext
  attachment?: SageAttachment
}

export type SageResponse = {
  message: string
  conversationId?: string
  responseId?: string
  timestamp?: string
}

export type ChatMessage = {
  id: string
  sender: "user" | "sage"
  text: string
  timestamp: string
  error?: boolean
  canRetry?: boolean
}

type BackendSageAskResponse = {
  message?: string
  reply?: string
  action?: string
  reasoning?: string
  conversationId?: string
  responseId?: string
  timestamp?: string
  pendingTasksCount?: number
  totalMinutes?: number
  topTaskId?: number
  topTaskTitle?: string
}

/**
 * Sends a student query to the SAGE backend boundary (/api/sage/ask).
 * Uses shared apiClient and adapts backend reply property to SageResponse.
 */
export async function askSage(
  request: SageRequest,
  signal?: AbortSignal,
): Promise<SageResponse> {
  const trimmed = request.message ? request.message.trim() : ""
  if (!trimmed && !request.attachment) {
    throw new Error("Message cannot be empty.")
  }

  const promptText = trimmed || "Please analyze this attached document/image for academic tasks and timetable schedule."

  try {
    const data = await apiClient.post<BackendSageAskResponse>(
      "/sage/ask",
      {
        message: promptText,
        prompt: promptText, // Backend accepts both prompt and message
        conversationId: request.conversationId,
        context: request.context,
        attachment: request.attachment,
      },
      { signal },
    )

    // Reconcile response: Backend AuthController returns 'reply', frontend expects 'message'
    const replyText = data?.message || data?.reply
    if (!replyText || typeof replyText !== "string") {
      throw new Error("SAGE couldn't respond right now. Please try again.")
    }

    return {
      message: replyText,
      conversationId: data.conversationId || request.conversationId,
      responseId: data.responseId,
      timestamp: data.timestamp || new Date().toISOString(),
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err
    }
    if (err instanceof Error && err.message) {
      throw err
    }
    // Re-throw user-safe friendly error message
    throw new Error("SAGE couldn't connect right now. Please try again.")
  }
}
