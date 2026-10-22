// ==================================================
// SAGE NOTIFICATION & REMINDER ENGINE
// ==================================================
// Principles:
// 1. Frontend-only implementation with real state and honest empty states.
// 2. Real dueAt timestamps with customizable offsets (exact, 10m, 30m, 1h, 1d).
// 3. Duplicate prevention via persistent notifiedAt timestamps.
// 4. Safe browser Notification API with graceful fallback to in-app alerts.
// 5. Clean service boundary prepared for future Spring Boot backend.
// ==================================================

import { getUserItem, setUserItem, type UserIdentifier } from "./userStorage.ts"

export type ReminderTiming = "exact" | "10m" | "30m" | "1h" | "2h" | "1d"

export type Reminder = {
  id: number
  title: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  dueAt: string // ISO timestamp of scheduled due time
  createdAt: string
  completedAt?: string
  snoozedUntil?: string
  status: "open" | "completed" | "snoozed"
  method: "In-app" | "Email" | "Email + In-app" | string
  read: boolean
  dismissed: boolean
  notificationTiming: ReminderTiming
  notifiedAt?: string
  targetType?: "reminder" | "task" | "exam" | "contest"
  targetId?: number | string
  contestId?: string
  platform?: string
  contestUrl?: string
  eventStartTime?: string
}

export type NotificationPreferences = {
  email: boolean
  inApp: boolean
  tasks: boolean
  contests: boolean
  quietHours: string
  timing: ReminderTiming
  browserNotifications: boolean
}

export const NOTIFICATIONS_STORAGE_KEY = "sage-notification-preferences"
export const REMINDERS_STORAGE_KEY = "sage-reminders"

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  inApp: true,
  tasks: true,
  contests: true,
  quietHours: "10:00 PM – 7:00 AM",
  timing: "exact",
  browserNotifications: true,
}

export const TIMING_OFFSETS_MS: Record<ReminderTiming, number> = {
  exact: 0,
  "10m": 10 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 120 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
}

export const TIMING_LABELS: Record<ReminderTiming, string> = {
  exact: "At time of event",
  "10m": "10 minutes before",
  "30m": "30 minutes before",
  "1h": "1 hour before",
  "2h": "2 hours before",
  "1d": "1 day before",
}

/**
 * Creates an ISO timestamp from a date (YYYY-MM-DD) and time (HH:mm).
 */
export function buildDueAtTimestamp(dateStr: string, timeStr: string): string {
  if (!dateStr) {
    const d = new Date()
    return d.toISOString()
  }
  const cleanTime = /^\d{1,2}:\d{2}$/.test(timeStr) ? timeStr : "09:00"
  const [hours, minutes] = cleanTime.split(":").map(Number)
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1, hours || 0, minutes || 0, 0, 0)
  return dt.toISOString()
}

/**
 * Calculates the trigger time (in ms) when the reminder should notify.
 */
export function getReminderTriggerTime(reminder: Reminder): number {
  if (reminder.status === "snoozed" && reminder.snoozedUntil) {
    const snoozedMs = new Date(reminder.snoozedUntil).getTime()
    if (!isNaN(snoozedMs)) return snoozedMs
  }
  if (reminder.targetType === "contest") {
    // For contest reminders, dueAt is the computed notification due time
    if (reminder.dueAt) {
      const dueMs = new Date(reminder.dueAt).getTime()
      if (!isNaN(dueMs)) return dueMs
    }
    if (reminder.eventStartTime) {
      const startMs = new Date(reminder.eventStartTime).getTime()
      const offset = TIMING_OFFSETS_MS[reminder.notificationTiming] || 0
      return Math.max(0, startMs - offset)
    }
  }
  const baseMs = reminder.dueAt
    ? new Date(reminder.dueAt).getTime()
    : new Date(buildDueAtTimestamp(reminder.date, reminder.time)).getTime()
  const offset = TIMING_OFFSETS_MS[reminder.notificationTiming] || 0
  return baseMs - offset
}

/**
 * Determines whether a reminder is currently due for notification.
 * Safely guards against expired contests and missing or invalid contest start times.
 */
export function isReminderDue(reminder: Reminder, now = new Date()): boolean {
  if (reminder.status === "completed" || reminder.dismissed) {
    return false
  }
  if (reminder.targetType === "contest") {
    if (!reminder.eventStartTime) return false
    const contestStartMs = new Date(reminder.eventStartTime).getTime()
    // Invalid or already expired contest start time
    if (isNaN(contestStartMs) || contestStartMs <= now.getTime()) {
      return false
    }
  }
  const triggerMs = getReminderTriggerTime(reminder)
  return now.getTime() >= triggerMs
}

/**
 * Checks if current time is within user quiet hours.
 * Format expected: "HH:mm – HH:mm" or "10:00 PM – 7:00 AM".
 */
export function isWithinQuietHours(
  quietHours: string,
  now = new Date(),
): boolean {
  if (!quietHours || !quietHours.includes("–")) return false
  try {
    const [startStr, endStr] = quietHours.split("–").map((s) => s.trim())
    const parseTimeToMinutes = (t: string) => {
      const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
      if (!match) return -1
      let h = parseInt(match[1], 10)
      const m = parseInt(match[2], 10)
      const meridiem = match[3]?.toUpperCase()
      if (meridiem === "PM" && h < 12) h += 12
      if (meridiem === "AM" && h === 12) h = 0
      return h * 60 + m
    }
    const startM = parseTimeToMinutes(startStr)
    const endM = parseTimeToMinutes(endStr)
    if (startM < 0 || endM < 0) return false

    const curM = now.getHours() * 60 + now.getMinutes()
    if (startM > endM) {
      // Wraps overnight (e.g. 22:00 to 07:00)
      return curM >= startM || curM < endM
    }
    return curM >= startM && curM < endM
  } catch {
    return false
  }
}

// ==================================================
// BROWSER NOTIFICATION INTEGRATION
// ==================================================

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserNotificationSupported()) return "unsupported"
  return Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  try {
    const status = await Notification.requestPermission()
    return status === "granted"
  } catch {
    return false
  }
}

export function dispatchBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void,
): boolean {
  if (!isBrowserNotificationSupported()) return false
  if (Notification.permission !== "granted") return false
  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
    })
    notification.onclick = () => {
      try {
        window.focus()
      } catch {}
      onClick?.()
      notification.close()
    }
    return true
  } catch {
    return false
  }
}

// ==================================================
// BACKEND CONTRACT & PREFERENCES SYNC (FRONTEND-ONLY BOUNDARY)
// ==================================================

export type NotificationSyncResult = {
  success: boolean
  source: "local" | "backend"
}

/**
 * Service boundary to save notification preferences.
 * Future Spring Boot integration will expose POST /api/notifications/preferences.
 * Does not make fake success claims or expose secrets.
 */
export async function syncNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationSyncResult> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(preferences),
      )
    } catch {}
  }

  // Attempt backend handshake if available (non-blocking, fails gracefully)
  try {
    const res = await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    })
    if (res.ok) {
      return { success: true, source: "backend" }
    }
  } catch {
    // Backend is separate; frontend persists correctly to local state
  }

  return { success: true, source: "local" }
}

/**
 * Normalizes and upgrades any existing or legacy reminder data.
 */
export type RawReminderInput = Partial<Reminder> & {
  id: number
  title: string
}

export function normalizeReminder(raw: RawReminderInput): Reminder {
  const dateStr = raw.date || new Date().toISOString().split("T")[0]
  const timeStr = raw.time || "09:00"
  const dueAt = raw.dueAt || buildDueAtTimestamp(dateStr, timeStr)
  return {
    id: raw.id,
    title: raw.title,
    date: dateStr,
    time: timeStr,
    dueAt,
    createdAt: raw.createdAt || new Date().toISOString(),
    completedAt: raw.completedAt,
    snoozedUntil: raw.snoozedUntil,
    status: raw.status || "open",
    method: raw.method || "Email + In-app",
    read: Boolean(raw.read),
    dismissed: Boolean(raw.dismissed),
    notificationTiming: raw.notificationTiming || "exact",
    notifiedAt: raw.notifiedAt,
    targetType: raw.targetType,
    targetId: raw.targetId,
    contestId:
      raw.contestId ||
      (raw.targetType === "contest" && raw.targetId != null
        ? String(raw.targetId)
        : undefined),
    platform: raw.platform,
    contestUrl: raw.contestUrl,
    eventStartTime: raw.eventStartTime,
  }
}

export type ContestReminderInput = {
  id: string
  name: string
  platform: string
  startTime: string
  url?: string
}

/**
 * Creates or updates a unified contest reminder.
 * Enforces single source of truth and prevents duplicate reminders.
 */
export function upsertContestReminder(
  reminders: Reminder[],
  contest: ContestReminderInput,
  timing: ReminderTiming,
): Reminder[] {
  const startMs = new Date(contest.startTime).getTime()
  if (isNaN(startMs)) return reminders

  const offsetMs = TIMING_OFFSETS_MS[timing] ?? 0
  const triggerMs = Math.max(0, startMs - offsetMs)
  const triggerDate = new Date(triggerMs)
  const triggerDateStr = `${triggerDate.getFullYear()}-${String(
    triggerDate.getMonth() + 1,
  ).padStart(2, "0")}-${String(triggerDate.getDate()).padStart(2, "0")}`
  const triggerTimeStr = `${String(triggerDate.getHours()).padStart(
    2,
    "0",
  )}:${String(triggerDate.getMinutes()).padStart(2, "0")}`

  const existingIndex = reminders.findIndex(
    (r) =>
      (r.targetType === "contest" &&
        String(r.targetId) === String(contest.id)) ||
      r.contestId === contest.id,
  )

  const updatedReminder: Reminder = normalizeReminder({
    id: existingIndex >= 0 ? reminders[existingIndex].id : Date.now(),
    title: `${contest.platform}: ${contest.name}`,
    date: triggerDateStr,
    time: triggerTimeStr,
    dueAt: triggerDate.toISOString(),
    createdAt:
      existingIndex >= 0
        ? reminders[existingIndex].createdAt
        : new Date().toISOString(),
    notificationTiming: timing,
    method: "Email + In-app",
    status: "open",
    read: false,
    dismissed: false,
    targetType: "contest",
    targetId: contest.id,
    contestId: contest.id,
    platform: contest.platform,
    contestUrl: contest.url,
    eventStartTime: contest.startTime,
  })

  if (existingIndex >= 0) {
    const next = [...reminders]
    next[existingIndex] = updatedReminder
    return next
  }

  return [...reminders, updatedReminder]
}

export type TaskDeadlineReminderInput = {
  id: number | string
  title: string
  dueDate: string
  dueTime?: string
}

/**
 * Creates or updates a deadline reminder for a task.
 * Ensures the student receives both in-app notification and email before/at the deadline.
 */
export function buildTaskDeadlineReminder(
  task: TaskDeadlineReminderInput,
  timing: ReminderTiming = "exact",
): Reminder {
  const dateStr = task.dueDate.trim()
  const timeStr =
    task.dueTime && /^\d{1,2}:\d{2}$/.test(task.dueTime.trim())
      ? task.dueTime.trim()
      : "18:00"
  const dueAt = buildDueAtTimestamp(dateStr, timeStr)
  return normalizeReminder({
    id: Date.now(),
    title: `Deadline: ${task.title.trim()}`,
    date: dateStr,
    time: timeStr,
    dueAt,
    createdAt: new Date().toISOString(),
    notificationTiming: timing,
    method: "Email + In-app",
    status: "open",
    read: false,
    dismissed: false,
    targetType: "task",
    targetId: String(task.id),
    eventStartTime: `${dateStr} ${timeStr}`,
  })
}

export function upsertTaskDeadlineReminder(
  reminders: Reminder[],
  task: TaskDeadlineReminderInput,
  timing: ReminderTiming = "exact",
): Reminder[] {
  if (!task.dueDate) return reminders
  const existingIndex = reminders.findIndex(
    (r) => r.targetType === "task" && String(r.targetId) === String(task.id),
  )
  const newReminder = buildTaskDeadlineReminder(task, timing)
  if (existingIndex >= 0) {
    const updated = normalizeReminder({
      ...reminders[existingIndex],
      title: newReminder.title,
      date: newReminder.date,
      time: newReminder.time,
      dueAt: newReminder.dueAt,
      method: "Email + In-app",
      status: "open",
      read: false,
      dismissed: false,
      notifiedAt: undefined,
      eventStartTime: newReminder.eventStartTime,
    })
    const next = [...reminders]
    next[existingIndex] = updated
    return next
  }
  return [...reminders, newReminder]
}

export function removeTaskDeadlineReminder(
  reminders: Reminder[],
  taskId: number | string,
): Reminder[] {
  return reminders.filter(
    (r) => !(r.targetType === "task" && String(r.targetId) === String(taskId)),
  )
}

/**
 * Removes a contest reminder by contest ID.
 */
export function removeContestReminder(
  reminders: Reminder[],
  contestId: string,
): Reminder[] {
  return reminders.filter(
    (r) =>
      !(
        (r.targetType === "contest" &&
          String(r.targetId) === String(contestId)) ||
        r.contestId === contestId
      ),
  )
}

/**
 * Finds an active (non-dismissed, non-completed) reminder for a contest.
 */
export function findContestReminder(
  reminders: Reminder[],
  contestId: string,
): Reminder | undefined {
  return reminders.find(
    (r) =>
      ((r.targetType === "contest" &&
        String(r.targetId) === String(contestId)) ||
        r.contestId === contestId) &&
      !r.dismissed &&
      r.status !== "completed",
  )
}

export function loadSavedReminders(userOrId?: UserIdentifier): Reminder[] {
  const saved = getUserItem<Reminder[]>(REMINDERS_STORAGE_KEY, userOrId)
  if (Array.isArray(saved)) {
    return saved.map(normalizeReminder)
  }
  return []
}

export function saveReminders(
  reminders: Reminder[],
  userOrId?: UserIdentifier,
): void {
  setUserItem(REMINDERS_STORAGE_KEY, reminders, userOrId)
}
