import { classifyEndpoint, recordDiagnostic, redact } from "../diagnostics.ts"
// ==================================================
// SAGE CENTRALIZED API CLIENT
// ==================================================
// Principles:
// 1. Same-origin '/api' endpoint routed through Vite dev proxy to Spring Cloud Gateway (:8080).
// 2. Automatically attaches Bearer token if 'sage_auth_token' exists in storage.
// 3. User-safe error masking: never exposes raw Java/Spring stack traces or DB errors.
// 4. Centralized methods: get, post, patch, delete.
// ==================================================

export class ApiError extends Error {
  status: number
  data?: unknown
  requestId?: string

  constructor(
    status: number,
    message: string,
    data?: unknown,
    requestId?: string,
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
    this.requestId = requestId
  }
}

const TOKEN_KEY = "sage_auth_token"

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {}
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(TOKEN_KEY)
    document.cookie =
      "sage_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0"
  } catch {}
}

const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_API_BASE_URL as string)) ||
  "/api"

/**
 * Normalizes user-safe error message avoiding technical jargon
 */
function sanitizeErrorMessage(
  status: number,
  rawMessage?: string,
  isAuthEndpoint?: boolean,
): string {
  if (status === 502 || status === 503 || rawMessage === "Service Unavailable") {
    return isAuthEndpoint
      ? "Authentication service is temporarily unavailable or starting up. Please try again in a moment."
      : "The service is temporarily unavailable. Please try again in a moment."
  }
  if (
    rawMessage &&
    typeof rawMessage === "string" &&
    !rawMessage.includes("Exception") &&
    !rawMessage.includes("org.springframework") &&
    !rawMessage.includes("JDBC") &&
    !rawMessage.includes("SQL")
  ) {
    return rawMessage
  }
  if (status === 401) {
    return isAuthEndpoint
      ? "Authentication failed. Please check your credentials and try again."
      : "Your session has expired. Please sign in again."
  }
  if (status === 403) {
    return "You don't have permission to perform this action."
  }
  if (status === 404) {
    return "The requested resource could not be found."
  }
  if (status >= 500) {
    return "Something went wrong while loading your information."
  }
  return "We couldn't connect to SAGE right now. Please try again in a moment."
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  const url = cleanEndpoint.startsWith("http")
    ? cleanEndpoint
    : `${API_BASE_URL}${cleanEndpoint}`

  const headers = new Headers(options.headers || {})
  const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
  headers.set("X-Request-Id", requestId)

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  const token = getStoredToken()
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const startedAt = performance.now()
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 204) {
      return {} as T
    }

    const contentType = response.headers.get("content-type")
    let data: unknown = null
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json()
      } catch {
        data = null
      }
    } else {
      try {
        data = await response.text()
      } catch {
        data = null
      }
    }

    if (!response.ok) {
      let rawMsg: string | undefined
      if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>
        if (typeof obj.message === "string") rawMsg = obj.message
        else if (typeof obj.error === "string") rawMsg = obj.error
      }

      const isAuthEndpoint =
        cleanEndpoint.startsWith("/auth/google") ||
        cleanEndpoint.startsWith("/auth/login")

      if (response.status === 401 && !isAuthEndpoint) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sage:unauthorized"))
        }
      }

      const serverRequestId = response.headers.get("X-Request-Id") || (data && typeof data === "object" ? String((data as Record<string, unknown>).requestId || "") : "") || requestId
      const message = sanitizeErrorMessage(response.status, rawMsg, isAuthEndpoint)
      recordDiagnostic({ severity: response.status >= 500 || response.status === 0 ? "error" : "warning", source: classifyEndpoint(cleanEndpoint), title: "Failed API request", message, observed: true, method: options.method || "GET", endpoint: cleanEndpoint, status: response.status, durationMs: Math.round(performance.now() - startedAt), requestId: serverRequestId, details: redact({ response: data }) as Record<string, unknown> })
      throw new ApiError(
        response.status,
        message,
        data,
        serverRequestId,
      )
    }

    return data as T
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err
    }
    const message = err instanceof TypeError ? "Network request failed. This may be an unavailable service, connection refusal, or a browser CORS restriction." : "We couldn't connect to SAGE right now. Please try again in a moment."
    recordDiagnostic({ severity: "error", source: "Network", title: "Network request failed", message, observed: true, method: options.method || "GET", endpoint: cleanEndpoint, status: 0, durationMs: Math.round(performance.now() - startedAt), requestId, details: redact({ error: err instanceof Error ? err.message : String(err), suspectedCause: "Browsers do not expose a definitive CORS cause; this is an observed network failure." }) as Record<string, unknown> })
    throw new ApiError(
      0,
      message,
      undefined,
      requestId,
    )
  }
}

export const apiClient = {
  get: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { ...options, method: "GET" }),
  post: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: "POST",
      body:
        body !== undefined
          ? body instanceof FormData
            ? body
            : JSON.stringify(body)
          : undefined,
    }),
  put: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: "PUT",
      body:
        body !== undefined
          ? body instanceof FormData
            ? body
            : JSON.stringify(body)
          : undefined,
    }),
  patch: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: "PATCH",
      body:
        body !== undefined
          ? body instanceof FormData
            ? body
            : JSON.stringify(body)
          : undefined,
    }),
  delete: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { ...options, method: "DELETE" }),
}
