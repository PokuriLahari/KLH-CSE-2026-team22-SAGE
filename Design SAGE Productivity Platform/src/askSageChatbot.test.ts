import test from "node:test"
import assert from "node:assert/strict"
import {
  type ChatMessage,
  DEFAULT_SUGGESTIONS,
  parseBoldSegments,
  buildTaskContext,
  formatTime,
  validateAttachment,
  parseSageAction,
  detectTimetableConflicts,
  type TimetableCandidate,
} from "./components/chatbotTypes.ts"
import type { TimetableEntry } from "./timetable.ts"

test("AskSageChatbot: Default suggestion chips are provided", () => {
  assert.ok(Array.isArray(DEFAULT_SUGGESTIONS))
  assert.ok(DEFAULT_SUGGESTIONS.length >= 3)
  assert.ok(DEFAULT_SUGGESTIONS.includes("Help me prioritize today's tasks"))
})

test("AskSageChatbot: ChatMessage structure supports roles, error status, and attachments", () => {
  const userMsg: ChatMessage = {
    id: "user-1",
    role: "user",
    text: "Here is my syllabus",
    timestamp: "10:00 AM",
    status: "sent",
    attachment: {
      id: "att-1",
      name: "syllabus.png",
      type: "image/png",
      size: 1024,
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    },
  }

  const thinkingMsg: ChatMessage = {
    id: "sage-think",
    role: "assistant",
    status: "thinking",
  }

  const errorMsg: ChatMessage = {
    id: "err-1",
    role: "assistant",
    status: "error",
    errorMessage: "Rate limit exceeded. Please try again later.",
  }

  assert.equal(userMsg.role, "user")
  assert.equal(userMsg.text, "Here is my syllabus")
  assert.equal(userMsg.attachment?.name, "syllabus.png")
  assert.equal(thinkingMsg.status, "thinking")
  assert.equal(errorMsg.status, "error")
  assert.equal(errorMsg.errorMessage, "Rate limit exceeded. Please try again later.")
})

test("AskSageChatbot: parseBoldSegments splits bold text correctly", () => {
  const parsed = parseBoldSegments("Please focus on **Project SAGE** first.")
  assert.equal(parsed.length, 3)
  assert.equal(parsed[0].text, "Please focus on ")
  assert.equal(parsed[0].isBold, false)
  assert.equal(parsed[1].text, "Project SAGE")
  assert.equal(parsed[1].isBold, true)
  assert.equal(parsed[2].text, " first.")
  assert.equal(parsed[2].isBold, false)
})

test("AskSageChatbot: buildTaskContext filters out completed tasks and provides temporal anchors", () => {
  const tasks = [
    { id: "task-1", title: "Active task", completed: false },
    { id: "task-2", title: "Finished task", completed: true },
  ]
  const events = [{ id: "ev-1", title: "Team sync" }]

  const ctx = buildTaskContext(tasks, events)
  assert.deepEqual(ctx.taskIds, ["task-1"])
  assert.equal(ctx.includeTodaySchedule, true)
  assert.equal(typeof ctx.currentHour, "number")
  assert.ok(typeof ctx.userTimezone === "string" && ctx.userTimezone.length > 0)
  assert.ok(typeof ctx.currentDate === "string" && ctx.currentDate.match(/^\d{4}-\d{2}-\d{2}$/))
  assert.ok(typeof ctx.currentDayOfWeek === "string" && ctx.currentDayOfWeek.length > 0)
})

test("AskSageChatbot: formatTime returns a valid formatted string", () => {
  const formatted = formatTime(new Date("2026-10-20T10:30:00"))
  assert.ok(typeof formatted === "string" && formatted.length > 0)
})

test("AskSageChatbot: validateAttachment enforces supported formats and 5MB size limit", () => {
  // Valid PNG
  const validPng = new File(["dummy content"], "test.png", { type: "image/png" })
  const resPng = validateAttachment(validPng)
  assert.equal(resPng.valid, true)

  // Valid PDF
  const validPdf = new File(["dummy pdf content"], "timetable.pdf", { type: "application/pdf" })
  const resPdf = validateAttachment(validPdf)
  assert.equal(resPdf.valid, true)

  // Unsupported format (e.g. video/mp4)
  const invalidMp4 = new File(["dummy"], "video.mp4", { type: "video/mp4" })
  const resMp4 = validateAttachment(invalidMp4)
  assert.equal(resMp4.valid, false)
  assert.ok(resMp4.error?.includes("Unsupported format"))

  // Oversized file (> 5MB)
  const bigBuffer = new Uint8Array(6 * 1024 * 1024)
  const bigFile = new File([bigBuffer], "large.png", { type: "image/png" })
  const resBig = validateAttachment(bigFile)
  assert.equal(resBig.valid, false)
  assert.ok(resBig.error?.includes("too large"))
})

test("AskSageChatbot: parseSageAction extracts tasks JSON block and preserves conversational text", () => {
  const rawAiReply = `I extracted your assignment from the forwarded message.

\`\`\`sage-action
{
  "type": "tasks",
  "tasks": [
    {
      "title": "Complete Compiler Lab 3",
      "description": "Implement lexer in Flex",
      "dueDate": "2026-10-24",
      "dueTime": "23:59",
      "priority": "HIGH",
      "category": "Academic",
      "confidence": "high",
      "isAmbiguous": false,
      "sourceSnippet": "Lab 3 due Friday 23:59"
    }
  ],
  "clarificationNeeded": null
}
\`\`\`

Let me know if you want me to schedule study sessions for this!`

  const result = parseSageAction(rawAiReply)
  assert.equal(result.displayText.includes("```sage-action"), false)
  assert.ok(result.displayText.includes("I extracted your assignment"))
  assert.ok(result.displayText.includes("Let me know if you want me to schedule"))
  assert.equal(result.actionPayload?.type, "tasks")
  assert.equal(result.actionPayload?.tasks?.length, 1)
  assert.equal(result.actionPayload?.tasks?.[0].title, "Complete Compiler Lab 3")
  assert.equal(result.actionPayload?.tasks?.[0].priority, "HIGH")
})

test("AskSageChatbot: parseSageAction handles regular text responses without action blocks gracefully", () => {
  const plainText = "You have 3 tasks due tomorrow. I suggest starting with Database Normalization."
  const result = parseSageAction(plainText)
  assert.equal(result.displayText, plainText)
  assert.equal(result.actionPayload, undefined)
})

test("AskSageChatbot: detectTimetableConflicts accurately identifies duplicates and time collisions", () => {
  const existingTimetable: TimetableEntry[] = [
    {
      id: "tt-1",
      dayOfWeek: 1, // Monday
      dayName: "Monday",
      courseCode: "24CS3105",
      courseName: "Information Assurance",
      isKnownCourse: true,
      startTime: "08:10",
      endTime: "09:50",
      startPeriod: 1,
      endPeriod: 2,
      location: "Room K-206",
      recurring: true,
    },
  ]

  const candidates: TimetableCandidate[] = [
    // Duplicate: Monday, 08:10, 24CS3105
    {
      courseCode: "24CS3105",
      courseName: "Information Assurance",
      dayOfWeek: 1,
      dayName: "Monday",
      startTime: "08:10",
      endTime: "09:50",
      location: "Room K-206",
    },
    // Conflict: Monday, 09:00 - 10:40 (overlaps with 08:10 - 09:50)
    {
      courseCode: "24UC0008",
      courseName: "Indian Constitution",
      dayOfWeek: 1,
      dayName: "Monday",
      startTime: "09:00",
      endTime: "10:40",
      location: "Room K-301",
    },
    // Clean: Monday, 10:40 - 11:30 (no overlap)
    {
      courseCode: "24DEA3101",
      courseName: "Data Engineering",
      dayOfWeek: 1,
      dayName: "Monday",
      startTime: "10:40",
      endTime: "11:30",
      location: "Room K-102",
    },
  ]

  const analyzed = detectTimetableConflicts(candidates, existingTimetable)
  assert.equal(analyzed.length, 3)

  assert.equal(analyzed[0].isDuplicate, true)
  assert.equal(analyzed[0].isConflict, false)

  assert.equal(analyzed[1].isDuplicate, false)
  assert.equal(analyzed[1].isConflict, true)
  assert.ok(analyzed[1].conflictReason?.includes("Conflicts with existing class"))

  assert.equal(analyzed[2].isDuplicate, false)
  assert.equal(analyzed[2].isConflict, false)
})
