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
  loadSavedTimetable,
  saveTimetable,
  parseTimetableFromText,
  createManualTimetableEntry,
  getSampleTimetableTemplate,
} from "./timetable.ts"

test("Timetable: New user starts with empty timetable", () => {
  storage["sage-timetable"] = JSON.stringify([{ id: "legacy-entry" }])
  const newUser = { id: 999, email: "brandnew@example.com" }
  const result = loadSavedTimetable(newUser)
  assert.deepEqual(
    result,
    [],
    "New user must start with empty timetable, never shared data",
  )
})

test("Timetable: Multi-user isolation between User A and User B", () => {
  const userA = { id: 101, email: "alice@example.com" }
  const userB = { id: 102, email: "bob@example.com" }

  const classA = createManualTimetableEntry({
    dayOfWeek: 1,
    courseCode: "CS101",
    startPeriod: 1,
    endPeriod: 2,
    customCourseName: "Intro to CS",
  })
  assert.ok(classA)
  saveTimetable([classA], userA)

  const loadedA = loadSavedTimetable(userA)
  assert.equal(loadedA.length, 1)
  assert.equal(loadedA[0].courseCode, "CS101")

  const loadedB = loadSavedTimetable(userB)
  assert.deepEqual(loadedB, [], "User B must not see User A's timetable")
})

test("Timetable: Text parsing failure returns empty list, never fabricated fallback", () => {
  const result = parseTimetableFromText(
    "completely random unrecognized text without classes",
  )
  assert.deepEqual(
    result,
    [],
    "Unrecognized text should return [] and never hardcoded classes",
  )
})

test("Timetable: createManualTimetableEntry validates periods", () => {
  const invalid = createManualTimetableEntry({
    dayOfWeek: 1,
    courseCode: "CS101",
    startPeriod: 5,
    endPeriod: 3, // start > end
  })
  assert.equal(invalid, null, "Should reject startPeriod > endPeriod")

  const valid = createManualTimetableEntry({
    dayOfWeek: 2,
    courseCode: "MATH201",
    startPeriod: 3,
    endPeriod: 4,
    location: "LH-1",
  })
  assert.ok(valid)
  assert.equal(valid.courseCode, "MATH201")
  assert.equal(valid.dayOfWeek, 2)
  assert.equal(valid.location, "LH-1")
})

test("Timetable: getSampleTimetableTemplate returns non-empty curriculum only when explicitly called", () => {
  const template = getSampleTimetableTemplate()
  assert.ok(Array.isArray(template))
  assert.ok(template.length > 0)
  assert.ok(template[0].courseCode)
})
