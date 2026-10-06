// ==================================================
// SAGE DECISION ENGINE — CORE ORCHESTRATION
// ==================================================
// Principles:
// 1. "What should this student work on right now?"
// 2. Pure frontend, deterministic, explainable decision pipeline.
// 3. Transparent scoring without artificial intelligence / Grok.
// 4. Honest empty states — never invent tasks, deadlines, or scores.
// ==================================================

import type {
  DecisionContext,
  EventItem,
  FocusRecommendation,
  FocusSessionRecord,
  Task,
  TimetableEntry,
  UserPreferences,
} from "./decisionTypes.ts"
import {
  calculateExamScore,
  calculateFitScore,
  calculateGoalScore,
  calculatePreferenceScore,
  calculatePriorityScore,
  calculateUrgencyScore,
  compareScoredCandidates,
  determineRecommendationType,
  generateRecommendationReason,
  type ScoredCandidate,
} from "./decisionScoring.ts"
import {
  calculateAvailableTimeWindow,
  isActionableCandidate,
  parseContextDateTime,
  parseTaskDuration,
} from "./decisionUtils.ts"

/**
 * Evaluates the student's current situation and returns the single most useful
 * actionable task recommendation.
 * (Phase 3 Requirement 1, 2, 3)
 */
export function getFocusRecommendation(
  context: DecisionContext,
): FocusRecommendation {
  const now = parseContextDateTime(context)
  const timetable = context.timetable || []
  const calendarEvents = context.calendarEvents || []
  const tasks = context.tasks || []
  const goals = context.goals || []
  const preferences = context.userPreferences

  // 1. Calculate available-time window from timetable & calendar constraints
  const availableWindow = calculateAvailableTimeWindow(
    now,
    timetable,
    calendarEvents,
  )

  // 2. Extract active class in progress (if any) from timetable
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  const todayClasses = timetable.filter((c) => c.dayOfWeek === dayOfWeek)
  const curTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`
  const activeClass = todayClasses.find(
    (c) => c.startTime <= curTimeStr && curTimeStr < c.endTime,
  )
  const isClassInProgress = !!activeClass

  let freeMinutesBeforeNextClass: number | undefined
  if (
    !isClassInProgress &&
    availableWindow.nextCommitment?.type === "timetable_class"
  ) {
    freeMinutesBeforeNextClass = availableWindow.availableMinutes
  }

  // 3. Filter legitimate actionable candidates (Phase 3 Requirement 4)
  const candidateTasks = tasks.filter((t) => isActionableCandidate(t, now))

  // 4. Honest empty states (Phase 3 Requirement 11 & 24)
  if (candidateTasks.length === 0) {
    const hasAnyTasks = tasks.length > 0
    const emptyReason = hasAnyTasks
      ? "You're clear for now. No tasks need your attention right now."
      : "Your task queue is clear right now. No pending tasks."

    return {
      taskId: null,
      title: hasAnyTasks ? "You're clear for now" : "Your queue is clear",
      reason: emptyReason,
      score: 0,
      recommendationType: "no_task",
      factors: {
        urgency: 0,
        priority: 0,
        goal: 0,
        exam: 0,
        preference: 0,
        fit: 0,
      },
      candidateTask: null,
      availableWindow,
      isClassInProgress,
      activeClass,
      freeMinutesBeforeNextClass,
    }
  }

  // Derive exams from explicit exams prop or calendar events
  const exams: EventItem[] =
    context.exams && context.exams.length > 0
      ? context.exams
      : calendarEvents.filter(
          (e) =>
            e.type === "Exam" ||
            e.title.toLowerCase().includes("exam") ||
            e.title.toLowerCase().includes("quiz") ||
            e.title.toLowerCase().includes("midterm"),
        )

  // 5. Score every candidate task across all decision factors
  const scoredCandidates: ScoredCandidate[] = candidateTasks.map((task) => {
    // A & G. Urgency & Overdue
    const urgency = calculateUrgencyScore(task, now)

    // B. Priority
    const priorityScore = calculatePriorityScore(task)

    // C. Exam proximity (explicit only)
    const exam = calculateExamScore(task, exams, now)

    // D. Goal relevance (explicit only)
    const goal = calculateGoalScore(task, goals)

    // E. User preferences (if available)
    const preferenceScore = calculatePreferenceScore(task, preferences, now)

    // F. Fit into available work window
    const fit = calculateFitScore(task, availableWindow)

    // Total deterministic score
    const totalScore =
      urgency.score +
      priorityScore +
      exam.score +
      goal.score +
      preferenceScore +
      fit.score

    const taskDuration = parseTaskDuration(task.duration)

    const reason = generateRecommendationReason(task, {
      isOverdue: urgency.isOverdue,
      isDueToday: urgency.isDueToday,
      isDueTomorrow: urgency.isDueTomorrow,
      relatedExam: exam.relatedExam,
      examDays: exam.daysUntil,
      relatedGoal: goal.relatedGoal,
      fitsWindow: fit.fitsWindow,
      exceedsWindow: fit.exceedsWindow,
      availableWindow,
    })

    const recommendationType = determineRecommendationType({
      isOverdue: urgency.isOverdue,
      isDueToday: urgency.isDueToday,
      hasExamProximity: exam.score > 0,
      hasGoalRelevance: goal.score > 0,
      isHighPriority: task.priority === "High",
      fitsWindow: fit.fitsWindow,
      duration: taskDuration,
    })

    return {
      task,
      totalScore,
      factors: {
        urgency: urgency.score,
        priority: priorityScore,
        goal: goal.score,
        exam: exam.score,
        preference: preferenceScore,
        fit: fit.score,
      },
      reason,
      recommendationType,
      estimatedMinutes: taskDuration,
      hasDuration: fit.hasDuration,
      isOverdue: urgency.isOverdue,
      isDueToday: urgency.isDueToday,
      isDueTomorrow: urgency.isDueTomorrow,
      hasExamProximity: exam.score > 0,
      hasGoalRelevance: goal.score > 0,
      fitsAvailableWindow: fit.fitsWindow,
      exceedsAvailableWindow: fit.exceedsWindow,
    }
  })

  // 6. Deterministic tie-breaking sort (Phase 3 Requirement 17)
  scoredCandidates.sort(compareScoredCandidates)

  const best = scoredCandidates[0]

  return {
    taskId: best.task.id,
    title: best.task.title,
    reason: best.reason,
    score: best.totalScore,
    estimatedMinutes: best.estimatedMinutes,
    dueAt: best.task.dueDate
      ? `${best.task.dueDate}${
          best.task.dueTime ? `T${best.task.dueTime}:00` : ""
        }`
      : undefined,
    priority: best.task.priority,
    course: best.task.course,
    recommendationType: best.recommendationType,
    factors: best.factors,
    candidateTask: best.task,
    availableWindow,
    isClassInProgress,
    activeClass,
    freeMinutesBeforeNextClass,
  }
}

/**
 * Backward-compatible signature helper for existing callers in the codebase.
 */
export function getFocusNowRecommendation(
  tasks: Task[],
  timetable: TimetableEntry[] = [],
  events: EventItem[] = [],
  preferences?: UserPreferences,
  focusSessions: FocusSessionRecord[] = [],
  refDate = new Date(),
  goals: import("./decisionTypes").Goal[] = [],
): {
  task: Task | null
  score: number
  reason: string
  isClassInProgress: boolean
  activeClass?: TimetableEntry
  freeMinutesBeforeNextClass?: number
  factors: string[]
  recommendation: FocusRecommendation
} {
  const context: DecisionContext = {
    currentDateTime: refDate,
    tasks,
    timetable,
    calendarEvents: events,
    userPreferences: preferences,
    focusSessions,
    goals,
  }

  const rec = getFocusRecommendation(context)

  // Format factors into descriptive strings for debug/inspector
  const factorStrings: string[] = []
  if (rec.factors.urgency > 0)
    factorStrings.push(`Urgency: +${rec.factors.urgency}`)
  if (rec.factors.priority > 0)
    factorStrings.push(`Priority: +${rec.factors.priority}`)
  if (rec.factors.exam > 0)
    factorStrings.push(`Exam relevance: +${rec.factors.exam}`)
  if (rec.factors.goal > 0)
    factorStrings.push(`Goal relevance: +${rec.factors.goal}`)
  if (rec.factors.preference > 0)
    factorStrings.push(`Preference match: +${rec.factors.preference}`)
  if (rec.factors.fit > 0) factorStrings.push(`Window fit: +${rec.factors.fit}`)
  else if (rec.factors.fit < 0)
    factorStrings.push(`Window fit: ${rec.factors.fit}`)

  return {
    task: rec.candidateTask,
    score: rec.score,
    reason: rec.reason,
    isClassInProgress: !!rec.isClassInProgress,
    activeClass: rec.activeClass,
    freeMinutesBeforeNextClass: rec.freeMinutesBeforeNextClass,
    factors: factorStrings,
    recommendation: rec,
  }
}
