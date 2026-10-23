import test from "node:test"
import assert from "node:assert/strict"
import {
  standardizePlatformName,
  normalizeRawContest,
  fetchUpcomingContests,
  clearContestCacheForTesting,
  type RawProviderContest,
} from "./services/contestService.ts"

test("standardizePlatformName: maps provider platform names to standard display names", () => {
  assert.equal(standardizePlatformName("leetcode"), "LeetCode")
  assert.equal(standardizePlatformName("LeetCode Contests"), "LeetCode")
  assert.equal(standardizePlatformName("codechef"), "CodeChef")
  assert.equal(standardizePlatformName("code_chef"), "CodeChef")
  assert.equal(standardizePlatformName("codeforces"), "Codeforces")
  assert.equal(standardizePlatformName("hackerrank"), "HackerRank")
  assert.equal(standardizePlatformName("atcoder"), "AtCoder")
  assert.equal(standardizePlatformName("TopCoder"), "TopCoder")
  assert.equal(standardizePlatformName(""), "Other")
  assert.equal(standardizePlatformName(undefined), "Other")
})

test("normalizeRawContest: parses timestamps, corrects LeetCode duration anomaly, and sets status", () => {
  const baseTime = Date.parse("2026-10-23T12:00:00Z")

  // 1. LeetCode contest starting in 1 hour with inflated duration (>24h in ms)
  const rawLeet: RawProviderContest = {
    site: "LeetCode",
    title: "Weekly Contest 450",
    url: "https://leetcode.com/contest/weekly-contest-450",
    startTime: baseTime + 3600 * 1000,
    duration: 324000000, // 90 min * 60 * 1000 * 60 = provider minutes anomaly
  }

  const normLeet = normalizeRawContest(rawLeet, 0, baseTime)
  assert.ok(normLeet)
  assert.equal(normLeet.platform, "LeetCode")
  assert.equal(normLeet.name, "Weekly Contest 450")
  assert.equal(normLeet.duration, 5400) // 90 min in seconds
  assert.equal(normLeet.status, "upcoming")
  assert.equal(typeof normLeet.id, "string")
  assert.equal(normLeet.id.length, 16)

  // 2. Ongoing contest
  const rawOngoing: RawProviderContest = {
    site: "Codeforces",
    title: "Round 999",
    url: "https://codeforces.com/contest/999",
    startTime: baseTime - 1800 * 1000, // started 30 min ago
    duration: 7200 * 1000, // 2 hr duration
  }
  const normOngoing = normalizeRawContest(rawOngoing, 1, baseTime)
  assert.ok(normOngoing)
  assert.equal(normOngoing.status, "ongoing")

  // 3. Ended contest
  const rawEnded: RawProviderContest = {
    site: "CodeChef",
    title: "Starters 150",
    url: "https://codechef.com/START150",
    startTime: baseTime - 10000 * 1000,
    duration: 7200 * 1000,
  }
  const normEnded = normalizeRawContest(rawEnded, 2, baseTime)
  assert.ok(normEnded)
  assert.equal(normEnded.status, "ended")
})

test("normalizeRawContest: rejects malformed or incomplete entries", () => {
  assert.equal(normalizeRawContest({ url: "https://a.com", startTime: 1000 }, 0), null)
  assert.equal(normalizeRawContest({ title: "Contest", startTime: 1000 }, 0), null)
  assert.equal(normalizeRawContest({ title: "Contest", url: "https://a.com", startTime: -1 }, 0), null)
  assert.equal(normalizeRawContest({ title: "Contest", url: "https://a.com", startTime: "invalid" }, 0), null)
})

test("fetchUpcomingContests: prefers backend /api/contests when available", async () => {
  clearContestCacheForTesting()
  const originalFetch = globalThis.fetch

  try {
    let calledUrl = ""
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calledUrl = String(input)
      if (calledUrl === "/api/contests") {
        return new Response(
          JSON.stringify({
            contests: [
              {
                id: "backend-12345678",
                platform: "Codeforces",
                name: "Round 1000",
                startTime: new Date().toISOString(),
                duration: 7200,
                url: "https://codeforces.com/contest/1000",
                status: "upcoming",
                lastUpdated: new Date().toISOString(),
                reminder: null,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      throw new Error(`Unexpected fetch to ${calledUrl}`)
    }) as typeof fetch

    const result = await fetchUpcomingContests()
    assert.equal(calledUrl, "/api/contests")
    assert.equal(result.length, 1)
    assert.equal(result[0].name, "Round 1000")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("fetchUpcomingContests: falls back to live competeapi when /api/contests returns 500", async () => {
  clearContestCacheForTesting()
  const originalFetch = globalThis.fetch

  try {
    const urlsCalled: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      urlsCalled.push(url)

      if (url === "/api/contests") {
        // Simulating the exact production 500 failure
        return new Response(
          JSON.stringify({
            status: 500,
            error: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong while processing your request.",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        )
      }

      if (url === "https://competeapi.vercel.app/contests/upcoming/") {
        return new Response(
          JSON.stringify([
            {
              site: "CodeChef",
              title: "Starters 170",
              url: "https://codechef.com/START170",
              startTime: Date.now() + 86400000,
              duration: 7200000,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      throw new Error(`Unexpected fetch call to ${url}`)
    }) as typeof fetch

    const result = await fetchUpcomingContests()
    assert.deepEqual(urlsCalled, [
      "/api/contests",
      "https://competeapi.vercel.app/contests/upcoming/",
    ])
    assert.equal(result.length, 1)
    assert.equal(result[0].platform, "CodeChef")
    assert.equal(result[0].name, "Starters 170")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("fetchUpcomingContests: uses cache on consecutive calls unless bypassCache is requested", async () => {
  clearContestCacheForTesting()
  const originalFetch = globalThis.fetch

  try {
    let fetchCount = 0
    globalThis.fetch = (async () => {
      fetchCount++
      return new Response(
        JSON.stringify({
          contests: [
            {
              id: "cached-1",
              platform: "LeetCode",
              name: "Biweekly 150",
              startTime: new Date().toISOString(),
              duration: 5400,
              url: "https://leetcode.com",
              status: "upcoming",
              lastUpdated: new Date().toISOString(),
              reminder: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }) as typeof fetch

    await fetchUpcomingContests()
    assert.equal(fetchCount, 1)

    // Second call without bypassCache
    await fetchUpcomingContests()
    assert.equal(fetchCount, 1)

    // Third call with bypassCache = true
    await fetchUpcomingContests(undefined, true)
    assert.equal(fetchCount, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("fetchUpcomingContests: deduplicates concurrent in-flight requests to avoid duplicate network calls", async () => {
  clearContestCacheForTesting()
  const originalFetch = globalThis.fetch

  try {
    let networkFetches = 0
    globalThis.fetch = (async () => {
      networkFetches++
      await new Promise((resolve) => setTimeout(resolve, 50))
      return new Response(
        JSON.stringify({
          contests: [
            {
              id: "concurrent-test",
              platform: "LeetCode",
              name: "Weekly Contest 451",
              startTime: new Date().toISOString(),
              duration: 5400,
              url: "https://leetcode.com",
              status: "upcoming",
              lastUpdated: new Date().toISOString(),
              reminder: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }) as typeof fetch

    // Trigger two requests concurrently (e.g. double click or simultaneous component mount)
    const [res1, res2] = await Promise.all([
      fetchUpcomingContests(),
      fetchUpcomingContests(),
    ])

    assert.equal(networkFetches, 1, "Only one network request should be dispatched for concurrent callers")
    assert.equal(res1.length, 1)
    assert.equal(res2.length, 1)
    assert.equal(res1[0].id, res2[0].id)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("fetchUpcomingContests: returns stale cache if both backend and upstream fail", async () => {
  clearContestCacheForTesting()
  const originalFetch = globalThis.fetch

  try {
    // 1. Initial successful fetch
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          contests: [
            {
              id: "stale-fallback-id",
              platform: "Codeforces",
              name: "Round 1001",
              startTime: new Date().toISOString(),
              duration: 7200,
              url: "https://codeforces.com/contest/1001",
              status: "upcoming",
              lastUpdated: new Date().toISOString(),
              reminder: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }) as typeof fetch

    const initial = await fetchUpcomingContests()
    assert.equal(initial.length, 1)

    // 2. Both backend and upstream fail on next forced refresh
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch")
    }) as typeof fetch

    const cachedFallback = await fetchUpcomingContests(undefined, true)
    assert.equal(cachedFallback.length, 1, "Should gracefully serve stale cached data when network fails")
    assert.equal(cachedFallback[0].id, "stale-fallback-id")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("fetchUpcomingContests: preserves caller AbortSignal", async () => {
  clearContestCacheForTesting()
  const originalFetch = globalThis.fetch

  try {
    const controller = new AbortController()
    globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
      const signal = options?.signal
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError")
      }
      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"))
        })
      })
    }) as typeof fetch

    const promise = fetchUpcomingContests(controller.signal)
    controller.abort()

    await assert.rejects(promise, { name: "AbortError" })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("contest fields parity: verified all fields consumed by filters, cards, and reminders", () => {
  const contest = normalizeRawContest(
    {
      site: "LeetCode",
      title: "Weekly Contest 452",
      url: "https://leetcode.com/contest/weekly-contest-452",
      startTime: Date.now() + 3600000,
      duration: 5400000,
    },
    0,
  )

  assert.ok(contest)
  // Verify every field required by ContestsScreen:
  assert.equal(typeof contest.id, "string") // Used for react key and reminder lookup
  assert.equal(typeof contest.platform, "string") // Used for platform filter & icon
  assert.equal(typeof contest.name, "string") // Used for search & card heading
  assert.equal(typeof contest.startTime, "string") // Used for date filter & countdown
  assert.equal(typeof contest.duration, "number") // Used for durationLabel
  assert.equal(typeof contest.url, "string") // Used for external link button
  assert.ok(["upcoming", "ongoing", "ended"].includes(contest.status)) // Used for status filter & grouping
  assert.equal(typeof contest.lastUpdated, "string")
  assert.equal(contest.reminder, null) // Default null until student sets reminder
})

