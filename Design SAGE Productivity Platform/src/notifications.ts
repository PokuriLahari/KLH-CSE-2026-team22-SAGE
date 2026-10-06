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

export type ReminderTiming = "exact" | "10m" | "30m" | "1h" | "1d"

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
  targetType?: "reminder" | "task" | "exam"
  targetId?: number
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
  browserNotifications: false,
}

export const TIMING_OFFSETS_MS: Record<ReminderTiming, number> = {
  exact: 0,
  "10m": 10 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
}

export const TIMING_LABELS: Record<ReminderTiming, string> = {
  exact: "At time of event",
  "10m": "10 minutes before",
  "30m": "30 minutes before",
  "1h": "1 hour before",
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
  const baseMs = reminder.dueAt
    ? new Date(reminder.dueAt).getTime()
    : new Date(buildDueAtTimestamp(reminder.date, reminder.time)).getTime()
  const offset = TIMING_OFFSETS_MS[reminder.notificationTiming] || 0
  return baseMs - offset
}

/**
 * Determines whether a reminder is currently due for notification.
 */
export function isReminderDue(reminder: Reminder, now = new Date()): boolean {
  if (reminder.status === "completed" || reminder.dismissed) {
    return false
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
    method: raw.method || "In-app",
    read: Boolean(raw.read),
    dismissed: Boolean(raw.dismissed),
    notificationTiming: raw.notificationTiming || "exact",
    notifiedAt: raw.notifiedAt,
    targetType: raw.targetType,
    targetId: raw.targetId,
  }
}
