// ==================================================
// SAGE DECISION ENGINE — DETERMINISTIC TESTS
// ==================================================
// Covers all 15 scenarios specified in Phase 3 Section 28
// ==================================================

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getFocusRecommendation } from "./decisionEngine.ts"
import type {
  DecisionContext,
  EventItem,
  Goal,
  Task,
  TimetableEntry,
} from "./decisionTypes.ts"

describe("SAGE Decision Engine (Phase 3)", () => {
  const baseDate = new Date("2026-10-06T10:00:00.000Z")

  // TEST 1: Overdue task wins over low-priority future task
  it("TEST 1: Overdue task wins over low-priority future task", () => {
    const overdueTask: Task = {
      id: 1,
      title: "Overdue Lab Report",
      dueDate: "2026-10-04", // 2 days overdue
      priority: "Low",
      status: "open",
    }
    const futureTask: Task = {
      id: 2,
      title: "Next Month Chapter Reading",
      dueDate: "2026-11-06",
      priority: "Low",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [futureTask, overdueTask],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 1)
    assert.equal(rec.title, "Overdue Lab Report")
    assert.ok(rec.reason.toLowerCase().includes("overdue"))
    assert.ok(rec.factors.urgency >= 150)
  })

  // TEST 2: High-priority task due tomorrow beats low-priority task due next week
  it("TEST 2: High-priority task due tomorrow beats low-priority task due next week", () => {
    const highDueTomorrow: Task = {
      id: 10,
      title: "Algorithms Problem Set",
      dueDate: "2026-10-07", // tomorrow
      priority: "High",
      duration: "45",
      status: "open",
    }
    const lowDueNextWeek: Task = {
      id: 11,
      title: "Club Poster Drafting",
      dueDate: "2026-10-14", // next week
      priority: "Low",
      duration: "30",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [lowDueNextWeek, highDueTomorrow],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 10)
    assert.equal(rec.title, "Algorithms Problem Set")
  })

  // TEST 3: Short task fits into available time
  it("TEST 3: Short task fits into available time", () => {
    // Current time 10:00 AM. Next class at 11:00 AM (60 minutes available).
    // Today is Tuesday (2026-10-06) -> dayOfWeek = 2
    const timetable: TimetableEntry[] = [
      {
        id: "tt-1",
        dayOfWeek: 2,
        dayName: "Tuesday",
        courseCode: "24CS3105",
        courseName: "Information Assurance",
        isKnownCourse: true,
        startTime: "11:00",
        endTime: "12:40",
        startPeriod: 4,
        endPeriod: 5,
      },
    ]

    const shortTask: Task = {
      id: 21,
      title: "Quick Quiz Review",
      duration: "30", // Fits well into 60 min window
      status: "open",
    }
    const longTask: Task = {
      id: 22,
      title: "Comprehensive Architecture Thesis",
      duration: "180", // 3 hours — exceeds 60 min window
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: new Date("2026-10-06T10:00:00"),
      timetable,
      tasks: [longTask, shortTask],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 21)
    assert.equal(rec.title, "Quick Quiz Review")
    assert.ok(rec.factors.fit > 0)
  })

  // TEST 4: Long task is deprioritized when there is insufficient time
  it("TEST 4: Long task is deprioritized when there is insufficient time", () => {
    const timetable: TimetableEntry[] = [
      {
        id: "tt-1",
        dayOfWeek: 2,
        dayName: "Tuesday",
        courseCode: "24CI3201",
        courseName: "Adaptive Software Engineering",
        isKnownCourse: true,
        startTime: "10:45",
        endTime: "11:35",
        startPeriod: 4,
        endPeriod: 4,
      },
    ]

    // 45 minutes until next class at 10:45
    const taskA: Task = {
      id: 31,
      title: "Complete 3h Mock Exam",
      duration: "180",
      priority: "Medium",
      status: "open",
    }
    const taskB: Task = {
      id: 32,
      title: "Read Lecture Summary",
      duration: "25",
      priority: "Medium",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: new Date("2026-10-06T10:00:00"),
      timetable,
      tasks: [taskA, taskB],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 32)
    assert.equal(rec.title, "Read Lecture Summary")
  })

  // TEST 5: Upcoming exam increases explicitly related task relevance
  it("TEST 5: Upcoming exam increases explicitly related task relevance", () => {
    const examEvents: EventItem[] = [
      {
        id: 501,
        title: "Information Assurance and Security Midterm",
        type: "Exam",
        date: "2026-10-08", // 2 days away
        time: "09:00",
        endTime: "11:00",
      },
    ]

    const examTask: Task = {
      id: 51,
      title: "Revise Cryptography and Hashing",
      course: "Information Assurance and Security", // Explicit course match
      priority: "Medium",
      dueDate: "2026-10-12",
      status: "open",
    }

    const otherTask: Task = {
      id: 52,
      title: "Read General Literature",
      course: "Indian Constitution", // No upcoming exam
      priority: "Medium",
      dueDate: "2026-10-12",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: new Date("2026-10-06T10:00:00"),
      calendarEvents: examEvents,
      tasks: [otherTask, examTask],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 51)
    assert.ok(rec.factors.exam > 0)
    assert.equal(rec.recommendationType, "exam_prep")
  })

  // TEST 6: Goal-linked task receives goal relevance
  it("TEST 6: Goal-linked task receives goal relevance", () => {
    const goals: Goal[] = [
      {
        id: 601,
        title: "Complete GATE CSE Preparation",
        completed: 40,
        category: "Academic",
        targetDate: "2027-02-01",
        milestones: [],
      },
    ]

    const goalTask: Task = {
      id: 61,
      title: "Solve Operating Systems PYQs",
      goal: "Complete GATE CSE Preparation", // Explicit goal match
      status: "open",
    }

    const unlinkedTask: Task = {
      id: 62,
      title: "Organize Desktop Files",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: baseDate,
      goals,
      tasks: [unlinkedTask, goalTask],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 61)
    assert.ok(rec.factors.goal > 0)
    assert.equal(rec.recommendationType, "goal_task")
  })

  // TEST 7: Snoozed task is not immediately recommended
  it("TEST 7: Snoozed task is not immediately recommended", () => {
    const snoozedTask: Task = {
      id: 71,
      title: "High Priority Urgent Task",
      priority: "High",
      dueDate: "2026-10-06",
      status: "snoozed",
      snoozedUntil: new Date("2026-10-06T14:00:00").toISOString(), // Snoozed until 2 PM
    }

    const openTask: Task = {
      id: 72,
      title: "Regular Assignment",
      priority: "Medium",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: new Date("2026-10-06T10:00:00"),
      tasks: [snoozedTask, openTask],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 72)
    assert.equal(rec.title, "Regular Assignment")
  })

  // TEST 8: Completed tasks are excluded
  it("TEST 8: Completed tasks are excluded", () => {
    const completedTask: Task = {
      id: 81,
      title: "Already Finished Lab Submission",
      dueDate: "2026-10-05",
      priority: "High",
      status: "completed",
    }

    const openTask: Task = {
      id: 82,
      title: "Pending Reading",
      priority: "Low",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [completedTask, openTask],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 82)
    assert.equal(rec.title, "Pending Reading")
  })

  // TEST 9: Timetable blocks are never recommended as tasks
  it("TEST 9: Timetable blocks are never recommended as tasks", () => {
    const timetable: TimetableEntry[] = [
      {
        id: "tt-class-1",
        dayOfWeek: 2,
        dayName: "Tuesday",
        courseCode: "24CS3105",
        courseName: "Information Assurance Lecture",
        isKnownCourse: true,
        startTime: "10:40",
        endTime: "11:30",
        startPeriod: 4,
        endPeriod: 4,
      },
    ]

    const actualTask: Task = {
      id: 91,
      title: "Review Cryptography Notes",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: new Date("2026-10-06T10:00:00"),
      timetable,
      tasks: [actualTask],
    }

    const rec = getFocusRecommendation(context)
    // Recommendation MUST be the actual task, NEVER the timetable entry
    assert.equal(rec.taskId, 91)
    assert.notEqual(rec.title, "Information Assurance Lecture")
  })

  // TEST 10: Calendar events constrain available time
  it("TEST 10: Calendar events constrain available time", () => {
    const calendarEvents: EventItem[] = [
      {
        id: 1001,
        title: "Department Seminar",
        type: "Event",
        date: "2026-10-06",
        time: "11:00",
        endTime: "12:00",
      },
    ]

    // Current time 10:15 (45 min available)
    const fittingTask: Task = {
      id: 101,
      title: "Quick Code Exercise",
      duration: "30", // Fits into 45 min
      status: "open",
    }
    const oversizedTask: Task = {
      id: 102,
      title: "3-Hour Deep Project Work",
      duration: "180", // Exceeds 45 min
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: new Date("2026-10-06T10:15:00"),
      calendarEvents,
      tasks: [oversizedTask, fittingTask],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 101)
    assert.equal(rec.availableWindow.availableMinutes, 45)
  })

  // TEST 11: No tasks produces an honest empty state
  it("TEST 11: No tasks produces an honest empty state", () => {
    const contextA: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [],
    }
    const recA = getFocusRecommendation(contextA)
    assert.equal(recA.taskId, null)
    assert.equal(recA.recommendationType, "no_task")
    assert.ok(recA.reason.includes("clear"))

    const contextB: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [
        {
          id: 111,
          title: "Done Task",
          status: "completed",
        },
      ],
    }
    const recB = getFocusRecommendation(contextB)
    assert.equal(recB.taskId, null)
    assert.equal(recB.recommendationType, "no_task")
    assert.ok(recB.reason.includes("clear"))
  })

  // TEST 12: Equal scores produce deterministic ordering
  it("TEST 12: Equal scores produce deterministic ordering", () => {
    // Both tasks have identical properties except Task A has earlier deadline
    const taskA: Task = {
      id: 121,
      title: "Task Alpha",
      dueDate: "2026-10-10",
      dueTime: "10:00",
      priority: "Medium",
      status: "open",
    }
    const taskB: Task = {
      id: 122,
      title: "Task Beta",
      dueDate: "2026-10-10",
      dueTime: "14:00", // later time on same day
      priority: "Medium",
      status: "open",
    }

    const context1: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [taskB, taskA],
    }
    const rec1 = getFocusRecommendation(context1)

    const context2: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [taskA, taskB],
    }
    const rec2 = getFocusRecommendation(context2)

    // Earlier dueTime wins deterministically regardless of input array order
    assert.equal(rec1.taskId, 121)
    assert.equal(rec2.taskId, 121)
  })

  // TEST 13: Missing duration does not create a fabricated duration
  it("TEST 13: Missing duration does not create a fabricated duration", () => {
    const taskWithoutDuration: Task = {
      id: 131,
      title: "Task Without Stated Duration",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [taskWithoutDuration],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 131)
    assert.equal(rec.estimatedMinutes, undefined)
    assert.equal(rec.factors.fit, 0) // Neutral fit score, not fabricated
  })

  // TEST 14: Missing preferences do not cause invented preferences
  it("TEST 14: Missing preferences do not cause invented preferences", () => {
    const task: Task = {
      id: 141,
      title: "Standard Open Task",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: baseDate,
      userPreferences: undefined, // No preferences provided
      tasks: [task],
    }

    const rec = getFocusRecommendation(context)
    assert.equal(rec.taskId, 141)
    assert.equal(rec.factors.preference, 0) // No invented preference bonus
  })

  // TEST 15: Same input context always produces the same recommendation
  it("TEST 15: Same input context always produces the same recommendation", () => {
    const task1: Task = {
      id: 151,
      title: "Calculus Assignment",
      dueDate: "2026-10-08",
      priority: "High",
      duration: "45",
      status: "open",
    }
    const task2: Task = {
      id: 152,
      title: "Physics Problem Set",
      dueDate: "2026-10-09",
      priority: "Medium",
      duration: "30",
      status: "open",
    }

    const context: DecisionContext = {
      currentDateTime: baseDate,
      tasks: [task1, task2],
    }

    const run1 = getFocusRecommendation(context)
    const run2 = getFocusRecommendation(context)
    const run3 = getFocusRecommendation(context)

    assert.deepEqual(run1, run2)
    assert.deepEqual(run2, run3)
  })
})
