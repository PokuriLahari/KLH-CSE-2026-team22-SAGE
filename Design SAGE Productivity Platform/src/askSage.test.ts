import test from "node:test"
import assert from "node:assert/strict"
import { askSage, type SageRequest } from "./services/sageService.ts"

test("Ask SAGE: Rejects empty or whitespace-only messages", async () => {
  await assert.rejects(
    async () => {
      await askSage({ message: "   " })
    },
    {
      name: "Error",
      message: "Message cannot be empty.",
    },
  )
})

test("Ask SAGE: Formats request and parses reply property from backend", async () => {
  // Mock global fetch
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string)
      assert.equal(body.prompt, "How should I plan tonight?")
      assert.equal(body.context?.taskIds?.length, 2)

      return new Response(
        JSON.stringify({
          message: "Focus on Complete Compiler Lab 3 first.",
          reply: "Focus on Complete Compiler Lab 3 first.",
          responseId: "sage-resp-mock",
          conversationId: "conv-123",
          timestamp: "2026-10-18T19:00:00.000Z",
          pendingTasksCount: 2,
          totalMinutes: 120,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    const req: SageRequest = {
      message: "How should I plan tonight?",
      conversationId: "conv-123",
      context: {
        taskIds: ["1", "2"],
        includeTodaySchedule: true,
      },
    }

    const res = await askSage(req)
    assert.equal(res.message, "Focus on Complete Compiler Lab 3 first.")
    assert.equal(res.conversationId, "conv-123")
    assert.equal(res.responseId, "sage-resp-mock")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Ask SAGE: Honors unconfigured backend response without fabricating mock reply", async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          error:
            "SAGE AI assistant is unavailable: Backend GEMINI_API_KEY environment variable is not configured. Please set GEMINI_API_KEY in the backend environment to enable AI-powered assistance.",
          configured: false,
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    await assert.rejects(
      async () => {
        await askSage({ message: "What should I do now?" })
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("GEMINI_API_KEY") ||
            err.message.includes("unavailable"),
          "Must report honest error message about missing credentials",
        )
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Ask SAGE: Handles upstream rate limiting gracefully", async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          error:
            "SAGE AI assistant is currently experiencing high demand. Please retry in a few moments.",
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    await assert.rejects(
      async () => {
        await askSage({ message: "Plan my tasks" })
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("high demand") ||
            err.message.includes("try again"),
        )
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
