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
 * Determines whether an HTTP status or raw message corresponds to a transient/cold-start error.
 */
export function isTransientErrorStatus(
  status: number,
  rawMessage?: string,
): boolean {
  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 0 ||
    rawMessage === "Service Unavailable" ||
    rawMessage === "Bad Gateway" ||
    rawMessage === "Gateway Timeout"
  )
}

/**
 * Normalizes user-safe error message avoiding technical jargon
 */
export function sanitizeErrorMessage(
  status: number,
  rawMessage?: string,
  isAuthEndpoint?: boolean,
): string {
  if (isTransientErrorStatus(status, rawMessage)) {
    return isAuthEndpoint
      ? "Authentication service is starting. Please retry shortly."
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

export type RequestOptions = RequestInit & {
  timeoutMs?: number
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
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

  let timerId: ReturnType<typeof setTimeout> | undefined
  const internalController = new AbortController()
  const callerSignal = options.signal

  if (callerSignal?.aborted) {
    throw (
      callerSignal.reason ??
      new DOMException("The operation was aborted.", "AbortError")
    )
  }

  const timeoutMs =
    options.timeoutMs ?? (cleanEndpoint.startsWith("/auth/") ? 15000 : 20000)

  const onCallerAbort = () => {
    internalController.abort(
      callerSignal?.reason ??
        new DOMException("The operation was aborted.", "AbortError"),
    )
  }

  if (callerSignal) {
    callerSignal.addEventListener("abort", onCallerAbort, { once: true })
  }

  if (timeoutMs > 0 && timeoutMs !== Number.POSITIVE_INFINITY) {
    timerId = setTimeout(() => {
      internalController.abort(
        new DOMException("The request timed out.", "TimeoutError"),
      )
    }, timeoutMs)
  }

  const signal = internalController.signal

  const startedAt = performance.now()
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal,
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

      const serverRequestId =
        response.headers.get("X-Request-Id") ||
        (data && typeof data === "object"
          ? String((data as Record<string, unknown>).requestId || "")
          : "") ||
        requestId
      const message = sanitizeErrorMessage(
        response.status,
        rawMsg,
        isAuthEndpoint,
      )
      recordDiagnostic({
        severity:
          response.status >= 500 || response.status === 0
            ? "error"
            : "warning",
        source: classifyEndpoint(cleanEndpoint),
        title: "Failed API request",
        message,
        observed: true,
        method: options.method || "GET",
        endpoint: cleanEndpoint,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        requestId: serverRequestId,
        details: redact({ response: data }) as Record<string, unknown>,
      })
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
    const isTimeout =
      (err instanceof DOMException && err.name === "TimeoutError") ||
      (err instanceof Error && err.name === "TimeoutError") ||
      (internalController.signal.aborted &&
        internalController.signal.reason instanceof DOMException &&
        internalController.signal.reason.name === "TimeoutError")

    const isCallerAbort =
      !isTimeout &&
      (Boolean(callerSignal?.aborted) ||
        (err instanceof DOMException && err.name === "AbortError"))

    if (isCallerAbort) {
      throw err instanceof Error
        ? err
        : new DOMException("The operation was aborted.", "AbortError")
    }
    const isAuthEndpoint =
      cleanEndpoint.startsWith("/auth/google") ||
      cleanEndpoint.startsWith("/auth/login")

    let message: string
    if (isAuthEndpoint && (isTimeout || err instanceof TypeError)) {
      message = "Authentication service is starting. Please retry shortly."
    } else if (err instanceof TypeError) {
      message =
        "Network request failed. This may be an unavailable service, connection refusal, or a browser CORS restriction."
    } else if (isTimeout) {
      message = "The request timed out. Please try again."
    } else {
      message =
        "We couldn't connect to SAGE right now. Please try again in a moment."
    }

    recordDiagnostic({
      severity: "error",
      source: "Network",
      title: isTimeout ? "Request timed out" : "Network request failed",
      message,
      observed: true,
      method: options.method || "GET",
      endpoint: cleanEndpoint,
      status: 0,
      durationMs: Math.round(performance.now() - startedAt),
      requestId,
      details: redact({
        error: err instanceof Error ? err.message : String(err),
        isTimeout,
        suspectedCause: isTimeout
          ? "Request exceeded bounded timeout limit."
          : "Network connectivity or CORS restriction.",
      }) as Record<string, unknown>,
    })
    throw new ApiError(
      0,
      message,
      undefined,
      requestId,
    )
  } finally {
    if (timerId) {
      clearTimeout(timerId)
    }
    if (callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort)
    }
  }
}

let lastPrewarmTimestamp = 0
const PREWARM_COOLDOWN_MS = 300_000 // 5 minutes

export function prewarmBackend(force = false): void {
  if (typeof window === "undefined") return
  const now = Date.now()
  if (!force && now - lastPrewarmTimestamp < PREWARM_COOLDOWN_MS) return
  lastPrewarmTimestamp = now
  // Non-blocking fire-and-forget ping to wake up sleeping backend container
  apiClient.get("/health", { timeoutMs: 8000 }).catch(() => {
    // Silently ignore failures during pre-warm; Render receives incoming probe
  })
}

export function resetPrewarmCooldownForTesting(): void {
  lastPrewarmTimestamp = 0
}

export const apiClient = {
  get: <T>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "GET" }),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
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
  put: <T>(url: string, body?: unknown, options?: RequestOptions) =>
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
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
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
  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "DELETE" }),
  prewarm: prewarmBackend,
}
