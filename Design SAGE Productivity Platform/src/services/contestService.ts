export type Contest = {
  id: string
  platform: string
  name: string
  startTime: string
  duration: number
  url: string
  status: "upcoming" | "ongoing" | "ended"
  lastUpdated: string
  reminder: string | null
}

export type RawProviderContest = {
  site?: string
  title?: string
  startTime?: number | string
  duration?: number | string
  url?: string
}

const UPSTREAM_CONTESTS_URL =
  "https://competeapi.vercel.app/contests/upcoming/"
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes

let memoryCache: { data: Contest[]; timestamp: number } | null = null
let inFlightRequest: Promise<Contest[]> | null = null

export function clearContestCacheForTesting(): void {
  memoryCache = null
  inFlightRequest = null
}

export function standardizePlatformName(site = ""): string {
  const key = site.toLowerCase().replace(/[\s_-]/g, "")
  if (key.includes("leetcode")) return "LeetCode"
  if (key.includes("codechef")) return "CodeChef"
  if (key.includes("codeforces")) return "Codeforces"
  if (key.includes("hackerrank")) return "HackerRank"
  if (key.includes("atcoder")) return "AtCoder"
  return site.trim() || "Other"
}

function hashIdentity(str: string): string {
  let h1 = 0xdeadbeef ^ 0
  let h2 = 0x41c6ce57 ^ 0
  for (let i = 0, ch: number; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0))
    .toString(16)
    .padStart(16, "0")
}

export function normalizeRawContest(
  raw: RawProviderContest,
  index: number,
  nowMs = Date.now(),
): Contest | null {
  if (!raw.title || !raw.url || raw.startTime === undefined) return null

  const startMs =
    typeof raw.startTime === "number"
      ? raw.startTime
      : Number(raw.startTime)

  if (Number.isNaN(startMs) || startMs <= 0) return null

  const start = new Date(startMs)
  if (Number.isNaN(start.getTime())) return null

  let durationMs = Number(raw.duration) || 0
  const platform = standardizePlatformName(raw.site)

  // LeetCode adapter minutes anomaly handling (if duration in ms exceeds 24h, it's minutes)
  if (platform === "LeetCode" && durationMs > 24 * 60 * 60 * 1000) {
    durationMs /= 60
  }

  const durationSec = Math.max(0, Math.round(durationMs / 1000))
  const endMs = startMs + durationSec * 1000

  const status: "upcoming" | "ongoing" | "ended" =
    startMs <= nowMs && endMs > nowMs
      ? "ongoing"
      : endMs <= nowMs
        ? "ended"
        : "upcoming"

  const identity = `${raw.site || "site"}-${raw.title}-${startMs}-${index}`
  const id = hashIdentity(identity)

  return {
    id,
    platform,
    name: raw.title.trim(),
    startTime: start.toISOString(),
    duration: durationSec,
    url: raw.url.trim(),
    status,
    lastUpdated: new Date(nowMs).toISOString(),
    reminder: null,
  }
}

async function executeContestFetch(
  signal?: AbortSignal,
): Promise<Contest[]> {
  const now = Date.now()

  // 1. Try backend endpoint /api/contests
  try {
    const res = await fetch("/api/contests", {
      headers: { Accept: "application/json" },
      signal,
    })
    if (res.ok) {
      const data = (await res.json()) as { contests?: Contest[] }
      if (Array.isArray(data?.contests) && data.contests.length > 0) {
        memoryCache = { data: data.contests, timestamp: now }
        return data.contests
      }
    }
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      throw err
    }
    // Backend unavailable or starting up -> fall through to live upstream
  }

  // 2. Direct live upstream fallback (competeapi.vercel.app)
  try {
    const upstreamRes = await fetch(UPSTREAM_CONTESTS_URL, {
      headers: { Accept: "application/json" },
      signal,
    })

    if (!upstreamRes.ok) {
      throw new Error(`Contest provider returned HTTP ${upstreamRes.status}`)
    }

    const rawList = (await upstreamRes.json()) as RawProviderContest[]
    if (!Array.isArray(rawList)) {
      throw new Error("Invalid response format from contest provider")
    }

    const normalized = rawList
      .map((item, idx) => normalizeRawContest(item, idx, now))
      .filter((item): item is Contest => item !== null)

    memoryCache = { data: normalized, timestamp: now }
    return normalized
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      throw err
    }
    // If upstream also failed, fall back to stale cache if available
    if (memoryCache && memoryCache.data.length > 0) {
      return memoryCache.data
    }
    throw err
  }
}

/**
 * Fetches live contest listings with end-to-end resilience:
 * 1. Queries backend endpoint /api/contests.
 * 2. If backend endpoint returns 500/502/503/404 or fails, gracefully falls back
 *    directly to live upstream provider (competeapi.vercel.app with CORS *).
 * 3. Deduplicates simultaneous in-flight requests to prevent duplicate network calls.
 * 4. Never returns fabricated / fake contests.
 */
export async function fetchUpcomingContests(
  signal?: AbortSignal,
  bypassCache = false,
): Promise<Contest[]> {
  const now = Date.now()

  if (!bypassCache && memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.data
  }

  if (inFlightRequest) {
    return inFlightRequest
  }

  inFlightRequest = executeContestFetch(signal).finally(() => {
    inFlightRequest = null
  })

  return inFlightRequest
}
