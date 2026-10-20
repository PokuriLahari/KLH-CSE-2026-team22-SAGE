export type DiagnosticSeverity = "error" | "warning" | "info"
export type DiagnosticSource = "Frontend" | "Gateway" | "Auth Service" | "Gemini" | "OAuth" | "Network" | "Tasks" | "Calendar" | "Reminders" | "Profile"

export type DiagnosticEntry = {
  id: string
  timestamp: string
  severity: DiagnosticSeverity
  source: DiagnosticSource
  title: string
  message: string
  requestId?: string
  method?: string
  endpoint?: string
  status?: number
  durationMs?: number
  observed: boolean
  details?: Record<string, unknown>
}

const STORAGE_KEY = "sage-dev-diagnostics-v1"
const MAX_ENTRIES = 250
const sensitiveKey = /authorization|token|credential|password|secret|cookie|api[-_]?key/i

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]"
  if (typeof value === "string") return value.replace(/Bearer\s+[\w.-]+/gi, "Bearer [redacted]").slice(0, 2000)
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sensitiveKey.test(key) ? "[redacted]" : redact(item, depth + 1)]))
  }
  return value
}

function read(): DiagnosticEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as DiagnosticEntry[] } catch { return [] }
}

export function getDiagnostics(): DiagnosticEntry[] { return typeof window === "undefined" ? [] : read() }
export function clearDiagnostics(): void { try { localStorage.removeItem(STORAGE_KEY) } catch {} }

export function recordDiagnostic(entry: Omit<DiagnosticEntry, "id" | "timestamp">): DiagnosticEntry {
  const item: DiagnosticEntry = { ...entry, id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString(), message: String(redact(entry.message)) }
  if (typeof window !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...read()].slice(0, MAX_ENTRIES))) } catch {}
    window.dispatchEvent(new CustomEvent("sage:diagnostic", { detail: item }))
  }
  return item
}

export function installGlobalDiagnostics(): () => void {
  const onError = (event: ErrorEvent) => recordDiagnostic({ severity: "error", source: "Frontend", title: "JavaScript runtime error", message: event.message || "An unknown runtime error occurred.", observed: true, details: redact({ filename: event.filename, line: event.lineno, column: event.colno, stack: event.error instanceof Error ? event.error.stack : undefined }) as Record<string, unknown> })
  const onRejection = (event: PromiseRejectionEvent) => recordDiagnostic({ severity: "error", source: "Frontend", title: "Unhandled promise rejection", message: event.reason instanceof Error ? event.reason.message : "A promise was rejected without a handler.", observed: true, details: redact({ stack: event.reason instanceof Error ? event.reason.stack : event.reason }) as Record<string, unknown> })
  window.addEventListener("error", onError)
  window.addEventListener("unhandledrejection", onRejection)
  return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection) }
}

export function classifyEndpoint(endpoint: string): DiagnosticSource {
  if (endpoint.includes("/sage/")) return "Gemini"
  if (endpoint.includes("/auth/")) return "Auth Service"
  if (endpoint.includes("/tasks")) return "Tasks"
  if (endpoint.includes("/reminders")) return "Reminders"
  if (endpoint.includes("calendar")) return "Calendar"
  if (endpoint.includes("profile")) return "Profile"
  return "Gateway"
}
