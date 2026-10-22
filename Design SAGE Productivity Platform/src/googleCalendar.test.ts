import test from "node:test"
import assert from "node:assert/strict"

// Mock localStorage for node test environment
const mockStore: Record<string, string> = {}
const mockLocalStorage = {
  getItem: (key: string) => mockStore[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStore[key] = String(value)
  },
  removeItem: (key: string) => {
    delete mockStore[key]
  },
  clear: () => {
    for (const k of Object.keys(mockStore)) delete mockStore[k]
  },
}

if (!globalThis.window) {
  globalThis.window = { localStorage: mockLocalStorage } as unknown as Window & typeof globalThis
} else {
  globalThis.window.localStorage = mockLocalStorage as unknown as Storage
}

import {
  DEFAULT_CLIENT_ID,
  sanitizeGoogleClientId,
  getGoogleClientId,
  setCustomGoogleClientId,
  getCustomGoogleClientId,
} from "./googleCalendar.ts"

test("Google Auth: DEFAULT_CLIENT_ID is a valid Google Client ID", () => {
  const result = sanitizeGoogleClientId(DEFAULT_CLIENT_ID)
  assert.equal(result, DEFAULT_CLIENT_ID)
  assert.equal(
    DEFAULT_CLIENT_ID,
    "832115590292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com",
  )
})

test("Google Auth: sanitizeGoogleClientId accepts valid standard client ID", () => {
  const validId =
    "832115590292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com"
  assert.equal(sanitizeGoogleClientId(validId), validId)
})

test("Google Auth: sanitizeGoogleClientId trims whitespace and surrounding quotes", () => {
  const validId =
    "832115590292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com"
  assert.equal(sanitizeGoogleClientId(`  ${validId}  \n`), validId)
  assert.equal(sanitizeGoogleClientId(`"${validId}"`), validId)
  assert.equal(sanitizeGoogleClientId(`'${validId}'`), validId)
})

test("Google Auth: sanitizeGoogleClientId rejects production corrupted string with newlines and duplicate fragments", () => {
  const corruptedVercelString =
    "\n83211559\n832115590292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com0292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com"
  assert.equal(sanitizeGoogleClientId(corruptedVercelString), null)
})

test("Google Auth: sanitizeGoogleClientId rejects invalid or empty strings", () => {
  assert.equal(sanitizeGoogleClientId(""), null)
  assert.equal(sanitizeGoogleClientId("   "), null)
  assert.equal(sanitizeGoogleClientId(null), null)
  assert.equal(sanitizeGoogleClientId(undefined), null)
  assert.equal(sanitizeGoogleClientId("some-random-string"), null)
  assert.equal(sanitizeGoogleClientId("invalid.apps.googleusercontent.com"), null)
  assert.equal(sanitizeGoogleClientId("832115590292"), null)
})

test("Google Auth: getGoogleClientId safely falls back to DEFAULT_CLIENT_ID when unconfigured or corrupted", () => {
  mockLocalStorage.clear()
  const clientId = getGoogleClientId()
  assert.equal(clientId, DEFAULT_CLIENT_ID)
})

test("Google Auth: localStorage custom client ID handles valid values", () => {
  mockLocalStorage.clear()
  const customId =
    "123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com"
  setCustomGoogleClientId(customId)

  assert.equal(getCustomGoogleClientId(), customId)
  assert.equal(getGoogleClientId(), customId)
})

test("Google Auth: localStorage custom client ID safely rejects malformed values", () => {
  mockLocalStorage.clear()
  // Attempt to set a malformed custom ID
  const malformedId = "malformed-client-id-without-google-domain"
  setCustomGoogleClientId(malformedId)

  // Should not save malformed ID
  assert.equal(getCustomGoogleClientId(), "")
  // getGoogleClientId should safely fall back to DEFAULT_CLIENT_ID
  assert.equal(getGoogleClientId(), DEFAULT_CLIENT_ID)

  // Direct injection into localStorage with corrupted production string
  const corrupted =
    "\n83211559\n832115590292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com0292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com"
  mockStore["sage_google_client_id"] = corrupted

  assert.equal(getCustomGoogleClientId(), "")
  assert.equal(getGoogleClientId(), DEFAULT_CLIENT_ID)

  mockLocalStorage.clear()
})

test("Google Auth: environment variable simulation with malformed and valid values", () => {
  mockLocalStorage.clear()

  // 1. Corrupted env value -> safely falls back to DEFAULT_CLIENT_ID
  const corruptedVercelEnv =
    "\n83211559\n832115590292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com0292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com"
  assert.equal(getGoogleClientId(corruptedVercelEnv), DEFAULT_CLIENT_ID)

  // 2. Valid clean env value -> successfully used
  const validCustomEnv =
    "999888777666-examplevalidclientid1234567890.apps.googleusercontent.com"
  assert.equal(getGoogleClientId(validCustomEnv), validCustomEnv)

  // 3. Unconfigured / undefined -> safely falls back to DEFAULT_CLIENT_ID
  assert.equal(getGoogleClientId(undefined), DEFAULT_CLIENT_ID)
})
