// ==================================================
// SAGE DECISION ENGINE — UTILITIES
// ==================================================
// Principles:
// 1. Strict input validation with honest empty states.
// 2. Pure deterministic calculations — no random or unpredictable behavior.
// 3. Timetable classes & calendar events are constraints, NEVER candidate tasks.
// 4. Do not invent missing data (e.g. duration, preferences, or relationships).
// ==================================================

import type {
  AvailableTimeWindow,
  DecisionContext,
  EventItem,
  FocusSessionEvent,
  Goal,
  RecommendationEvent,
  Task,
  TimeCommitment,
  TimetableEntry,
} from "./decisionTypes.ts"
import {
  FOCUS_SESSION_EVENTS_STORAGE_KEY,
  RECOMMENDATION_EVENTS_STORAGE_KEY,
} from "./decisionTypes.ts"

/**
 * Formats a Date object into local YYYY-MM-DD.
 */
export function toDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Formats a Date object into local HH:mm.
 */
export function toTimeString(d: Date): string {
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

/**
 * Calculates day difference between target date and reference date.
 * Returns negative if target is in the past, 0 if today, positive if future.
 */
export function getDaysDifference(
  targetDate: string,
  refDate = new Date(),
): number {
  if (!targetDate) return 0
  const [tY, tM, tD] = targetDate.split("-").map(Number)
  if (!tY || !tM || !tD) return 0

  const target = new Date(tY, tM - 1, tD)
  const current = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate(),
  )
  const diffTime = target.getTime() - current.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Formats minute count into readable string, e.g. "45 min" or "1h 30m".
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (remaining === 0) {
    return `${hours}h`
  }
  return `${hours}h ${remaining}m`
}

/**
 * Safely parses task duration without inventing a default if absent.
 * If duration is missing, undefined or non-positive, returns undefined.
 */
export function parseTaskDuration(duration?: string): number | undefined {
  if (!duration || typeof duration !== "string") return undefined
  const trimmed = duration.trim()
  if (!trimmed) return undefined
  const parsed = parseInt(trimmed, 10)
  if (isNaN(parsed) || parsed <= 0) return undefined
  return parsed
}

/**
 * Checks whether a task is actionable and valid for recommendation.
 * Excludes: completed, deleted, invalid tasks, and currently active snoozes.
 */
export function isActionableCandidate(task: Task, now = new Date()): boolean {
  if (!task || typeof task !== "object") return false
  if (typeof task.id !== "number" || isNaN(task.id)) return false
  if (!task.title || typeof task.title !== "string" || !task.title.trim())
    return false

  // Completed tasks are never candidates
  if (task.status === "completed") return false

  // Deliberately snoozed tasks
  if (task.status === "snoozed") {
    if (task.snoozedUntil) {
      const snoozedMs = new Date(task.snoozedUntil).getTime()
      if (!isNaN(snoozedMs) && now.getTime() < snoozedMs) {
        return false // Snooze still active
      }
    } else {
      // Deliberately snoozed without expiration timestamp
      return false
    }
  }

  // Active snooze on an open task
  if (task.snoozedUntil) {
    const snoozedMs = new Date(task.snoozedUntil).getTime()
    if (!isNaN(snoozedMs) && now.getTime() < snoozedMs) {
      return false
    }
  }

  return true
}

/**
 * Converts "HH:mm" 24-hr string into total minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Calculates current available time window considering timetable classes and calendar events.
 * Timetable blocks and calendar events are constraints, NEVER tasks.
 */
export function calculateAvailableTimeWindow(
  now = new Date(),
  timetable: TimetableEntry[] = [],
  calendarEvents: EventItem[] = [],
): AvailableTimeWindow {
  const todayStr = toDateString(now)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // 1 = Mon ... 7 = Sun

  const commitments: TimeCommitment[] = []

  // 1. Timetable classes for today
  const todayClasses = timetable.filter(
    (entry) => entry.dayOfWeek === dayOfWeek,
  )
  for (const entry of todayClasses) {
    const startMins = timeStringToMinutes(entry.startTime)
    const endMins = timeStringToMinutes(entry.endTime)
    if (endMins <= startMins) continue

    const isOngoing = currentMinutes >= startMins && currentMinutes < endMins
    commitments.push({
      title: entry.courseName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      type: "timetable_class",
      isOngoing,
      minutesUntilStart: Math.max(0, startMins - currentMinutes),
      minutesUntilEnd: Math.max(0, endMins - currentMinutes),
      location: entry.location,
    })
  }

  // 2. Calendar events for today with time
  const todayEvents = calendarEvents.filter(
    (ev) => ev.date === todayStr && ev.time && ev.type !== "Class",
  )
  for (const ev of todayEvents) {
    const startMins = timeStringToMinutes(ev.time)
    const endMins = ev.endTime
      ? timeStringToMinutes(ev.endTime)
      : startMins + 60
    const isOngoing = currentMinutes >= startMins && currentMinutes < endMins

    commitments.push({
      title: ev.title,
      startTime: ev.time,
      endTime: ev.endTime || `${Math.floor(endMins / 60)}:${endMins % 60}`,
      type: ev.type === "Exam" ? "exam" : "calendar_event",
      isOngoing,
      minutesUntilStart: Math.max(0, startMins - currentMinutes),
      minutesUntilEnd: Math.max(0, endMins - currentMinutes),
    })
  }

  // Identify in-progress commitment
  const inProgressCommitment = commitments.find((c) => c.isOngoing)
  const hasCommitmentInProgress = !!inProgressCommitment

  // Identify upcoming commitments today
  const upcomingCommitments = commitments
    .filter(
      (c) => !c.isOngoing && timeStringToMinutes(c.startTime) > currentMinutes,
    )
    .sort(
      (a, b) =>
        timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime),
    )

  const nextCommitment = upcomingCommitments[0]

  let availableMinutes: number
  let windowDescription: string

  if (nextCommitment) {
    availableMinutes = nextCommitment.minutesUntilStart
    windowDescription = `~${formatMinutes(availableMinutes)} before ${nextCommitment.title}`
  } else {
    // No upcoming commitment for rest of day — window extends to evening (e.g. 23:00)
    const minutesUntilEndOfDay = Math.max(60, 23 * 60 - currentMinutes)
    availableMinutes = minutesUntilEndOfDay
    windowDescription = "Clear schedule for the rest of today"
  }

  return {
    hasCommitmentInProgress,
    inProgressCommitment,
    nextCommitment,
    availableMinutes,
    windowDescription,
  }
}

export type RelatedExamMatch = {
  exam: EventItem
  daysUntil: number
}

/**
 * Finds explicit exam relationship for a task.
 * NEVER guesses or infers relationships without explicit match.
 */
export function findRelatedExam(
  task: Task,
  exams: EventItem[] = [],
  now = new Date(),
): RelatedExamMatch | null {
  if (!task.course || !task.course.trim()) return null
  const courseClean = task.course.trim().toLowerCase()

  for (const exam of exams) {
    const isExamEvent =
      exam.type === "Exam" ||
      exam.title.toLowerCase().includes("exam") ||
      exam.title.toLowerCase().includes("quiz") ||
      exam.title.toLowerCase().includes("midterm")
    if (!isExamEvent || !exam.date) continue

    const daysUntil = getDaysDifference(exam.date, now)
    // Only upcoming exams within 14-day horizon
    if (daysUntil < 0 || daysUntil > 14) continue

    const examTitleClean = exam.title.trim().toLowerCase()
    // Explicit match: course matches exam title or vice versa
    const isExplicitMatch =
      examTitleClean.includes(courseClean) ||
      courseClean.includes(examTitleClean)

    if (isExplicitMatch) {
      return { exam, daysUntil }
    }
  }

  return null
}

/**
 * Finds explicit goal relationship for a task.
 * NEVER infers associations from vague text alone.
 */
export function findRelatedGoal(task: Task, goals: Goal[] = []): Goal | null {
  if (!task.goal || !task.goal.trim()) return null
  const taskGoal = task.goal.trim().toLowerCase()

  for (const goal of goals) {
    if (!goal.title) continue
    const goalTitle = goal.title.trim().toLowerCase()
    const matchesTitle = goalTitle === taskGoal || taskGoal.includes(goalTitle)
    const matchesId = String(goal.id) === task.goal.trim()

    if (matchesTitle || matchesId) {
      // Only active goals (not fully completed)
      if ((goal.completed ?? 0) < 100) {
        return goal
      }
    }
  }

  return null
}

/**
 * Lightweight event recorder for future learning foundation (Phase 3 Requirement 20).
 * Persists only to localStorage.
 */
export function recordRecommendationEvent(
  event: Omit<RecommendationEvent, "id">,
): void {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_EVENTS_STORAGE_KEY)
    const list: RecommendationEvent[] = raw ? JSON.parse(raw) : []
    const newEvent: RecommendationEvent = {
      ...event,
      id: `rec-evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }
    // Limit history to latest 200 events
    const updated = [newEvent, ...list].slice(0, 200)
    window.localStorage.setItem(
      RECOMMENDATION_EVENTS_STORAGE_KEY,
      JSON.stringify(updated),
    )
  } catch {}
}

export function getStoredRecommendationEvents(): RecommendationEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_EVENTS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function recordFocusSessionEvent(event: FocusSessionEvent): void {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(FOCUS_SESSION_EVENTS_STORAGE_KEY)
    const list: FocusSessionEvent[] = raw ? JSON.parse(raw) : []
    const updated = [event, ...list].slice(0, 200)
    window.localStorage.setItem(
      FOCUS_SESSION_EVENTS_STORAGE_KEY,
      JSON.stringify(updated),
    )
  } catch {}
}

export function parseContextDateTime(context: DecisionContext): Date {
  if (context.currentDateTime instanceof Date) {
    return context.currentDateTime
  }
  if (typeof context.currentDateTime === "string") {
    const parsed = new Date(context.currentDateTime)
    if (!isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}
