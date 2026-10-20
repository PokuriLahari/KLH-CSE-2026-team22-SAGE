import test from "node:test"
import assert from "node:assert/strict"

// Mock localStorage for node environment
const storage: Record<string, string> = {}
globalThis.window = ({
  localStorage: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = String(value)
    },
    removeItem: (key: string) => {
      delete storage[key]
    },
    clear: () => {
      for (const k of Object.keys(storage)) delete storage[k]
    },
  },
} as any)
globalThis.localStorage = globalThis.window.localStorage

import {
  upsertContestReminder,
  removeContestReminder,
  findContestReminder,
  isReminderDue,
  getReminderTriggerTime,
  loadSavedReminders,
  saveReminders,
  type Reminder,
  type ContestReminderInput,
} from "./notifications.ts"

test("Contest Reminders: Creating reminder calculates trigger time from lead time", () => {
  const contest: ContestReminderInput = {
    id: "cf-1234",
    name: "Codeforces Round 999",
    platform: "Codeforces",
    startTime: "2026-10-25T15:00:00.000Z",
    url: "https://codeforces.com/contest/999",
  }

  const initialList: Reminder[] = []
  // User selects "1 hour before"
  const updated = upsertContestReminder(initialList, contest, "1h")

  assert.equal(updated.length, 1)
  const reminder = updated[0]
  assert.equal(reminder.targetType, "contest")
  assert.equal(reminder.contestId, "cf-1234")
  assert.equal(reminder.platform, "Codeforces")
  assert.equal(reminder.contestUrl, "https://codeforces.com/contest/999")
  assert.equal(reminder.eventStartTime, "2026-10-25T15:00:00.000Z")
  assert.equal(reminder.notificationTiming, "1h")

  // Trigger time should be 1 hour before 15:00 UTC = 14:00 UTC
  const expectedTriggerMs = new Date("2026-10-25T14:00:00.000Z").getTime()
  const actualTriggerMs = getReminderTriggerTime(reminder)
  assert.equal(
    actualTriggerMs,
    expectedTriggerMs,
    "Trigger time must be contestStart - 1h",
  )
})

test("Contest Reminders: Repeated clicks update existing reminder without duplicating", () => {
  const contest: ContestReminderInput = {
    id: "lc-weekly-400",
    name: "Weekly Contest 400",
    platform: "LeetCode",
    startTime: "2026-10-26T02:30:00.000Z",
  }

  let list: Reminder[] = []
  // Click 1: 30 minutes before
  list = upsertContestReminder(list, contest, "30m")
  assert.equal(list.length, 1)
  const originalId = list[0].id
  assert.equal(list[0].notificationTiming, "30m")

  // Click 2: change to 10 minutes before
  list = upsertContestReminder(list, contest, "10m")
  assert.equal(list.length, 1, "Must not duplicate reminder on repeat clicks")
  assert.equal(list[0].id, originalId, "Must preserve reminder ID")
  assert.equal(list[0].notificationTiming, "10m", "Must update lead time")

  // Click 3: change to 2 hours before
  list = upsertContestReminder(list, contest, "2h")
  assert.equal(list.length, 1)
  assert.equal(list[0].notificationTiming, "2h")
})

test("Contest Reminders: Removing contest reminder removes it from central list", () => {
  const contest: ContestReminderInput = {
    id: "cc-starters-150",
    name: "Starters 150",
    platform: "CodeChef",
    startTime: "2026-10-28T14:30:00.000Z",
  }

  let list = upsertContestReminder([], contest, "1h")
  assert.equal(list.length, 1)
  assert.ok(findContestReminder(list, "cc-starters-150"))

  list = removeContestReminder(list, "cc-starters-150")
  assert.equal(list.length, 0)
  assert.equal(findContestReminder(list, "cc-starters-150"), undefined)
})

test("Contest Reminders: findContestReminder ignores dismissed or completed reminders", () => {
  const contest: ContestReminderInput = {
    id: "atc-abc-350",
    name: "AtCoder Beginner 350",
    platform: "AtCoder",
    startTime: "2026-10-29T12:00:00.000Z",
  }

  let list = upsertContestReminder([], contest, "10m")
  assert.ok(findContestReminder(list, "atc-abc-350"))

  // Mark as completed
  list = list.map((r) =>
    r.contestId === "atc-abc-350" ? { ...r, status: "completed" as const } : r,
  )
  assert.equal(
    findContestReminder(list, "atc-abc-350"),
    undefined,
    "Completed reminder should not show as active in Contests",
  )

  // Mark as dismissed
  list = list.map((r) =>
    r.contestId === "atc-abc-350"
      ? { ...r, status: "open" as const, dismissed: true }
      : r,
  )
  assert.equal(
    findContestReminder(list, "atc-abc-350"),
    undefined,
    "Dismissed reminder should not show as active in Contests",
  )
})

test("Contest Reminders: Expired or invalid contests do not trigger notifications", () => {
  // Contest in the past (expired)
  const pastContestReminder: Reminder = {
    id: 1,
    title: "Past Contest",
    date: "2026-10-01",
    time: "10:00",
    dueAt: "2026-10-01T10:00:00.000Z",
    createdAt: "2026-10-01T08:00:00.000Z",
    status: "open",
    method: "In-app",
    read: false,
    dismissed: false,
    notificationTiming: "1h",
    targetType: "contest",
    contestId: "past-1",
    eventStartTime: "2026-10-01T11:00:00.000Z", // Past!
  }

  const now = new Date("2026-10-18T12:00:00.000Z")
  assert.equal(
    isReminderDue(pastContestReminder, now),
    false,
    "Expired contest must never trigger notification",
  )

  // Invalid start time
  const invalidContestReminder: Reminder = {
    ...pastContestReminder,
    eventStartTime: "invalid-date-string",
  }
  assert.equal(
    isReminderDue(invalidContestReminder, now),
    false,
    "Invalid contest date must never trigger notification",
  )

  // Missing start time
  const missingContestReminder: Reminder = {
    ...pastContestReminder,
    eventStartTime: undefined,
  }
  assert.equal(
    isReminderDue(missingContestReminder, now),
    false,
    "Missing contest date must never trigger notification",
  )
})

test("Contest Reminders: Future contest triggers notification only when due time arrives", () => {
  // Contest at 16:00, reminder 1h before -> due at 15:00
  const contestReminder: Reminder = {
    id: 2,
    title: "Upcoming Contest",
    date: "2026-10-25",
    time: "15:00",
    dueAt: "2026-10-25T15:00:00.000Z",
    createdAt: "2026-10-25T12:00:00.000Z",
    status: "open",
    method: "In-app",
    read: false,
    dismissed: false,
    notificationTiming: "1h",
    targetType: "contest",
    contestId: "future-1",
    eventStartTime: "2026-10-25T16:00:00.000Z",
  }

  // Before trigger time: 14:30
  const beforeTime = new Date("2026-10-25T14:30:00.000Z")
  assert.equal(
    isReminderDue(contestReminder, beforeTime),
    false,
    "Should not be due before trigger time",
  )

  // At trigger time: 15:00
  const atTime = new Date("2026-10-25T15:00:00.000Z")
  assert.equal(
    isReminderDue(contestReminder, atTime),
    true,
    "Should be due at trigger time",
  )

  // After trigger time but before contest starts: 15:30
  const duringLeadTime = new Date("2026-10-25T15:30:00.000Z")
  assert.equal(
    isReminderDue(contestReminder, duringLeadTime),
    true,
    "Should be due during lead time before contest starts",
  )

  // After contest starts: 16:05
  const afterContestStarts = new Date("2026-10-25T16:05:00.000Z")
  assert.equal(
    isReminderDue(contestReminder, afterContestStarts),
    false,
    "Should not trigger after contest has already started",
  )
})

test("Contest Reminders: Multi-user isolation between User A and User B", () => {
  const userA = { id: 201, email: "coderA@example.com" }
  const userB = { id: 202, email: "coderB@example.com" }

  const contest: ContestReminderInput = {
    id: "cf-abc",
    name: "User A Contest",
    platform: "Codeforces",
    startTime: "2026-10-30T14:00:00.000Z",
  }

  const userAReminders = upsertContestReminder([], contest, "1h")
  saveReminders(userAReminders, userA)

  const loadedA = loadSavedReminders(userA)
  assert.equal(loadedA.length, 1)
  assert.equal(loadedA[0].contestId, "cf-abc")

  const loadedB = loadSavedReminders(userB)
  assert.deepEqual(
    loadedB,
    [],
    "User B must not see User A's contest reminders",
  )
})
