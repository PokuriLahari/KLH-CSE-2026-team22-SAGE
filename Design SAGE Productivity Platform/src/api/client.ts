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
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
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
  } catch {}
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string || "/api"

/**
 * Normalizes user-safe error message avoiding technical jargon
 */
function sanitizeErrorMessage(status: number, rawMessage?: string): string {
  if (status === 401) {
    return "Your session has expired. Please sign in again."
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

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  const token = getStoredToken()
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sage:unauthorized"))
      }
      throw new ApiError(401, sanitizeErrorMessage(401))
    }

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
      throw new ApiError(
        response.status,
        sanitizeErrorMessage(response.status, rawMsg),
        data,
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
    throw new ApiError(
      0,
      "We couldn't connect to SAGE right now. Please try again in a moment.",
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
