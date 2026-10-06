// ==================================================
// SAGE DECISION ENGINE — TYPES
// ==================================================
// Principles:
// 1. Deterministic & explainable decision contracts.
// 2. Strict typing for all decision inputs and outputs.
// 3. No fake data or AI dependencies.
// 4. Lightweight event logging for future adaptive learning.
// ==================================================

export type ItemStatus = "open" | "completed" | "snoozed"

export type Task = {
  id: number
  title: string
  description?: string
  course?: string
  dueDate?: string // YYYY-MM-DD
  dueTime?: string // HH:mm
  duration?: string // Estimated minutes as string (e.g. "30", "45")
  priority?: string // "High" | "Medium" | "Low"
  goal?: string
  notes?: string
  status: ItemStatus
  snoozedUntil?: string // ISO timestamp until which task is snoozed
  createdAt?: string
}

export type Goal = {
  id: number
  title: string
  description?: string
  category: string
  targetDate: string
  milestones: string[]
  completed: number // Percentage 0 - 100
}

export type EventItem = {
  id: number
  title: string
  type: string // "Class" | "Exam" | "Study" | "Personal" | string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  endTime: string // HH:mm
  source?: "sage" | "google"
  externalId?: string
  dayOfWeek?: number
  isRecurring?: boolean
  originalFileName?: string
}

export type UserPreferences = {
  period: string // "Morning" | "Afternoon" | "Evening" | "Night"
  duration: string // "25" | "30" | "45" | "60" | etc.
  target: string // Daily target hours
  includeBreaks?: boolean
  avoidPersonalCommitments?: boolean
}

export type FocusSessionRecord = {
  id: string
  taskId?: number
  taskTitle?: string
  startedAt: string
  completedAt: string
  plannedDuration: number
  actualDuration: number
  status: "completed" | "cancelled"
}

export type TimetableEntry = {
  id: string
  dayOfWeek: number // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
  dayName: string
  courseCode: string
  courseName: string
  isKnownCourse: boolean
  startTime: string // "08:10"
  endTime: string // "09:50"
  startPeriod: number
  endPeriod: number
  location?: string
}

export type RecommendationType = "urgent_task" | "exam_prep" | "goal_task" | "focus_task" | "quick_win" | "standard_task" | "no_task"

export type DecisionFactors = {
  urgency: number
  priority: number
  goal: number
  exam: number
  preference: number
  fit: number
}

export type TimeCommitment = {
  title: string
  startTime: string // "08:10"
  endTime: string // "09:50"
  type: "timetable_class" | "calendar_event" | "exam"
  isOngoing: boolean
  minutesUntilStart: number
  minutesUntilEnd: number
  location?: string
}

export type AvailableTimeWindow = {
  hasCommitmentInProgress: boolean
  inProgressCommitment?: TimeCommitment
  nextCommitment?: TimeCommitment
  availableMinutes: number
  windowDescription: string
}

export type DecisionContext = {
  currentDateTime?: Date | string
  tasks: Task[]
  goals?: Goal[]
  milestones?: string[]
  timetable?: TimetableEntry[]
  exams?: EventItem[]
  calendarEvents?: EventItem[]
  userPreferences?: UserPreferences
  focusSessions?: FocusSessionRecord[]
}

export type FocusRecommendation = {
  taskId: number | null
  title: string
  reason: string
  score: number
  estimatedMinutes?: number
  dueAt?: string
  priority?: string
  course?: string
  recommendationType: RecommendationType
  factors: DecisionFactors
  candidateTask: Task | null
  availableWindow: AvailableTimeWindow
  isClassInProgress?: boolean
  activeClass?: TimetableEntry
  freeMinutesBeforeNextClass?: number
}

// Lightweight event model for future learning foundation (Phase 3 Requirement 20)
export type RecommendationEvent = {
  id: string
  recommendationId: string
  taskId: number
  action: "shown" | "started" | "completed" | "snoozed" | "dismissed"
  timestamp: string
}

export type FocusSessionEvent = {
  taskId?: number
  startedAt: string
  endedAt: string
  durationMinutes: number
  completed: boolean
}

export const RECOMMENDATION_EVENTS_STORAGE_KEY = "sage-recommendation-events"
export const FOCUS_SESSION_EVENTS_STORAGE_KEY = "sage-focus-session-events"
