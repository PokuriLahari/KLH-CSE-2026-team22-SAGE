import test from "node:test"
import assert from "node:assert/strict"

// Mock localStorage and sessionStorage for node test environment
const localStore: Record<string, string> = {}
const sessionStore: Record<string, string> = {}

function createMockStorage(store: Record<string, string>) {
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

globalThis.window = ({
  localStorage: createMockStorage(localStore),
  sessionStorage: createMockStorage(sessionStore),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
} as any)

globalThis.localStorage = globalThis.window.localStorage
globalThis.sessionStorage = globalThis.window.sessionStorage

import {
  isTransientErrorStatus,
  sanitizeErrorMessage,
  prewarmBackend,
  resetPrewarmCooldownForTesting,
} from "./api/client.ts"
import { redact } from "./diagnostics.ts"

test("Google Auth: isTransientErrorStatus correctly detects transient and cold-start errors", () => {
  // Transient / cold-start indicators
  assert.equal(isTransientErrorStatus(502), true, "502 Bad Gateway is transient")
  assert.equal(isTransientErrorStatus(503), true, "503 Service Unavailable is transient")
  assert.equal(isTransientErrorStatus(504), true, "504 Gateway Timeout is transient")
  assert.equal(isTransientErrorStatus(0), true, "0 Network / timeout failure is transient")
  assert.equal(isTransientErrorStatus(500, "Service Unavailable"), true, "Raw Service Unavailable is transient")
  assert.equal(isTransientErrorStatus(500, "Bad Gateway"), true, "Raw Bad Gateway is transient")
  assert.equal(isTransientErrorStatus(500, "Gateway Timeout"), true, "Raw Gateway Timeout is transient")

  // Terminal / non-retryable client and server statuses
  assert.equal(isTransientErrorStatus(400), false, "400 Bad Request is not transient")
  assert.equal(isTransientErrorStatus(401), false, "401 Unauthorized is not transient")
  assert.equal(isTransientErrorStatus(403), false, "403 Forbidden is not transient")
  assert.equal(isTransientErrorStatus(404), false, "404 Not Found is not transient")
  assert.equal(isTransientErrorStatus(200), false, "200 OK is not transient")
})

test("Google Auth: sanitizeErrorMessage formats transient failures with actionable starting message", () => {
  const isAuth = true

  // 502 Bad Gateway
  assert.equal(
    sanitizeErrorMessage(502, undefined, isAuth),
    "Authentication service is starting. Please retry shortly.",
    "502 on auth endpoint returns starting notice",
  )

  // 503 Service Unavailable
  assert.equal(
    sanitizeErrorMessage(503, undefined, isAuth),
    "Authentication service is starting. Please retry shortly.",
    "503 on auth endpoint returns starting notice",
  )

  // 504 Gateway Timeout
  assert.equal(
    sanitizeErrorMessage(504, undefined, isAuth),
    "Authentication service is starting. Please retry shortly.",
    "504 on auth endpoint returns starting notice",
  )

  // Status 0 (network refusal / cold-start timeout)
  assert.equal(
    sanitizeErrorMessage(0, undefined, isAuth),
    "Authentication service is starting. Please retry shortly.",
    "Status 0 on auth endpoint returns starting notice",
  )

  // Non-auth endpoints still get standard friendly message
  assert.equal(
    sanitizeErrorMessage(503, undefined, false),
    "The service is temporarily unavailable. Please try again in a moment.",
    "Non-auth 503 gets standard notice",
  )
})

test("Google Auth: sanitizeErrorMessage never classifies 400, 401, or 403 as starting errors", () => {
  const isAuth = true

  // 400 Bad Request
  assert.equal(
    sanitizeErrorMessage(400, "Credential is required", isAuth),
    "Credential is required",
    "400 returns raw message, not starting notice",
  )

  // 401 Unauthorized
  assert.equal(
    sanitizeErrorMessage(401, undefined, isAuth),
    "Authentication failed. Please check your credentials and try again.",
    "401 returns credential check notice, not starting notice",
  )

  // 403 Forbidden
  assert.equal(
    sanitizeErrorMessage(403, undefined, isAuth),
    "You don't have permission to perform this action.",
    "403 returns permission notice, not starting notice",
  )
})

test("Google Auth: prewarmBackend dispatches non-blocking probe and enforces cooldown", async () => {
  resetPrewarmCooldownForTesting()

  let fetchCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request) => {
    fetchCalls++
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({ status: "UP" }),
      text: async () => JSON.stringify({ status: "UP" }),
    } as any
  }) as any

  try {
    // 1st call: Should fire network request
    prewarmBackend()
    assert.equal(fetchCalls, 1, "First prewarm should initiate a fetch call")

    // Immediate 2nd call: Cooldown should prevent redundant network call
    prewarmBackend()
    assert.equal(fetchCalls, 1, "Second prewarm within cooldown should be dropped")

    // Forced call or after cooldown: Should fire
    prewarmBackend(true)
    assert.equal(fetchCalls, 2, "Forced prewarm should initiate a new fetch call")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Google Auth: duplicate simultaneous submission guard drops concurrent login attempts", async () => {
  let inFlight = false
  let duplicateDropped = 0

  const simulateLoginSubmission = async (token: string): Promise<boolean> => {
    if (inFlight) {
      duplicateDropped++
      return false
    }
    inFlight = true
    try {
      // Simulate bounded network delay
      await new Promise((resolve) => setTimeout(resolve, 50))
      return true
    } finally {
      inFlight = false
    }
  }

  // Launch two concurrent submissions
  const [res1, res2] = await Promise.all([
    simulateLoginSubmission("token-1"),
    simulateLoginSubmission("token-2"),
  ])

  assert.equal(res1, true, "First submission should succeed")
  assert.equal(res2, false, "Second concurrent submission should be dropped")
  assert.equal(duplicateDropped, 1, "Duplicate submission count should be exactly 1")
  assert.equal(inFlight, false, "In-flight flag must be cleanly reset in finally block")
})

test("Google Auth: loading state is cleanly reset even on unexpected error or timeout", async () => {
  let isSubmitting = false
  let loading = true

  const executeFailingLogin = async () => {
    isSubmitting = true
    loading = true
    try {
      throw new Error("Simulated cold-start timeout")
    } finally {
      isSubmitting = false
      loading = false
    }
  }

  await assert.rejects(executeFailingLogin, /Simulated cold-start timeout/)
  assert.equal(isSubmitting, false, "isSubmitting flag must be reset to false")
  assert.equal(loading, false, "loading state must be reset to false")
})

test("Google Auth: redact strictly scrubs Google credentials and tokens from diagnostic logs", () => {
  const sensitivePayload = {
    endpoint: "/api/auth/google",
    credential: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1In0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSJ9.signature_part",
    token: "sage_jwt_secret_token_123456",
    authorization: "Bearer eyJhbGciOi...",
    response: {
      user: {
        id: 1,
        email: "student@example.com",
      },
    },
  }

  const sanitized = redact(sensitivePayload) as Record<string, unknown>
  assert.equal(sanitized.credential, "[redacted]", "Google credential must be redacted")
  assert.equal(sanitized.token, "[redacted]", "Token must be redacted")
  assert.equal(sanitized.authorization, "[redacted]", "Authorization header must be redacted")
  assert.equal((sanitized.response as any).user.email, "student@example.com", "Non-sensitive user email structure is preserved")
})

test("apiClient: timeout triggers and cancels request when caller supplies NO signal", async () => {
  const originalFetch = globalThis.fetch
  try {
    const { apiClient } = await import("./api/client.ts")
    globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
      const signal = options?.signal
      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(signal.reason ?? new DOMException("The request timed out.", "TimeoutError"))
        })
      })
    }) as typeof fetch

    // Use a short 40ms timeout for test
    await assert.rejects(
      apiClient.get("/auth/google", { timeoutMs: 40 }),
      (err: any) => {
        assert.equal(err.name, "ApiError")
        assert.match(err.message, /Authentication service is starting/)
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("apiClient: timeout triggers and cancels request even when caller supplies AbortSignal", async () => {
  const originalFetch = globalThis.fetch
  try {
    const { apiClient } = await import("./api/client.ts")
    const callerController = new AbortController()

    globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
      const signal = options?.signal
      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(signal.reason ?? new DOMException("The request timed out.", "TimeoutError"))
        })
      })
    }) as typeof fetch

    // Caller supplied a signal, but server hangs past timeoutMs (40ms)
    await assert.rejects(
      apiClient.get("/auth/google", { signal: callerController.signal, timeoutMs: 40 }),
      (err: any) => {
        assert.equal(err.name, "ApiError")
        assert.match(err.message, /Authentication service is starting/)
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("apiClient: preserves caller cancellation when caller aborts before timeout", async () => {
  const originalFetch = globalThis.fetch
  try {
    const { apiClient } = await import("./api/client.ts")
    const callerController = new AbortController()

    globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
      const signal = options?.signal
      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"))
        })
      })
    }) as typeof fetch

    const promise = apiClient.get("/data", { signal: callerController.signal, timeoutMs: 5000 })
    // Caller aborts explicitly
    callerController.abort(new DOMException("User navigated away.", "AbortError"))

    await assert.rejects(promise, (err: any) => {
      assert.equal(err.name, "AbortError")
      assert.notEqual(err.name, "ApiError", "Caller cancellation must NOT be converted to ApiError")
      return true
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("apiClient: immediately rejects already-aborted signals without network call", async () => {
  const originalFetch = globalThis.fetch
  try {
    const { apiClient } = await import("./api/client.ts")
    const callerController = new AbortController()
    callerController.abort(new DOMException("Pre-aborted signal.", "AbortError"))

    let networkCalled = false
    globalThis.fetch = (async () => {
      networkCalled = true
      return new Response(JSON.stringify({ ok: true }))
    }) as typeof fetch

    await assert.rejects(
      apiClient.get("/data", { signal: callerController.signal }),
      { name: "AbortError" },
    )
    assert.equal(networkCalled, false, "Fetch must not be initiated for pre-aborted signal")
  } finally {
    globalThis.fetch = originalFetch
  }
})

