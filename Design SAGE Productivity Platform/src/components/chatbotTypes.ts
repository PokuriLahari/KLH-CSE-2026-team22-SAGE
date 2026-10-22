import type { ReactNode } from "react"
import type { SageContext } from "../services/sageService.ts"
import type { TimetableEntry } from "../timetable.ts"

export type MessageStatus = "sent" | "thinking" | "error"
export type MessageRole = "user" | "assistant"

export type ChatAttachment = {
  id: string
  name: string
  type: string
  size: number
  dataUrl: string
  isPdf?: boolean
}

export type TaskCandidate = {
  id?: string
  title: string
  description?: string
  dueDate?: string // YYYY-MM-DD
  dueTime?: string // HH:mm
  priority?: "HIGH" | "MEDIUM" | "LOW"
  category?: string
  confidence?: "high" | "medium" | "low"
  isAmbiguous?: boolean
  sourceSnippet?: string
  createdTaskId?: number
  creationStatus?: "pending" | "created" | "failed"
  errorMessage?: string
}

export type TimetableCandidate = {
  id?: string
  courseCode: string
  courseName?: string
  dayOfWeek: number // 1 = Monday .. 7 = Sunday
  dayName: string
  startTime: string // "08:10"
  endTime: string // "09:50"
  location?: string
  faculty?: string
  isConflict?: boolean
  conflictReason?: string
  isDuplicate?: boolean
}

export type SageActionPayload = {
  type: "tasks" | "timetable"
  tasks?: TaskCandidate[]
  timetable?: TimetableCandidate[]
  clarificationNeeded?: string
}

export type ChatMessage = {
  id: string
  role: MessageRole
  content?: ReactNode
  text?: string
  timestamp?: string
  status?: MessageStatus
  errorMessage?: string
  attachment?: ChatAttachment
  actionPayload?: SageActionPayload
}

export const DEFAULT_SUGGESTIONS = [
  "Help me prioritize today's tasks",
  "Plan my study session",
  "Prepare for my upcoming exams",
  "Review my pending tasks",
]

export function formatTime(d = new Date()): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function parseBoldSegments(text: string): Array<{ text: string; isBold: boolean }> {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { text: part.slice(2, -2), isBold: true }
    }
    return { text: part, isBold: false }
  })
}

export function buildTaskContext(
  tasks?: Array<{ id: string | number; title: string; completed?: boolean; status?: string; priority?: string }>,
  events?: Array<{ id: string | number; title: string; startTime?: string }>,
): SageContext {
  const pendingTasks = (tasks ?? []).filter((t) => !t.completed && t.status !== "completed")
  const now = new Date()
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  
  let timezone = "UTC"
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {}

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")

  return {
    taskIds: pendingTasks.map((t) => String(t.id)),
    includeTodaySchedule: (events ?? []).length > 0,
    currentHour: now.getHours(),
    userTimezone: timezone,
    currentDate: `${year}-${month}-${day}`,
    currentDayOfWeek: days[now.getDay()],
    currentTime: `${hours}:${minutes}`,
  }
}

/**
 * Validates uploaded files (Images: JPEG, PNG, WEBP, GIF; Documents: PDF).
 * Max size: 5 MB.
 */
export function validateAttachment(file: File): { valid: boolean; error?: string } {
  const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
  const SUPPORTED_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ])

  if (!file) {
    return { valid: false, error: "No file selected." }
  }

  if (file.size > MAX_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 5 MB.`,
    }
  }

  const type = file.type.toLowerCase()
  if (!SUPPORTED_TYPES.has(type)) {
    return {
      valid: false,
      error: `Unsupported format (${file.type || "unknown"}). Allowed formats: JPEG, PNG, WEBP, GIF, PDF.`,
    }
  }

  return { valid: true }
}

/**
 * Parses embedded ```sage-action ... ``` block from Gemini output.
 * Strips the action block from displayText so user sees clean conversational reply.
 */
export function parseSageAction(rawText: string): {
  displayText: string
  actionPayload?: SageActionPayload
} {
  if (!rawText) return { displayText: "" }

  const match = rawText.match(/```sage-action\s*([\s\S]*?)\s*```/i)
  if (!match) {
    return { displayText: rawText.trim() }
  }

  const jsonSnippet = match[1].trim()
  const cleanDisplay = rawText.replace(match[0], "").trim()

  try {
    const parsed = JSON.parse(jsonSnippet) as SageActionPayload
    if (parsed && (parsed.type === "tasks" || parsed.type === "timetable")) {
      return { displayText: cleanDisplay, actionPayload: parsed }
    }
  } catch {}

  return { displayText: rawText.trim() }
}

/**
 * Detects conflicts and duplicates between extracted timetable candidates
 * and the student's existing timetable entries.
 */
export function detectTimetableConflicts(
  candidates: TimetableCandidate[],
  existingTimetable: TimetableEntry[] = [],
): TimetableCandidate[] {
  return candidates.map((cand, idx) => {
    const candDay = Number(cand.dayOfWeek)
    const candCode = (cand.courseCode || "").trim().toUpperCase()
    const candStart = (cand.startTime || "").trim()
    const candEnd = (cand.endTime || "").trim()

    let isDuplicate = false
    let isConflict = false
    let conflictReason = ""

    for (const ex of existingTimetable) {
      if (ex.dayOfWeek !== candDay) continue

      const exCode = (ex.courseCode || "").trim().toUpperCase()
      const exStart = (ex.startTime || "").trim()
      const exEnd = (ex.endTime || "").trim()

      // Duplicate: Same course, same day, exact same start time
      if (exCode === candCode && exStart === candStart) {
        isDuplicate = true
        break
      }

      // Conflict: Same day and overlapping times (e.g. candStart < exEnd && candEnd > exStart)
      if (candStart && candEnd && exStart && exEnd) {
        if (candStart < exEnd && candEnd > exStart) {
          isConflict = true
          conflictReason = `Conflicts with existing class "${ex.courseName || ex.courseCode}" (${ex.startTime}–${ex.endTime})`
          break
        }
      }
    }

    return {
      ...cand,
      id: cand.id || `cand-${idx}-${Date.now()}`,
      isDuplicate,
      isConflict,
      conflictReason: conflictReason || undefined,
    }
  })
}
