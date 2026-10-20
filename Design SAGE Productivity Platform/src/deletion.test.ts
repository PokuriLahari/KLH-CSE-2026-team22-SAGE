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
} as any)

globalThis.localStorage = globalThis.window.localStorage
globalThis.sessionStorage = globalThis.window.sessionStorage

import {
  clearUserStorage,
  getUserScopeKey,
  setUserItem,
  getUserItem,
} from "./userStorage.ts"

test("clearUserStorage: Purges target user data completely without affecting other users", () => {
  // Setup User A (target for deletion)
  const userA = { id: 101, email: "alice@example.com" }
  setUserItem("sage-tasks", [{ id: 1, title: "Alice Task" }], userA)
  setUserItem("sage-timetable", [{ courseCode: "CS101" }], userA)
  setUserItem("sage-goals", [{ title: "Alice Goal" }], userA)

  // Setup User B (another user on same device/browser)
  const userB = { id: 202, email: "bob@example.com" }
  setUserItem("sage-tasks", [{ id: 2, title: "Bob Task" }], userB)
  setUserItem("sage-timetable", [{ courseCode: "MATH201" }], userB)
  setUserItem("sage-goals", [{ title: "Bob Goal" }], userB)

  // Setup session keys
  localStore["sage_auth_user"] = JSON.stringify(userA)
  localStore["sage_auth_token"] = "jwt-alice-token"
  localStore["sage_onboarding_completed"] = "true"
  sessionStore["sage_chat_session"] = "session-alice"

  // Execute deletion of User A
  clearUserStorage(userA)

  // Verify User A data is purged
  assert.equal(
    getUserItem("sage-tasks", userA),
    null,
    "Alice's tasks must be deleted",
  )
  assert.equal(
    getUserItem("sage-timetable", userA),
    null,
    "Alice's timetable must be deleted",
  )
  assert.equal(
    getUserItem("sage-goals", userA),
    null,
    "Alice's goals must be deleted",
  )
  assert.equal(
    localStore["sage_auth_user"],
    undefined,
    "Active auth user must be cleared",
  )
  assert.equal(
    localStore["sage_auth_token"],
    undefined,
    "Auth token must be cleared",
  )
  assert.equal(
    sessionStore["sage_chat_session"],
    undefined,
    "Session chat must be cleared",
  )

  // CRITICAL VERIFICATION: Bob's data MUST remain completely intact
  const bobTasks = getUserItem<any[]>("sage-tasks", userB)
  assert.ok(bobTasks, "Bob's tasks must not be deleted")
  assert.equal(bobTasks?.length, 1)
  assert.equal(bobTasks?.[0].title, "Bob Task")

  const bobTimetable = getUserItem<any[]>("sage-timetable", userB)
  assert.ok(bobTimetable, "Bob's timetable must not be deleted")
  assert.equal(bobTimetable?.[0].courseCode, "MATH201")

  const bobGoals = getUserItem<any[]>("sage-goals", userB)
  assert.ok(bobGoals, "Bob's goals must not be deleted")
  assert.equal(bobGoals?.[0].title, "Bob Goal")
})

test("clearUserStorage: Handles deletion using email scope identifier", () => {
  const userByEmail = { email: "charlie@example.com" }
  setUserItem("sage-reminders", [{ text: "Charlie Reminder" }], userByEmail)
  assert.ok(getUserItem("sage-reminders", userByEmail))

  clearUserStorage(userByEmail)
  assert.equal(
    getUserItem("sage-reminders", userByEmail),
    null,
    "Scoped email data must be purged",
  )
})
