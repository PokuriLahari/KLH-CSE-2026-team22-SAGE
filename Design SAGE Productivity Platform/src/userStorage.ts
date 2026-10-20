// ==================================================
// SAGE USER-SCOPED STORAGE ENGINE
// ==================================================
// Principles:
// 1. Data Isolation: Every user's timetable, tasks, goals, events,
//    and preferences are stored under their stable backend user ID.
// 2. No Global Leaks: Never fall back to or write to un-scoped global keys.
// 3. User Identity Hierarchy:
//    - Primary: user.id (stable numeric backend ID from SAGE auth database)
//    - Secondary: user.email (only if user.id is not yet available)
//    - Fallback: 'guest' (unauthenticated browsing only)
// 4. Safe Preservation: Never delete or overwrite other users' storage.
// ==================================================

export type UserIdentifier = {
  id?: number | string | null
  email?: string | null
} | number | string | null | undefined

/**
 * Returns a consistent storage key scoped to the authenticated user.
 * Priority: user.id -> user.email -> active stored auth user -> 'guest'
 */
export function getUserScopeKey(
  baseKey: string,
  userOrId?: UserIdentifier,
): string {
  // 1. If explicit user or ID is provided
  if (userOrId != null) {
    if (typeof userOrId === "number") {
      return `${baseKey}_user_${userOrId}`
    }
    if (typeof userOrId === "string" && userOrId.trim()) {
      const trimmed = userOrId.trim()
      if (/^\d+$/.test(trimmed)) {
        return `${baseKey}_user_${trimmed}`
      }
      return `${baseKey}_email_${trimmed.toLowerCase()}`
    }
    if (typeof userOrId === "object") {
      if (userOrId.id != null && String(userOrId.id).trim()) {
        return `${baseKey}_user_${userOrId.id}`
      }
      if (userOrId.email && userOrId.email.trim()) {
        return `${baseKey}_email_${userOrId.email.toLowerCase().trim()}`
      }
    }
  }

  // 2. Check active auth user in localStorage if running in browser
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("sage_auth_user")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.id != null && String(parsed.id).trim()) {
          return `${baseKey}_user_${parsed.id}`
        }
        if (
          parsed?.email &&
          typeof parsed.email === "string" &&
          parsed.email.trim()
        ) {
          return `${baseKey}_email_${parsed.email.toLowerCase().trim()}`
        }
      }
    } catch {}
  }

  return `${baseKey}_guest`
}

/**
 * Loads a user-scoped JSON item from localStorage.
 * Does NOT fall back to un-scoped global keys.
 */
export function getUserItem<T>(
  baseKey: string,
  userOrId?: UserIdentifier,
): T | null {
  if (typeof window === "undefined") return null
  try {
    const key = getUserScopeKey(baseKey, userOrId)
    const raw = window.localStorage.getItem(key)
    if (raw) {
      return JSON.parse(raw) as T
    }
  } catch {}
  return null
}

/**
 * Saves a user-scoped JSON item into localStorage.
 */
export function setUserItem<T>(
  baseKey: string,
  value: T,
  userOrId?: UserIdentifier,
): void {
  if (typeof window === "undefined") return
  try {
    const key = getUserScopeKey(baseKey, userOrId)
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

/**
 * Removes a user-scoped item from localStorage.
 */
export function removeUserItem(
  baseKey: string,
  userOrId?: UserIdentifier,
): void {
  if (typeof window === "undefined") return
  try {
    const key = getUserScopeKey(baseKey, userOrId)
    window.localStorage.removeItem(key)
  } catch {}
}

/**
 * Permanently removes all stored data associated with the specified user
 * from both localStorage and sessionStorage.
 *
 * CRITICAL ISOLATION RULE:
 * Only removes keys scoped to this specific user (e.g. matching _user_${id} or _email_${email})
 * and active session credentials. NEVER deletes keys belonging to other users.
 */
export function clearUserStorage(userOrId?: UserIdentifier): void {
  if (typeof window === "undefined") return

  // 1. Identify target user ID and email
  let targetId: string | null = null
  let targetEmail: string | null = null

  if (userOrId != null) {
    if (typeof userOrId === "number") {
      targetId = String(userOrId)
    } else if (typeof userOrId === "string" && userOrId.trim()) {
      const trimmed = userOrId.trim()
      if (/^\d+$/.test(trimmed)) {
        targetId = trimmed
      } else {
        targetEmail = trimmed.toLowerCase()
      }
    } else if (typeof userOrId === "object") {
      if (userOrId.id != null && String(userOrId.id).trim()) {
        targetId = String(userOrId.id).trim()
      }
      if (userOrId.email && userOrId.email.trim()) {
        targetEmail = userOrId.email.toLowerCase().trim()
      }
    }
  }

  // Fallback to active stored auth user if not explicitly passed
  if (!targetId && !targetEmail) {
    try {
      const raw = window.localStorage.getItem("sage_auth_user")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.id != null) targetId = String(parsed.id)
        if (parsed?.email)
          targetEmail = String(parsed.email).toLowerCase().trim()
      }
    } catch {}
  }

  const idSuffix = targetId ? `_user_${targetId}` : null
  const emailSuffix = targetEmail ? `_email_${targetEmail}` : null

  const purgeStorage = (storage: Storage) => {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (!key) continue

        const isUserScoped =
          (idSuffix && (key.endsWith(idSuffix) || key.includes(idSuffix))) ||
          (emailSuffix &&
            (key.endsWith(emailSuffix) || key.includes(emailSuffix)))

        if (isUserScoped) {
          keysToRemove.push(key)
        }
      }

      for (const k of keysToRemove) {
        storage.removeItem(k)
      }
    } catch {}
  }

  purgeStorage(window.localStorage)
  purgeStorage(window.sessionStorage)

  // 2. Remove session keys that belong to this active user
  const sessionKeys = [
    "sage_auth_user",
    "sage_auth_token",
    "sage_onboarding_completed",
    "sage-user-profile",
    "sage_google_calendar_token",
    "sage_google_calendar_token_exp",
    "sage_google_calendar_connected",
    "sage_custom_google_client_id",
    "sage_chat_session",
    // Un-scoped fallback keys that might have been written during this session
    "sage-tasks",
    "sage-goals",
    "sage-events",
    "sage-timetable",
    "sage-user-preferences",
    "sage-platforms",
    "sage-notification-preferences",
    "sage-reminders",
    "sage-focus-sessions",
    "sage-contest-reminders",
    "sage-recommendation-events",
    "sage-focus-session-events",
  ]

  for (const k of sessionKeys) {
    try {
      window.localStorage.removeItem(k)
      window.sessionStorage.removeItem(k)
    } catch {}
  }
}
