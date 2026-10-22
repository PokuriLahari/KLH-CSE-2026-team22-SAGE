// ==================================================
// SAGE TIMETABLE & ACADEMIC SCHEDULE ENGINE
// ==================================================
// Principles:
// 1. Calendar = Information
// 2. Reminders = Actionable things
// 3. Timetable classes = Recurring academic information, NOT reminders!
// 4. Consecutive periods of the same course are merged into one block.
// 5. Course codes resolve strictly via COURSE_CATALOG without guessing.
// 6. Faculty name is NEVER used as course name.
// 7. No Default Pre-population: Brand-new users start with an empty schedule.
// 8. User Data Isolation: Timetable storage is scoped strictly by SAGE user ID.
// ==================================================

import { getUserItem, setUserItem, type UserIdentifier } from "./userStorage.ts"
import { askSage } from "./services/sageService.ts"

export interface PeriodTime {
  period: number
  start: string // 24-hr format "08:10"
  end: string // 24-hr format "09:00"
}

export type PeriodSlot = {
  start: string
  end: string
}

// College starts at 8:10 AM with 50-minute periods
export const PERIOD_SCHEDULE: Record<number, PeriodSlot> = {
  1: { start: "08:10", end: "09:00" },
  2: { start: "09:00", end: "09:50" },
  3: { start: "09:50", end: "10:40" },
  4: { start: "10:40", end: "11:30" },
  5: { start: "11:30", end: "12:20" },
  6: { start: "12:20", end: "13:10" },
  7: { start: "13:10", end: "14:00" },
  8: { start: "14:00", end: "14:50" },
  9: { start: "14:50", end: "15:40" },
  10: { start: "15:40", end: "16:30" },
  11: { start: "16:30", end: "17:20" },
}

// Course catalog supplied by institution. Never guess unlisted courses.
export const COURSE_CATALOG: Record<string, string> = {
  "23UC0008": "Indian Constitution",
  "24UC0008": "Indian Constitution",
  "24CS3105": "Information Assurance and Security",
  "24DEA3101": "Fundamentals of Data Engineering",
  "24CI3201": "Adaptive Software Engineering",
  "24CC3014": "AWS Certified Solutions Architect - Associate (SAA-C03)",
}

export type TimetableEntry = {
  id: string
  dayOfWeek: number // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
  dayName: string // "Monday", "Tuesday", etc.
  courseCode: string
  courseName: string
  isKnownCourse: boolean
  startTime: string // "08:10"
  endTime: string // "09:50"
  startPeriod: number
  endPeriod: number
  location?: string
  faculty?: string
  recurring: true
}

export type RawTimetableSlot = {
  dayOfWeek: number // 1 = Monday .. 5 = Friday
  period: number // 1 .. 11
  courseCode: string
  location?: string
  faculty?: string
}

export const TIMETABLE_STORAGE_KEY = "sage-timetable"

export type CourseResolveResult = {
  name: string
  isKnown: boolean
}

// Resolve course codes strictly. If not in catalog, display code itself without hallucination.
export function resolveCourseName(code: string): CourseResolveResult {
  const cleanCode = code.trim().toUpperCase()
  if (COURSE_CATALOG[cleanCode]) {
    return { name: COURSE_CATALOG[cleanCode], isKnown: true }
  }
  return { name: cleanCode, isKnown: false }
}

// Clean and normalize location (e.g. "RoomNo-K-206" -> "Room K-206")
export function normalizeLocation(rawLoc?: string): string {
  if (!rawLoc) return ""
  let loc = rawLoc.trim()
  loc = loc.replace(/^RoomNo[-_\s]*/i, "Room ")
  loc = loc.replace(/^Room[-_\s]*/i, "Room ")
  if (/^[A-Za-z]-\d+/i.test(loc)) {
    loc = `Room ${loc}`
  }
  return loc.replace(/\s+/g, " ").trim()
}

// Format 24-hr time to 12-hr with AM/PM (e.g. "08:10" -> "8:10 AM", "13:10" -> "1:10 PM")
export function formatTime12(time24: string): string {
  if (!time24) return ""
  const parts = time24.split(":").map(Number)
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return time24
  const hours = parts[0]
  const minutes = String(parts[1]).padStart(2, "0")
  const period = hours >= 12 ? "PM" : "AM"
  const displayHours = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHours}:${minutes} ${period}`
}

// Format time range nicely (e.g. "8:10 – 9:50 AM" or "1:10 – 2:50 PM")
export function formatTimeRange(start24: string, end24: string): string {
  const startStr = formatTime12(start24)
  const endStr = formatTime12(end24)
  if (!startStr || !endStr) return `${start24} – ${end24}`
  const startParts = startStr.split(" ")
  const endParts = endStr.split(" ")
  // If same AM/PM, combine: "8:10 – 9:50 AM"
  if (startParts[1] === endParts[1]) {
    return `${startParts[0]} – ${endParts[0]} ${endParts[1]}`
  }
  return `${startStr} – ${endStr}`
}

// Merge consecutive periods belonging to the same course
export function mergeConsecutivePeriods(
  slots: RawTimetableSlot[],
): TimetableEntry[] {
  const sorted = [...slots].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.period - b.period
  })

  const dayNames = [
    "",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]
  const merged: TimetableEntry[] = []

  for (const slot of sorted) {
    const periodInfo = PERIOD_SCHEDULE[slot.period]
    if (!periodInfo) continue

    const code = slot.courseCode.trim().toUpperCase()
    const { name, isKnown } = resolveCourseName(code)
    const loc = normalizeLocation(slot.location)

    const prev = merged[merged.length - 1]
    // Check if consecutive period of the identical course code
    if (
      prev &&
      prev.dayOfWeek === slot.dayOfWeek &&
      prev.courseCode === code &&
      prev.endPeriod + 1 === slot.period
    ) {
      prev.endPeriod = slot.period
      prev.endTime = periodInfo.end
      if (!prev.location && loc) prev.location = loc
    } else {
      merged.push({
        id: `tt-${slot.dayOfWeek}-${slot.period}-${code}`,
        dayOfWeek: slot.dayOfWeek,
        dayName: dayNames[slot.dayOfWeek] || `Day ${slot.dayOfWeek}`,
        courseCode: code,
        courseName: name,
        isKnownCourse: isKnown,
        startTime: periodInfo.start,
        endTime: periodInfo.end,
        startPeriod: slot.period,
        endPeriod: slot.period,
        location: loc || undefined,
        faculty: slot.faculty || undefined,
        recurring: true,
      })
    }
  }

  return merged
}

// Optional canonical institutional timetable template for explicit preview/demonstration
// NEVER loaded as a default for new users.
export const OFFICIAL_TIMETABLE_SLOTS: RawTimetableSlot[] = [
  // MONDAY:
  { dayOfWeek: 1, period: 1, courseCode: "24UC0008", location: "RoomNo-K-206" },
  { dayOfWeek: 1, period: 2, courseCode: "24UC0008", location: "RoomNo-K-206" },
  { dayOfWeek: 1, period: 3, courseCode: "24CS3105", location: "RoomNo-K-407" },
  { dayOfWeek: 1, period: 4, courseCode: "24CS3105", location: "RoomNo-K-407" },
  {
    dayOfWeek: 1,
    period: 5,
    courseCode: "24DEA3101",
    location: "RoomNo-K-313",
  },

  // TUESDAY:
  {
    dayOfWeek: 2,
    period: 3,
    courseCode: "24DEA3101",
    location: "RoomNo-K-313",
  },
  {
    dayOfWeek: 2,
    period: 4,
    courseCode: "24DEA3101",
    location: "RoomNo-K-313",
  },
  { dayOfWeek: 2, period: 7, courseCode: "24CI3201", location: "RoomNo-K-009" },
  { dayOfWeek: 2, period: 8, courseCode: "24CI3201", location: "RoomNo-K-009" },
  { dayOfWeek: 2, period: 9, courseCode: "24CI3201", location: "RoomNo-K-009" },

  // WEDNESDAY:
  { dayOfWeek: 3, period: 1, courseCode: "24CS3105", location: "RoomNo-K-407" },
  { dayOfWeek: 3, period: 2, courseCode: "24CS3105", location: "RoomNo-K-407" },
  {
    dayOfWeek: 3,
    period: 7,
    courseCode: "24CC3014",
    location: "Computer Centre",
  },
  {
    dayOfWeek: 3,
    period: 8,
    courseCode: "24CC3014",
    location: "Computer Centre",
  },

  // THURSDAY:
  { dayOfWeek: 4, period: 2, courseCode: "24CI3201", location: "RoomNo-K-009" },
  { dayOfWeek: 4, period: 3, courseCode: "24CI3201", location: "RoomNo-K-009" },
  { dayOfWeek: 4, period: 5, courseCode: "24SDCS03", location: "RoomNo-K-210" },
  { dayOfWeek: 4, period: 6, courseCode: "24SDCS03", location: "RoomNo-K-210" },

  // FRIDAY:
  {
    dayOfWeek: 5,
    period: 1,
    courseCode: "24DEA3101",
    location: "RoomNo-K-313",
  },
  {
    dayOfWeek: 5,
    period: 2,
    courseCode: "24DEA3101",
    location: "RoomNo-K-313",
  },
  {
    dayOfWeek: 5,
    period: 7,
    courseCode: "24CC3014",
    location: "Computer Centre",
  },
  {
    dayOfWeek: 5,
    period: 8,
    courseCode: "24CC3014",
    location: "Computer Centre",
  },
  {
    dayOfWeek: 5,
    period: 9,
    courseCode: "24CC3014",
    location: "Computer Centre",
  },
]

/**
 * Returns a copy of the canonical sample template ONLY when explicitly requested by user.
 */
export function getSampleTimetableTemplate(): TimetableEntry[] {
  return mergeConsecutivePeriods(OFFICIAL_TIMETABLE_SLOTS)
}

// Parse raw timetable text. If no valid course codes found, returns empty array.
export function parseTimetableFromText(text: string): TimetableEntry[] {
  const slots: RawTimetableSlot[] = []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const dayRegex =
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  let currentDay = 1

  for (const line of lines) {
    const dayMatch = line.match(dayRegex)
    if (dayMatch) {
      const d = dayMatch[1].toLowerCase()
      if (d === "monday") currentDay = 1
      else if (d === "tuesday") currentDay = 2
      else if (d === "wednesday") currentDay = 3
      else if (d === "thursday") currentDay = 4
      else if (d === "friday") currentDay = 5
      else if (d === "saturday") currentDay = 6
      else if (d === "sunday") currentDay = 7
      continue
    }

    // Match period or course code: e.g. "Period 1: 24UC0008 RoomNo-K-206"
    const periodMatch = line.match(/period\s*(\d+)/i)
    const codeMatch = line.match(/\b(2[34][A-Z0-9]{5,8})\b/i)
    const roomMatch = line.match(
      /\b(RoomNo-[A-Z0-9-]+|Room\s+[A-Z0-9-]+|Computer Centre)\b/i,
    )

    if (codeMatch) {
      const period = periodMatch ? parseInt(periodMatch[1], 10) : 1
      slots.push({
        dayOfWeek: currentDay,
        period,
        courseCode: codeMatch[1],
        location: roomMatch ? roomMatch[1] : undefined,
      })
    }
  }

  if (slots.length > 0) {
    return mergeConsecutivePeriods(slots)
  }

  // Never fall back to fabricated timetable data!
  return []
}

// Convert file to base64 data URL safely in browser and node environments
export async function fileToDataUrl(file: File): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  return `data:${file.type || "application/octet-stream"};base64,${base64}`
}

function normalize24Hour(raw: string): string {
  if (!raw) return ""
  const clean = raw.trim()
  // Check if 12-hr with AM/PM e.g. "8:10 AM" or "1:10 PM"
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10)
    const m = ampmMatch[2]
    const meridiem = (ampmMatch[3] || "").toLowerCase()
    if (meridiem === "pm" && h < 12) h += 12
    if (meridiem === "am" && h === 12) h = 0
    return `${String(h).padStart(2, "0")}:${m}`
  }
  return clean
}

export function parseAiTimetableBlock(rawText: string): any[] {
  if (!rawText) return []

  const findArray = (obj: any): any[] | null => {
    if (Array.isArray(obj)) return obj
    if (obj && typeof obj === "object") {
      if (Array.isArray(obj.timetable)) return obj.timetable
      if (Array.isArray(obj.classes)) return obj.classes
      if (Array.isArray(obj.schedule)) return obj.schedule
      if (Array.isArray(obj.courses)) return obj.courses
      if (Array.isArray(obj.items)) return obj.items
    }
    return null
  }

  // 1. Look for ```sage-action ... ``` block
  const actionMatch = rawText.match(/```sage-action\s*([\s\S]*?)\s*```/i)
  if (actionMatch) {
    try {
      const parsed = JSON.parse(actionMatch[1])
      const arr = findArray(parsed)
      if (arr && arr.length > 0) return arr
    } catch {}
  }

  // 2. Look for ```json ... ``` block
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      const arr = findArray(parsed)
      if (arr && arr.length > 0) return arr
    } catch {}
  }

  // 3. Look for direct JSON array
  const arrayMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {}
  }

  // 4. Look for direct JSON object in rawText
  const directMatch = rawText.match(/\{[\s\S]*"(?:timetable|classes|schedule|courses)"\s*:\s*\[[\s\S]*?\][\s\S]*\}/)
  if (directMatch) {
    try {
      const parsed = JSON.parse(directMatch[0])
      const arr = findArray(parsed)
      if (arr && arr.length > 0) return arr
    } catch {}
  }

  return []
}

export function candidatesToTimetableEntries(candidates: any[]): TimetableEntry[] {
  const dayNameMap: Record<string, number> = {
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
    sunday: 7, sun: 7,
  }
  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  const rawEntries: TimetableEntry[] = []

  for (let idx = 0; idx < candidates.length; idx++) {
    const c = candidates[idx]
    if (!c || typeof c !== "object") continue

    const rawCode = String(c.courseCode || c.code || c.subject || c.course || "").trim()
    if (!rawCode) continue

    const cleanCode = rawCode.toUpperCase()
    const resolved = resolveCourseName(cleanCode)

    let dayOfWeek = Number(c.dayOfWeek)
    if (!dayOfWeek || isNaN(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      const rawDay = String(c.dayName || c.day || "").trim().toLowerCase()
      dayOfWeek = dayNameMap[rawDay] || 1
    }

    const dayName = c.dayName || dayNames[dayOfWeek] || "Monday"

    let rawStart = String(c.startTime || c.start || "").trim()
    let rawEnd = String(c.endTime || c.end || "").trim()

    if (!rawStart && c.time) {
      const parts = String(c.time).split(/[-–—to]/i).map((s) => s.trim())
      if (parts[0]) rawStart = parts[0]
      if (parts[1]) rawEnd = parts[1]
    }

    let startTime = normalize24Hour(rawStart)
    let endTime = normalize24Hour(rawEnd)

    let startPeriod = Number(c.startPeriod || c.period || c.fromPeriod || 0)
    let endPeriod = Number(c.endPeriod || c.toPeriod || startPeriod || 0)

    if (startPeriod >= 1 && startPeriod <= 11 && !startTime && PERIOD_SCHEDULE[startPeriod]) {
      startTime = PERIOD_SCHEDULE[startPeriod].start
    }
    if (endPeriod >= 1 && endPeriod <= 11 && !endTime && PERIOD_SCHEDULE[endPeriod]) {
      endTime = PERIOD_SCHEDULE[endPeriod].end
    }

    if (!startTime) startTime = "08:10"
    if (!endTime) endTime = "09:50"

    if (!startPeriod || startPeriod < 1) {
      for (const [pStr, slot] of Object.entries(PERIOD_SCHEDULE)) {
        if (slot.start === startTime || slot.start.replace(/^0/, "") === startTime.replace(/^0/, "")) {
          startPeriod = Number(pStr)
          break
        }
      }
    }
    if (!endPeriod || endPeriod < 1) {
      for (const [pStr, slot] of Object.entries(PERIOD_SCHEDULE)) {
        if (slot.end === endTime || slot.end.replace(/^0/, "") === endTime.replace(/^0/, "")) {
          endPeriod = Number(pStr)
          break
        }
      }
    }

    if (!startPeriod) startPeriod = 1
    if (!endPeriod) endPeriod = startPeriod
    if (endPeriod < startPeriod) endPeriod = startPeriod

    rawEntries.push({
      id: `tt-ai-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      dayOfWeek,
      dayName,
      courseCode: cleanCode,
      courseName: c.courseName || resolved.name,
      isKnownCourse: resolved.isKnown || Boolean(c.courseName),
      startTime,
      endTime,
      startPeriod,
      endPeriod,
      location: c.location ? normalizeLocation(String(c.location)) : undefined,
      faculty: c.faculty ? String(c.faculty).trim() : undefined,
      recurring: true,
    })
  }

  // Sort and merge consecutive periods belonging to the same course
  rawEntries.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.startPeriod - b.startPeriod
  })

  const mergedEntries: TimetableEntry[] = []
  for (const item of rawEntries) {
    const prev = mergedEntries[mergedEntries.length - 1]
    if (
      prev &&
      prev.dayOfWeek === item.dayOfWeek &&
      prev.courseCode === item.courseCode &&
      prev.endPeriod + 1 === item.startPeriod
    ) {
      prev.endPeriod = item.endPeriod
      prev.endTime = item.endTime
      if (!prev.location && item.location) prev.location = item.location
      if (!prev.faculty && item.faculty) prev.faculty = item.faculty
    } else {
      mergedEntries.push({ ...item })
    }
  }

  return mergedEntries
}

// Parse uploaded file (Image/PDF/Text) using multimodal AI when binary
export async function parseUploadedTimetableFile(
  file: File,
): Promise<TimetableEntry[]> {
  if (!file) return []

  // 1. Text files (.txt, .csv, text/plain)
  if (
    file.type === "text/plain" ||
    file.type === "text/csv" ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".csv")
  ) {
    try {
      const text = await file.text()
      if (text && text.length > 10) {
        const parsed = parseTimetableFromText(text)
        if (parsed.length > 0) return parsed
      }
    } catch {}
  }

  // 2. Images (PNG, JPG, JPEG, WEBP, GIF) and PDF documents
  const isImageOrPdf =
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    /\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name)

  if (isImageOrPdf) {
    try {
      const dataUrl = await fileToDataUrl(file)
      const prompt =
        "Please analyze this timetable / class schedule and extract all recurring weekly class sessions. For each class, identify: courseCode (e.g. CS101, 24CS3105), courseName (full title if visible), dayOfWeek (1 for Monday through 7 for Sunday), dayName, startTime (HH:mm format like 08:10 or 09:00), endTime (HH:mm format like 09:50 or 10:40), location (room or lab), and faculty name if visible."

      const response = await askSage({
        message: prompt,
        attachment: {
          mimeType:
            file.type ||
            (file.name.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : "image/png"),
          data: dataUrl,
          name: file.name,
        },
      })

      const rawReply = response.message || ""
      const candidates = parseAiTimetableBlock(rawReply)
      if (candidates.length > 0) {
        const mapped = candidatesToTimetableEntries(candidates)
        if (mapped.length > 0) return mapped
      }

      // Secondary fallback: parse conversational text if Gemini listed the classes
      const textParsed = parseTimetableFromText(rawReply)
      if (textParsed.length > 0) return textParsed
    } catch (err) {
      console.warn("AI timetable image parsing failed:", err)
    }
  }

  // 3. Fallback: try raw text parsing if readable
  try {
    const text = await file.text()
    if (text && text.length > 10) {
      const parsed = parseTimetableFromText(text)
      if (parsed.length > 0) return parsed
    }
  } catch {}

  // Never default to fabricated timetable; return empty array so UI can display proper error/manual state
  return []
}

/**
 * Creates a valid TimetableEntry manually from user form input.
 */
export function createManualTimetableEntry(params: {
  dayOfWeek: number
  courseCode: string
  startPeriod: number
  endPeriod: number
  location?: string
  customCourseName?: string
}): TimetableEntry | null {
  const {
    dayOfWeek,
    courseCode,
    startPeriod,
    endPeriod,
    location,
    customCourseName,
  } = params
  if (!courseCode || !courseCode.trim()) return null
  if (dayOfWeek < 1 || dayOfWeek > 7) return null
  if (
    startPeriod < 1 ||
    startPeriod > 11 ||
    endPeriod < startPeriod ||
    endPeriod > 11
  )
    return null

  const cleanCode = courseCode.trim().toUpperCase()
  const resolved = resolveCourseName(cleanCode)
  const courseName = customCourseName?.trim() || resolved.name
  const isKnown = resolved.isKnown || Boolean(customCourseName?.trim())

  const periodStart = PERIOD_SCHEDULE[startPeriod]
  const periodEnd = PERIOD_SCHEDULE[endPeriod]
  if (!periodStart || !periodEnd) return null

  const dayNames = [
    "",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]

  return {
    id: `tt-man-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dayOfWeek,
    dayName: dayNames[dayOfWeek] || `Day ${dayOfWeek}`,
    courseCode: cleanCode,
    courseName,
    isKnownCourse: isKnown,
    startTime: periodStart.start,
    endTime: periodEnd.end,
    startPeriod,
    endPeriod,
    location: location ? normalizeLocation(location) : undefined,
    recurring: true,
  }
}

// User-scoped storage helpers: each account has its own independent timetable data.
export function loadSavedTimetable(
  userOrId?: UserIdentifier,
): TimetableEntry[] {
  const entries = getUserItem<TimetableEntry[]>(TIMETABLE_STORAGE_KEY, userOrId)
  return Array.isArray(entries) ? entries : []
}

export function saveTimetable(
  entries: TimetableEntry[],
  userOrId?: UserIdentifier,
): void {
  setUserItem(TIMETABLE_STORAGE_KEY, entries, userOrId)
}

// Query classes for a specific day of the week (1 = Monday ... 7 = Sunday)
export function getClassesForDay(
  entries: TimetableEntry[],
  dayOfWeek: number,
): TimetableEntry[] {
  return entries
    .filter((e) => e.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

// Returns the single next/current class for Home Dashboard
// Home rule: "Home should show only relevant current information... Do not show every class of the day on Home."
export function getHomeClassStatus(
  entries: TimetableEntry[],
  refDate = new Date(),
): {
  type: "in-progress" | "next" | "tomorrow" | "none"
  entry?: TimetableEntry
  label: string
} {
  if (!entries.length) {
    return { type: "none", label: "No timetable loaded" }
  }

  const dayOfWeek = refDate.getDay() === 0 ? 7 : refDate.getDay()
  const todayClasses = getClassesForDay(entries, dayOfWeek)

  const curHour = refDate.getHours()
  const curMin = refDate.getMinutes()
  const nowTime = `${String(curHour).padStart(2, "0")}:${String(curMin).padStart(2, "0")}`

  // 1. Is any class in progress right now?
  const inProgress = todayClasses.find(
    (c) => c.startTime <= nowTime && nowTime < c.endTime,
  )
  if (inProgress) {
    return {
      type: "in-progress",
      entry: inProgress,
      label: `Class in progress · until ${formatTime12(inProgress.endTime)}`,
    }
  }

  // 2. What is the next class today?
  const nextToday = todayClasses.find((c) => c.startTime > nowTime)
  if (nextToday) {
    return {
      type: "next",
      entry: nextToday,
      label: `Next class at ${formatTime12(nextToday.startTime)}`,
    }
  }

  // 3. If today's classes are over or today is weekend, find the next class tomorrow / next academic day
  const nextDays = [1, 2, 3, 4, 5, 6, 7]
  for (let offset = 1; offset <= 7; offset++) {
    const targetDay = ((dayOfWeek - 1 + offset) % 7) + 1
    const upcoming = getClassesForDay(entries, targetDay)
    if (upcoming.length > 0) {
      const firstClass = upcoming[0]
      const whenStr = offset === 1 ? "Tomorrow" : firstClass.dayName
      return {
        type: offset === 1 ? "tomorrow" : "next",
        entry: firstClass,
        label: `${whenStr} at ${formatTime12(firstClass.startTime)}`,
      }
    }
  }

  return { type: "none", label: "No upcoming classes" }
}
