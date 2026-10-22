import test from "node:test"
import assert from "node:assert/strict"
import {
  formatTime12,
  formatFriendlyDate,
  getTaskDeadlineInfo,
  getReminderVisualInfo,
} from "./dateTimeUtils.ts"

test("formatTime12: formats 24-hr and 12-hr strings into clean 12-hr format", () => {
  assert.equal(formatTime12("17:00"), "5:00 PM")
  assert.equal(formatTime12("09:30"), "9:30 AM")
  assert.equal(formatTime12("00:00"), "12:00 AM")
  assert.equal(formatTime12("12:00"), "12:00 PM")
  assert.equal(formatTime12("12:30"), "12:30 PM")
  assert.equal(formatTime12("23:59"), "11:59 PM")
  assert.equal(formatTime12(""), "")
})

test("getTaskDeadlineInfo: identifies overdue tasks accurately", () => {
  const ref = new Date("2026-10-21T12:00:00")
  const info = getTaskDeadlineInfo("2026-10-20", "17:00", "open", ref)
  assert.equal(info.isOverdue, true)
  assert.equal(info.urgency, "overdue")
  assert.equal(info.urgencyColor, "danger")
  assert.match(info.badgeText, /Overdue/)
})

test("getTaskDeadlineInfo: identifies tasks due today", () => {
  const ref = new Date("2026-10-21T10:00:00")
  const info = getTaskDeadlineInfo("2026-10-21", "17:00", "open", ref)
  assert.equal(info.isOverdue, false)
  assert.equal(info.isToday, true)
  assert.equal(info.formattedDate, "Today")
  assert.equal(info.formattedTime, "5:00 PM")
  assert.match(info.badgeText, /Due Today/)
})

test("getTaskDeadlineInfo: identifies tasks due soon (within 3 hours)", () => {
  const ref = new Date("2026-10-21T15:30:00")
  const info = getTaskDeadlineInfo("2026-10-21", "17:00", "open", ref)
  assert.equal(info.urgency, "urgent")
  assert.equal(info.urgencyColor, "danger")
  assert.match(info.badgeText, /Due in 1h 30m/)
})

test("getTaskDeadlineInfo: identifies tasks due tomorrow", () => {
  const ref = new Date("2026-10-21T10:00:00")
  const info = getTaskDeadlineInfo("2026-10-22", "15:00", "open", ref)
  assert.equal(info.urgency, "tomorrow")
  assert.equal(info.urgencyColor, "brand")
  assert.match(info.badgeText, /Due Tomorrow/)
  assert.equal(info.formattedTime, "3:00 PM")
})

test("getTaskDeadlineInfo: handles completed tasks cleanly", () => {
  const ref = new Date("2026-10-21T10:00:00")
  const info = getTaskDeadlineInfo("2026-10-15", "10:00", "completed", ref)
  assert.equal(info.isOverdue, false)
  assert.equal(info.urgency, "completed")
  assert.equal(info.urgencyColor, "success")
  assert.equal(info.badgeText, "Completed")
})

test("getReminderVisualInfo: formats upcoming and triggered reminders", () => {
  const ref = new Date("2026-10-21T10:00:00")
  // 30 mins in future
  const futureMs = ref.getTime() + 30 * 60 * 1000
  const upcomingInfo = getReminderVisualInfo(futureMs, "2026-10-21", "10:30", "open", "In-app", ref)
  assert.equal(upcomingInfo.isTriggered, false)
  assert.equal(upcomingInfo.urgencyColor, "danger")
  assert.match(upcomingInfo.statusBadge, /Triggers in 30m/)

  // 15 mins in past (triggered)
  const pastMs = ref.getTime() - 15 * 60 * 1000
  const pastInfo = getReminderVisualInfo(pastMs, "2026-10-21", "09:45", "open", "In-app", ref)
  assert.equal(pastInfo.isTriggered, true)
  assert.match(pastInfo.statusBadge, /Triggered/)
})
