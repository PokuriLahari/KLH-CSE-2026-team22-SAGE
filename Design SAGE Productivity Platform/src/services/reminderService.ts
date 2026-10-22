// ==================================================
// SAGE REMINDERS API SERVICE
// ==================================================
// Connects frontend reminder state with backend Spring Boot persistence (/api/reminders).
// Provides seamless synchronization with PostgreSQL database and Resend email delivery.
// ==================================================

import { apiClient } from "../api/client.ts"
import type { Reminder } from "../notifications.ts"

export type BackendReminder = {
  id: number
  userId: number
  title: string
  dueAt: string
  status: "open" | "completed" | "snoozed" | "dismissed"
  method: string
  notificationTiming: string
  targetType: string
  targetId?: string
  contestId?: string
  platform?: string
  contestUrl?: string
  eventStartTime?: string
  notifiedAt?: string
  snoozedUntil?: string
  completedAt?: string
  deliveryStatus: "PENDING" | "DELIVERED" | "FAILED" | "SKIPPED"
  deliveryAttempts: number
  deliveryError?: string
  createdAt: string
  updatedAt: string
}

export type TestEmailResponse = {
  success: boolean
  recipient: string
  configured: boolean
  messageId?: string
  message?: string
  error?: string
}

/**
 * Maps a backend persisted reminder entity to the frontend Reminder model.
 */
export function backendReminderToFrontend(b: BackendReminder): Reminder {
  let date = ""
  let time = "09:00"
  if (b.dueAt) {
    try {
      const dt = new Date(b.dueAt)
      if (!isNaN(dt.getTime())) {
        date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
        time = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
      }
    } catch {}
  }
  return {
    id: b.id,
    title: b.title,
    date,
    time,
    dueAt: b.dueAt,
    createdAt: b.createdAt || new Date().toISOString(),
    completedAt: b.completedAt,
    snoozedUntil: b.snoozedUntil,
    status: (b.status === "completed" || b.status === "snoozed") ? b.status : "open",
    method: b.method || "Email + In-app",
    read: b.deliveryStatus === "DELIVERED",
    dismissed: b.status === "dismissed",
    notificationTiming: (b.notificationTiming as any) || "exact",
    notifiedAt: b.notifiedAt,
    targetType: b.targetType as any,
    targetId: b.targetId,
    contestId: b.contestId,
    platform: b.platform,
    contestUrl: b.contestUrl,
    eventStartTime: b.eventStartTime,
  }
}

/**
 * Fetches all persisted reminders for the authenticated student from PostgreSQL.
 */
export async function getBackendReminders(): Promise<BackendReminder[]> {
  try {
    return await apiClient.get<BackendReminder[]>("/reminders")
  } catch (err) {
    console.warn("Could not fetch reminders from backend:", err)
    return []
  }
}

/**
 * Creates or updates a reminder in PostgreSQL.
 */
export async function syncReminderToBackend(
  reminder: Partial<Reminder>,
): Promise<BackendReminder | null> {
  try {
    return await apiClient.post<BackendReminder>("/reminders", reminder)
  } catch (err) {
    console.warn("Could not sync reminder to backend:", err)
    return null
  }
}

/**
 * Updates a reminder status (completed, snoozed, dismissed) on the backend.
 */
export async function updateBackendReminderStatus(
  id: number | string,
  updates: { status?: string; snoozedUntil?: string; completedAt?: string },
): Promise<BackendReminder | null> {
  try {
    return await apiClient.patch<BackendReminder>(`/reminders/${id}`, updates)
  } catch (err) {
    console.warn("Could not update reminder on backend:", err)
    return null
  }
}

/**
 * Deletes a reminder from PostgreSQL.
 */
export async function deleteBackendReminder(id: number | string): Promise<boolean> {
  try {
    await apiClient.delete(`/reminders/${id}`)
    return true
  } catch (err) {
    console.warn("Could not delete reminder on backend:", err)
    return false
  }
}

/**
 * Sends a single verified test reminder email to the authenticated user's address.
 */
export async function sendTestReminderEmail(title?: string): Promise<TestEmailResponse> {
  return await apiClient.post<TestEmailResponse>("/reminders/test-email", { title })
}
