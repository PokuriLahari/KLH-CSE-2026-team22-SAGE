// ==================================================
// SAGE DECISION ENGINE — SCORING & REASONS
// ==================================================
// Principles:
// 1. Transparent, deterministic scoring model without ML/randomness.
// 2. Centralized weights — no magic numbers scattered across files.
// 3. Human-readable explainable reason generation.
// 4. Strict tie-breaking rules ensuring 100% reproducible results.
// ==================================================

import type {
  AvailableTimeWindow,
  DecisionFactors,
  EventItem,
  Goal,
  RecommendationType,
  Task,
  UserPreferences,
} from "./decisionTypes.ts"
import {
  findRelatedExam,
  findRelatedGoal,
  formatMinutes,
  getDaysDifference,
  parseTaskDuration,
} from "./decisionUtils.ts"

/**
 * Centralized decision weights for deterministic scoring.
 * (Phase 3 Requirement 6 & 7)
 */
export const DECISION_WEIGHTS = {
  urgency: {
    overdueBase: 150,
    overduePerDay: 15,
    overdueMaxExtra: 60,
    dueTodayWithin2Hours: 130,
    dueToday: 100,
    dueTomorrow: 60,
    dueInThreeDays: 35,
    dueThisWeek: 20,
    dueLater: 5,
    noDueDate: 0,
  },
  priority: {
    high: 80,
    medium: 40,
    low: 10,
    none: 0,
  },
  exam: {
    examTodayOrTomorrow: 75,
    examInThreeDays: 50,
    examInWeek: 35,
    examInTwoWeeks: 15,
  },
  goal: {
    activeGoalMatch: 45,
  },
  preference: {
    preferredTimePeriod: 25,
    preferredDurationMatch: 20,
  },
  fit: {
    fitsWellInWindow: 40,
    tightFitInWindow: 20,
    exceedsWindowDeprioritize: -50,
    unconstrainedWindow: 10,
  },
} as const

export type ScoredCandidate = {
  task: Task
  totalScore: number
  factors: DecisionFactors
  reason: string
  recommendationType: RecommendationType
  estimatedMinutes?: number
  hasDuration: boolean
  isOverdue: boolean
  isDueToday: boolean
  isDueTomorrow: boolean
  hasExamProximity: boolean
  hasGoalRelevance: boolean
  fitsAvailableWindow: boolean
  exceedsAvailableWindow: boolean
}

/**
 * Calculates urgency score based on due date and time.
 * Overdue tasks receive a strong urgency boost.
 */
export function calculateUrgencyScore(task: Task, now = new Date()): {
  score: number
  isOverdue: boolean
  isDueToday: boolean
  isDueTomorrow: boolean
} {
  if (!task.dueDate) {
    return {
      score: DECISION_WEIGHTS.urgency.noDueDate,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: false,
    }
  }

  const diffDays = getDaysDifference(task.dueDate, now)

  // 1. Overdue
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays)
    const extra = Math.min(
      DECISION_WEIGHTS.urgency.overdueMaxExtra,
      overdueDays * DECISION_WEIGHTS.urgency.overduePerDay,
    )
    return {
      score: DECISION_WEIGHTS.urgency.overdueBase + extra,
      isOverdue: true,
      isDueToday: false,
      isDueTomorrow: false,
    }
  }

  // 2. Due today
  if (diffDays === 0) {
    if (task.dueTime) {
      const [h, m] = task.dueTime.split(":").map(Number)
      const dueMinutes = (h || 0) * 60 + (m || 0)
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const remainingMinutes = dueMinutes - currentMinutes
      if (remainingMinutes <= 120) {
        return {
          score: DECISION_WEIGHTS.urgency.dueTodayWithin2Hours,
          isOverdue: remainingMinutes < 0,
          isDueToday: true,
          isDueTomorrow: false,
        }
      }
    }
    return {
      score: DECISION_WEIGHTS.urgency.dueToday,
      isOverdue: false,
      isDueToday: true,
      isDueTomorrow: false,
    }
  }

  // 3. Due tomorrow
  if (diffDays === 1) {
    return {
      score: DECISION_WEIGHTS.urgency.dueTomorrow,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: true,
    }
  }

  // 4. Due in 2-3 days
  if (diffDays <= 3) {
    return {
      score: DECISION_WEIGHTS.urgency.dueInThreeDays,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: false,
    }
  }

  // 5. Due this week (4-7 days)
  if (diffDays <= 7) {
    return {
      score: DECISION_WEIGHTS.urgency.dueThisWeek,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: false,
    }
  }

  // 6. Due later
  return {
    score: DECISION_WEIGHTS.urgency.dueLater,
    isOverdue: false,
    isDueToday: false,
    isDueTomorrow: false,
  }
}

/**
 * Calculates priority score from actual task priority.
 * Does not invent priority if absent.
 */
export function calculatePriorityScore(task: Task): number {
  if (task.priority === "High") {
    return DECISION_WEIGHTS.priority.high
  }
  if (task.priority === "Medium") {
    return DECISION_WEIGHTS.priority.medium
  }
  if (task.priority === "Low") {
    return DECISION_WEIGHTS.priority.low
  }
  return DECISION_WEIGHTS.priority.none
}

export type ExamScoreResult = {
  score: number
  relatedExam?: EventItem
  daysUntil?: number
}

/**
 * Calculates exam relevance score for explicitly linked course exam.
 * Does not guess or infer unassociated exams.
 */
export function calculateExamScore(
  task: Task,
  exams: EventItem[] = [],
  now = new Date(),
): ExamScoreResult {
  const match = findRelatedExam(task, exams, now)
  if (!match) {
    return { score: 0 }
  }

  const { exam, daysUntil } = match
  if (daysUntil <= 1) {
    return {
      score: DECISION_WEIGHTS.exam.examTodayOrTomorrow,
      relatedExam: exam,
      daysUntil,
    }
  }
  if (daysUntil <= 3) {
    return {
      score: DECISION_WEIGHTS.exam.examInThreeDays,
      relatedExam: exam,
      daysUntil,
    }
  }
  if (daysUntil <= 7) {
    return {
      score: DECISION_WEIGHTS.exam.examInWeek,
      relatedExam: exam,
      daysUntil,
    }
  }
  return {
    score: DECISION_WEIGHTS.exam.examInTwoWeeks,
    relatedExam: exam,
    daysUntil,
  }
}

export type GoalScoreResult = {
  score: number
  relatedGoal?: Goal
}

/**
 * Calculates goal relevance score for explicitly linked active goal.
 * Does not infer associations from text alone.
 */
export function calculateGoalScore(
  task: Task,
  goals: Goal[] = [],
): GoalScoreResult {
  const goal = findRelatedGoal(task, goals)
  if (!goal) {
    return { score: 0 }
  }
  return {
    score: DECISION_WEIGHTS.goal.activeGoalMatch,
    relatedGoal: goal,
  }
}

/**
 * Calculates preference match score.
 * If preferences are unavailable, skips the factor without inventing data.
 */
export function calculatePreferenceScore(
  task: Task,
  preferences?: UserPreferences,
  now = new Date(),
): number {
  if (!preferences) return 0

  let score = 0
  const hour = now.getHours()

  // 1. Time-of-day preference match
  if (preferences.period) {
    const period = preferences.period.toLowerCase()
    const isMorning = hour >= 5 && hour < 12
    const isAfternoon = hour >= 12 && hour < 17
    const isEvening = hour >= 17 && hour < 22
    const isNight = hour >= 22 || hour < 5

    if (
      (period === "morning" && isMorning) ||
      (period === "afternoon" && isAfternoon) ||
      (period === "evening" && isEvening) ||
      (period === "night" && isNight)
    ) {
      score += DECISION_WEIGHTS.preference.preferredTimePeriod
    }
  }

  // 2. Session duration match (only if task duration exists)
  const taskDuration = parseTaskDuration(task.duration)
  if (taskDuration !== undefined && preferences.duration) {
    const prefDuration = parseInt(preferences.duration, 10)
    if (!isNaN(prefDuration) && Math.abs(taskDuration - prefDuration) <= 15) {
      score += DECISION_WEIGHTS.preference.preferredDurationMatch
    }
  }

  return score
}

/**
 * Calculates fit score based on available time window.
 * Does NOT assume a duration if none exists.
 */
export function calculateFitScore(task: Task, window: AvailableTimeWindow): {
  score: number
  fitsWindow: boolean
  exceedsWindow: boolean
  hasDuration: boolean
} {
  const taskDuration = parseTaskDuration(task.duration)

  // If task duration is missing, do not invent one — neutral score
  if (taskDuration === undefined) {
    return {
      score: 0,
      fitsWindow: false,
      exceedsWindow: false,
      hasDuration: false,
    }
  }

  if (window.nextCommitment) {
    const avail = window.availableMinutes
    if (taskDuration <= avail) {
      const isTight = avail - taskDuration <= 10
      return {
        score: isTight
          ? DECISION_WEIGHTS.fit.tightFitInWindow
          : DECISION_WEIGHTS.fit.fitsWellInWindow,
        fitsWindow: true,
        exceedsWindow: false,
        hasDuration: true,
      }
    } else {
      // Exceeds available window before next class/event
      return {
        score: DECISION_WEIGHTS.fit.exceedsWindowDeprioritize,
        fitsWindow: false,
        exceedsWindow: true,
        hasDuration: true,
      }
    }
  }

  // Clear schedule for rest of day
  return {
    score: DECISION_WEIGHTS.fit.unconstrainedWindow,
    fitsWindow: true,
    exceedsWindow: false,
    hasDuration: true,
  }
}

/**
 * Generates a concise, explainable human-readable reason.
 * (Phase 3 Requirement 8)
 * NEVER exposes internal scores, weights, or algorithms.
 */
export function generateRecommendationReason(
  task: Task,
  options: {
    isOverdue: boolean
    isDueToday: boolean
    isDueTomorrow: boolean
    relatedExam?: EventItem
    examDays?: number
    relatedGoal?: Goal
    fitsWindow: boolean
    exceedsWindow: boolean
    availableWindow: AvailableTimeWindow
  },
): string {
  const {
    isOverdue,
    isDueToday,
    isDueTomorrow,
    relatedExam,
    examDays,
    relatedGoal,
    fitsWindow,
    availableWindow,
  } = options

  // Scenario 1: Overdue
  if (isOverdue) {
    if (relatedGoal) {
      return "Overdue and linked to an active goal."
    }
    if (fitsWindow) {
      return "Overdue and fits your available time."
    }
    return "Overdue and needs your attention."
  }

  // Scenario 2: Upcoming Exam related
  if (relatedExam && examDays !== undefined) {
    if (relatedGoal) {
      return "Your exam is approaching and this task supports that goal."
    }
    if (examDays <= 1) {
      return `Exam approaching soon (${relatedExam.title}).`
    }
    if (fitsWindow) {
      return `Supports upcoming exam in ${examDays} days and fits your schedule.`
    }
    return `Upcoming exam in ${examDays} days (${relatedExam.title}).`
  }

  // Scenario 3: Due Today
  if (isDueToday) {
    if (fitsWindow && availableWindow.nextCommitment) {
      return "Due today and fits before your next commitment."
    }
    if (fitsWindow) {
      return "Due today and fits your available time."
    }
    if (relatedGoal) {
      return "Due today and linked to an active goal."
    }
    return "Due today."
  }

  // Scenario 4: Due Tomorrow
  if (isDueTomorrow) {
    if (fitsWindow) {
      return "Due tomorrow and fits your available time."
    }
    if (task.priority === "High") {
      return "High priority and due tomorrow."
    }
    return "Due tomorrow."
  }

  // Scenario 5: High Priority
  if (task.priority === "High") {
    if (fitsWindow && availableWindow.nextCommitment) {
      return "High priority and short enough to finish before your next commitment."
    }
    if (fitsWindow) {
      return "High priority and fits your available time."
    }
    if (relatedGoal) {
      return `High priority and supports goal: ${relatedGoal.title}.`
    }
    return "High priority task in your queue."
  }

  // Scenario 6: Active Goal Linked
  if (relatedGoal) {
    if (fitsWindow) {
      return `Linked to active goal (${relatedGoal.title}) and fits your schedule.`
    }
    return `Directly progresses your active goal: ${relatedGoal.title}.`
  }

  // Scenario 7: Fits window before next commitment
  if (fitsWindow && availableWindow.nextCommitment) {
    return "Short enough to finish before your next commitment."
  }

  if (fitsWindow) {
    return "Fits your available work window."
  }

  return "Next actionable task in your queue."
}

/**
 * Determines recommendation category for structured metadata.
 */
export function determineRecommendationType(options: {
  isOverdue: boolean
  isDueToday: boolean
  hasExamProximity: boolean
  hasGoalRelevance: boolean
  isHighPriority: boolean
  fitsWindow: boolean
  duration?: number
}): RecommendationType {
  const {
    isOverdue,
    isDueToday,
    hasExamProximity,
    hasGoalRelevance,
    isHighPriority,
    fitsWindow,
    duration,
  } = options

  if (isOverdue || isDueToday) return "urgent_task"
  if (hasExamProximity) return "exam_prep"
  if (hasGoalRelevance) return "goal_task"
  if (fitsWindow && duration !== undefined && duration <= 30) return "quick_win"
  if (isHighPriority) return "focus_task"
  return "standard_task"
}

/**
 * Deterministic tie-breaker comparator.
 * (Phase 3 Requirement 17)
 * Order:
 * 1. Score descending
 * 2. Earlier deadline (dueDate + dueTime)
 * 3. Higher priority (High > Medium > Low)
 * 4. Shorter duration
 * 5. Earlier creation / lower ID
 * 6. Stable task ID
 */
export function compareScoredCandidates(
  a: ScoredCandidate,
  b: ScoredCandidate,
): number {
  // 1. Total score descending
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore
  }

  // 2. Earlier deadline
  const aDate = a.task.dueDate || "9999-99-99"
  const bDate = b.task.dueDate || "9999-99-99"
  if (aDate !== bDate) {
    return aDate.localeCompare(bDate)
  }

  const aTime = a.task.dueTime || "99:99"
  const bTime = b.task.dueTime || "99:99"
  if (aTime !== bTime) {
    return aTime.localeCompare(bTime)
  }

  // 3. Higher priority
  const priorityRank: Record<string, number> = {
    High: 3,
    Medium: 2,
    Low: 1,
  }
  const aPrio = priorityRank[a.task.priority || ""] || 0
  const bPrio = priorityRank[b.task.priority || ""] || 0
  if (bPrio !== aPrio) {
    return bPrio - aPrio
  }

  // 4. Shorter duration
  const aDur = parseTaskDuration(a.task.duration) ?? 99999
  const bDur = parseTaskDuration(b.task.duration) ?? 99999
  if (aDur !== bDur) {
    return aDur - bDur
  }

  // 5. Earlier creation time / lower ID
  if (
    a.task.createdAt &&
    b.task.createdAt &&
    a.task.createdAt !== b.task.createdAt
  ) {
    return a.task.createdAt.localeCompare(b.task.createdAt)
  }

  return a.task.id - b.task.id
}
