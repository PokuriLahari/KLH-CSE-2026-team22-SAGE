export type ImportedCalendarEvent = {
  externalId: string
  title: string
  date: string
  time: string
  endTime: string
}

export type SageCalendarEvent = {
  localId?: number
  externalId?: string
  title: string
  type?: string
  date?: string
  time?: string
  endTime?: string
}

export type CalendarSyncResult = {
  importedEvents: ImportedCalendarEvent[]
  links: Record<number, string>
  lastSyncedAt?: string
  mode?: "live" | "connected"
}

export type GoogleUser = {
  email: string
  name: string
  picture?: string
}

type GoogleTokenResponse = {
  access_token?: string
  error?: string
}

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void
}

type GoogleCalendarDate = {
  date?: string
  dateTime?: string
}

type GoogleCalendarEvent = {
  id?: string
  summary?: string
  start?: GoogleCalendarDate
  end?: GoogleCalendarDate
  status?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id?: {
          initialize: (options: {
            client_id: string
            callback: (response: {
              credential?: string
              select_by?: string
            }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            itp_support?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string
              theme?: string
              size?: string
              text?: string
              shape?: string
              width?: number
              logo_alignment?: string
            },
          ) => void
          prompt: () => void
          disableAutoSelect?: () => void
        }
        oauth2?: {
          initTokenClient: (options: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
            error_callback: (err?: unknown) => void
          }) => GoogleTokenClient
          revoke: (token: string, callback?: () => void) => void
        }
      }
    }
  }
}

const DEFAULT_CLIENT_ID =
  "832115590292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com"
const TOKEN_KEY = "sage_google_calendar_token"
const TOKEN_EXP_KEY = "sage_google_calendar_token_exp"
const CONNECTED_FLAG_KEY = "sage_google_calendar_connected"
const CUSTOM_CLIENT_ID_KEY = "sage_google_client_id"

let inMemoryToken = ""

/**
 * Returns the active Google Client ID
 */
export function getGoogleClientId(): string {
  if (typeof window !== "undefined") {
    try {
      const custom = window.localStorage.getItem(CUSTOM_CLIENT_ID_KEY)
      if (custom && custom.trim()) return custom.trim()
    } catch {}
  }
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID
}

export function setCustomGoogleClientId(id: string): void {
  if (typeof window !== "undefined") {
    try {
      if (id && id.trim()) {
        window.localStorage.setItem(CUSTOM_CLIENT_ID_KEY, id.trim())
      } else {
        window.localStorage.removeItem(CUSTOM_CLIENT_ID_KEY)
      }
    } catch {}
  }
}

export function getCustomGoogleClientId(): string {
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(CUSTOM_CLIENT_ID_KEY) || ""
    } catch {}
  }
  return ""
}

export const googleClientId = getGoogleClientId()

/**
 * Checks if Google Calendar is currently connected
 */
export function isGoogleCalendarConnected(): boolean {
  return Boolean(getCalendarAccessToken())
}

export function getCalendarAccessToken(): string {
  if (inMemoryToken) return inMemoryToken
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(TOKEN_KEY)
      const exp = Number(window.sessionStorage.getItem(TOKEN_EXP_KEY) || 0)
      if (stored && exp > Date.now()) {
        inMemoryToken = stored
        return inMemoryToken
      }
    } catch {}
  }
  return ""
}

/**
 * Safely loads Google Identity Services SDK
 */
export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.oauth2 && window.google?.accounts?.id) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-sage-google-identity]",
    )
    if (existing) {
      if (window.google?.accounts) {
        resolve()
        return
      }
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => resolve(), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.dataset.sageGoogleIdentity = "true"
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })
}

/**
 * Generates an official 1-click Google Calendar web creation URL.
 * Works universally for ANY user without requiring OAuth or API keys!
 */
export function createGoogleCalendarWebUrl(event: SageCalendarEvent): string {
  const title = encodeURIComponent(event.title || "SAGE Task")
  const details = encodeURIComponent(
    `Synced from SAGE · ${event.type}\nOrganized in SAGE Student Workspace`,
  )
  let dates = ""

  if (event.date) {
    const cleanDate = event.date.replace(/-/g, "")
    if (event.time) {
      const cleanStart = `${cleanDate}T${event.time.replace(/:/g, "")}00`
      let cleanEnd = ""
      if (event.endTime) {
        cleanEnd = `${cleanDate}T${event.endTime.replace(/:/g, "")}00`
      } else {
        const startHour = Number(event.time.slice(0, 2)) || 0
        const endHour = String((startHour + 1) % 24).padStart(2, "0")
        cleanEnd = `${cleanDate}T${endHour}${event.time.slice(3, 5)}00`
      }
      dates = `&dates=${cleanStart}/${cleanEnd}`
    } else {
      const nextDay = addDays(event.date, 1).replace(/-/g, "")
      dates = `&dates=${cleanDate}/${nextDay}`
    }
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}${dates}`
}

export function openInGoogleCalendar(event: SageCalendarEvent): void {
  const url = createGoogleCalendarWebUrl(event)
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

/**
 * Requests an OAuth2 access token with calendar.events scope.
 */
export function requestCalendarToken(
  clientId?: string,
  promptConsent = false,
): Promise<string> {
  const currentToken = getCalendarAccessToken()
  if (currentToken && !promptConsent) return Promise.resolve(currentToken)

  const activeClientId = clientId || getGoogleClientId()

  return new Promise((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2
    if (!oauth) {
      reject(new Error("identity-unavailable"))
      return
    }

    try {
      const client = oauth.initTokenClient({
        client_id: activeClientId,
        scope: "https://www.googleapis.com/auth/calendar.events",
        callback: (response) => {
          if (!response.access_token || response.error) {
            reject(new Error(response.error || "authorization-declined"))
            return
          }
          inMemoryToken = response.access_token
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(TOKEN_KEY, inMemoryToken)
              window.sessionStorage.setItem(
                TOKEN_EXP_KEY,
                String(Date.now() + 3500 * 1000),
              )
              window.localStorage.setItem(CONNECTED_FLAG_KEY, "true")
            } catch {}
          }
          resolve(inMemoryToken)
        },
        error_callback: (err) => {
          reject(err || new Error("authorization-declined"))
        },
      })

      client.requestAccessToken({
        prompt: promptConsent ? "select_account" : "",
      })
    } catch (e) {
      reject(e)
    }
  })
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + days)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

function googleEventBody(event: SageCalendarEvent) {
  const eventDate = event.date || new Date().toISOString().split("T")[0]
  if (!event.time) {
    return {
      summary: event.title,
      description: `Synced from SAGE · ${event.type}`,
      start: { date: eventDate },
      end: { date: addDays(eventDate, 1) },
    }
  }
  const start = new Date(`${eventDate}T${event.time}:00`)
  const end = event.endTime
    ? new Date(`${eventDate}T${event.endTime}:00`)
    : new Date(start.getTime() + 60 * 60 * 1000)
  return {
    summary: event.title,
    description: `Synced from SAGE · ${event.type}`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}

async function calendarRequest(
  path: string,
  token: string,
  options?: RequestInit,
) {
  return fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    },
  )
}

function calendarDate(value?: string) {
  if (!value) return { date: "", time: "" }
  const parsed = new Date(value)
  if (value.length === 10 || Number.isNaN(parsed.getTime()))
    return { date: value.slice(0, 10), time: "" }
  return {
    date: `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`,
    time: `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`,
  }
}

/**
 * Universal calendar synchronization:
 * 1. Attempts live Google Calendar API sync if token/cloud permissions are available.
 * 2. If Google OAuth is in local dev mode or origin mismatch occurs, seamlessly switches
 *    to connected mode with realistic Google Calendar sync for any user!
 */
export async function syncGoogleCalendarEvents(
  sageEvents: SageCalendarEvent[],
  forceLiveOAuth = false,
): Promise<CalendarSyncResult> {
  await loadGoogleIdentity()
  let token = getCalendarAccessToken()

  // Only launch Google OAuth popup if live OAuth was explicitly requested
  if (!token && forceLiveOAuth && window.google?.accounts?.oauth2) {
    try {
      token = await Promise.race([
        requestCalendarToken(getGoogleClientId(), true),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("oauth-timeout")), 8000),
        ),
      ])
    } catch {
      // Fallback seamlessly to universal sync
    }
  }

  const links: Record<number, string> = {}

  // If we have a valid live Google OAuth access token, perform live Google REST API sync
  if (token) {
    try {
      for (const event of sageEvents.filter((item) => item.date)) {
        try {
          const path = event.externalId
            ? `/events/${encodeURIComponent(event.externalId)}`
            : "/events"
          const response = await calendarRequest(path, token, {
            method: event.externalId ? "PATCH" : "POST",
            body: JSON.stringify(googleEventBody(event)),
          })
          if (response.ok) {
            const saved = (await response.json()) as { id?: string }
            if (saved.id && event.localId !== undefined)
              links[event.localId] = saved.id
          }
        } catch {}
      }

      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 14)
      const query = new URLSearchParams({
        timeMin: pastDate.toISOString(),
        maxResults: "250",
        singleEvents: "true",
        orderBy: "startTime",
      })

      const response = await calendarRequest(`/events?${query}`, token)
      if (response.ok) {
        const payload = (await response.json()) as {
          items?: GoogleCalendarEvent[]
        }
        const importedEvents = (payload.items || [])
          .filter((event) => event.id && event.status !== "cancelled")
          .map((event) => {
            const start = calendarDate(
              event.start?.dateTime || event.start?.date,
            )
            const end = calendarDate(event.end?.dateTime || event.end?.date)
            return {
              externalId: event.id as string,
              title: event.summary || "(No title)",
              date: start.date,
              time: start.time,
              endTime: end.time,
            }
          })

        if (typeof window !== "undefined") {
          window.localStorage.setItem(CONNECTED_FLAG_KEY, "true")
        }

        return {
          importedEvents,
          links,
          lastSyncedAt: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          mode: "live",
        }
      } else {
        throw new Error("sync-failed")
      }
    } catch (e) {
      throw e
    }
  }

  // Not connected or authorization declined: throw honest error, never invent fake events
  throw new Error("not-connected")
}

/**
 * Pushes a single SAGE event to Google Calendar
 */
export async function pushGoogleCalendarEvent(
  event: SageCalendarEvent,
): Promise<string | null> {
  const token = getCalendarAccessToken()
  if (token && event.date) {
    try {
      const path = event.externalId
        ? `/events/${encodeURIComponent(event.externalId)}`
        : "/events"
      const response = await calendarRequest(path, token, {
        method: event.externalId ? "PATCH" : "POST",
        body: JSON.stringify(googleEventBody(event)),
      })
      if (response.ok) {
        const saved = (await response.json()) as { id?: string }
        return saved.id || null
      }
    } catch {}
  }
  return event.externalId || null
}

export async function deleteGoogleCalendarEvent(
  externalId?: string,
): Promise<void> {
  const token = getCalendarAccessToken()
  if (token && externalId && !externalId.startsWith("gcal_")) {
    try {
      await calendarRequest(
        `/events/${encodeURIComponent(externalId)}`,
        token,
        { method: "DELETE" },
      )
    } catch {}
  }
}

/**
 * Disconnects Google Calendar
 */
export function disconnectGoogleCalendar(): void {
  const token = getCalendarAccessToken()
  if (token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token)
    } catch {}
  }
  inMemoryToken = ""
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(TOKEN_KEY)
      window.sessionStorage.removeItem(TOKEN_EXP_KEY)
      window.localStorage.removeItem(CONNECTED_FLAG_KEY)
    } catch {}
  }
}

/**
 * Decodes Google JWT identity token
 */
export function parseGoogleJwtProfile(credential: string): GoogleUser | null {
  try {
    const parts = credential.split(".")
    if (parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    )
    const data = JSON.parse(jsonPayload) as {
      email?: string
      name?: string
      picture?: string
    }
    if (!data.email) return null
    return {
      email: data.email,
      name: data.name || data.email.split("@")[0],
      picture: data.picture,
    }
  } catch {
    return null
  }
}

export function signOutGoogle(): void {
  if (typeof window !== "undefined") {
    try {
      const googleId = (window as unknown as {
        google?: { accounts?: { id?: { disableAutoSelect?: () => void } } }
      }).google?.accounts?.id
      googleId?.disableAutoSelect?.()
    } catch {}
  }
}
