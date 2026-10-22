// ==================================================
// SAGE DATE & TIME INTELLIGENCE UTILITIES
// ==================================================
// Principles:
// 1. Crystal-clear deadlines: users should never have to guess "when is this due?"
// 2. High-contrast visual hierarchy: Overdue (Red/Alert), Due Soon (Amber/Clock),
//    Today (Brand), Tomorrow (Informative), Later (Neutral), Done (Muted Check).
// 3. User-friendly 12-hr formatting: "5:00 PM" instead of "17:00".
// 4. Human relative countdowns: "in 2 hours", "Tomorrow at 5:00 PM", "Overdue by 1 day".
// ==================================================

export type DeadlineUrgency =
  | "overdue"
  | "urgent" // Due today within 3 hours
  | "today" // Due today
  | "tomorrow" // Due tomorrow
  | "upcoming" // Due within 7 days
  | "later" // Due > 7 days
  | "completed"
  | "none"

export interface FormattedDeadline {
  urgency: DeadlineUrgency
  urgencyColor: "danger" | "warning" | "brand" | "informative" | "subtle" | "success"
  badgeText: string
  formattedDate: string
  formattedTime: string
  fullDisplay: string
  relativeCountdown: string
  isOverdue: boolean
  isToday: boolean
}

/**
 * Converts 24-hr time string (e.g. "17:00", "09:30") or preserves 12-hr strings into clean "5:00 PM" format.
 */
export function formatTime12(timeStr?: string): string {
  if (!timeStr) return ""
  const clean = timeStr.trim()
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i)
  if (!match) return clean

  let hour = parseInt(match[1], 10)
  const minute = match[2]
  const meridiemParam = match[3]

  if (meridiemParam) {
    return `${hour}:${minute} ${meridiemParam.toUpperCase()}`
  }

  const meridiem = hour >= 12 ? "PM" : "AM"
  if (hour === 0) {
    hour = 12
  } else if (hour > 12) {
    hour -= 12
  }
  return `${hour}:${minute} ${meridiem}`
}

/**
 * Returns formatted friendly date (e.g. "Thu, Oct 23" or "Today" or "Tomorrow").
 */
export function formatFriendlyDate(dateStr: string, refDate: Date = new Date()): string {
  if (!dateStr) return ""
  const parts = dateStr.split("-").map(Number)
  if (parts.length < 3 || isNaN(parts[0])) return dateStr

  const targetDate = new Date(parts[0], parts[1] - 1, parts[2])
  const todayYMD = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(refDate.getDate()).padStart(2, "0")}`
  const tmrw = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1)
  const tmrwYMD = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, "0")}-${String(tmrw.getDate()).padStart(2, "0")}`

  if (dateStr === todayYMD) return "Today"
  if (dateStr === tmrwYMD) return "Tomorrow"

  const weekdayShort = targetDate.toLocaleDateString(undefined, { weekday: "short" })
  const monthDay = targetDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `${weekdayShort}, ${monthDay}`
}

/**
 * Evaluates a task deadline and produces rich, visual, humanized status information.
 */
export function getTaskDeadlineInfo(
  dueDate?: string,
  dueTime?: string,
  status?: string,
  refDate: Date = new Date(),
): FormattedDeadline {
  if (status === "completed") {
    const formattedTime = formatTime12(dueTime)
    const formattedDate = dueDate ? formatFriendlyDate(dueDate, refDate) : ""
    return {
      urgency: "completed",
      urgencyColor: "success",
      badgeText: "Completed",
      formattedDate,
      formattedTime: formattedTime || "Completed",
      fullDisplay: formattedDate
        ? `Completed · Was due ${formattedDate}${formattedTime ? ` at ${formattedTime}` : ""}`
        : "Completed",
      relativeCountdown: "Completed",
      isOverdue: false,
      isToday: false,
    }
  }

  if (!dueDate) {
    return {
      urgency: "none",
      urgencyColor: "subtle",
      badgeText: "No deadline",
      formattedDate: "No due date",
      formattedTime: "",
      fullDisplay: "No deadline set",
      relativeCountdown: "Flexible",
      isOverdue: false,
      isToday: false,
    }
  }

  const cleanTime = dueTime && /^\d{1,2}:\d{2}/.test(dueTime) ? dueTime.slice(0, 5) : ""
  const formattedTime = cleanTime ? formatTime12(cleanTime) : "11:59 PM (End of day)"

  // If time is specified, use that exact hour/minute. If not, default to 23:59:59 (end of due day).
  const parts = dueDate.split("-").map(Number)
  const y = parts[0]
  const m = parts[1] || 1
  const d = parts[2] || 1

  const targetDate = cleanTime
    ? new Date(y, m - 1, d, parseInt(cleanTime.split(":")[0], 10), parseInt(cleanTime.split(":")[1], 10), 0)
    : new Date(y, m - 1, d, 23, 59, 59)

  const diffMs = targetDate.getTime() - refDate.getTime()
  const isPast = diffMs < 0

  const todayYMD = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(refDate.getDate()).padStart(2, "0")}`
  const tmrw = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1)
  const tmrwYMD = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, "0")}-${String(tmrw.getDate()).padStart(2, "0")}`

  const isToday = dueDate === todayYMD
  const isTomorrow = dueDate === tmrwYMD

  const weekdayShort = targetDate.toLocaleDateString(undefined, { weekday: "short" })
  const monthDay = targetDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const formattedDate = isToday ? "Today" : isTomorrow ? "Tomorrow" : `${weekdayShort}, ${monthDay}`

  if (isPast) {
    const absDiffMs = Math.abs(diffMs)
    const diffHours = Math.floor(absDiffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24))

    let overdueText = ""
    if (diffDays >= 1) {
      overdueText = `Overdue by ${diffDays}d`
    } else if (diffHours >= 1) {
      overdueText = `Overdue by ${diffHours}h`
    } else {
      const diffMins = Math.max(1, Math.floor(absDiffMs / (1000 * 60)))
      overdueText = `Overdue by ${diffMins}m`
    }

    return {
      urgency: "overdue",
      urgencyColor: "danger",
      badgeText: overdueText,
      formattedDate,
      formattedTime: cleanTime ? formatTime12(cleanTime) : "End of day",
      fullDisplay: `${overdueText} · Was due ${formattedDate}${cleanTime ? ` at ${formatTime12(cleanTime)}` : ""}`,
      relativeCountdown: overdueText,
      isOverdue: true,
      isToday,
    }
  }

  // Future deadline
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (isToday) {
    if (cleanTime && diffHours < 3) {
      const countdown = diffHours > 0 ? `${diffHours}h ${diffMins % 60}m` : `${diffMins}m`
      return {
        urgency: "urgent",
        urgencyColor: "danger",
        badgeText: `Due in ${countdown}`,
        formattedDate: "Today",
        formattedTime,
        fullDisplay: `Due Today at ${formattedTime} (in ${countdown})`,
        relativeCountdown: `in ${countdown}`,
        isOverdue: false,
        isToday: true,
      }
    }
    return {
      urgency: "today",
      urgencyColor: "warning",
      badgeText: `Due Today · ${cleanTime ? formattedTime : "End of day"}`,
      formattedDate: "Today",
      formattedTime,
      fullDisplay: `Due Today at ${formattedTime}${cleanTime && diffHours >= 1 ? ` (in ${diffHours}h)` : ""}`,
      relativeCountdown: diffHours >= 1 ? `in ${diffHours} hours` : "Today",
      isOverdue: false,
      isToday: true,
    }
  }

  if (isTomorrow) {
    return {
      urgency: "tomorrow",
      urgencyColor: "brand",
      badgeText: `Due Tomorrow · ${cleanTime ? formattedTime : "End of day"}`,
      formattedDate: "Tomorrow",
      formattedTime,
      fullDisplay: `Due Tomorrow at ${formattedTime}`,
      relativeCountdown: diffHours > 0 ? `in ${diffHours}h` : "Tomorrow",
      isOverdue: false,
      isToday: false,
    }
  }

  if (diffDays <= 7) {
    return {
      urgency: "upcoming",
      urgencyColor: "informative",
      badgeText: `Due ${weekdayShort} · ${cleanTime ? formattedTime : monthDay}`,
      formattedDate: `${weekdayShort}, ${monthDay}`,
      formattedTime,
      fullDisplay: `Due ${weekdayShort}, ${monthDay} at ${formattedTime}`,
      relativeCountdown: `in ${diffDays} days`,
      isOverdue: false,
      isToday: false,
    }
  }

  return {
    urgency: "later",
    urgencyColor: "subtle",
    badgeText: `Due ${monthDay}${cleanTime ? ` · ${formattedTime}` : ""}`,
    formattedDate: `${weekdayShort}, ${monthDay}`,
    formattedTime,
    fullDisplay: `Due ${monthDay} at ${formattedTime}`,
    relativeCountdown: `in ${diffDays} days`,
    isOverdue: false,
    isToday: false,
  }
}

export interface FormattedReminderVisual {
  urgencyColor: "danger" | "warning" | "brand" | "informative" | "subtle" | "success"
  statusBadge: string // e.g. "Triggers in 45m", "Triggered (Overdue)", "Today at 9:00 AM"
  formattedTime: string // e.g. "9:00 AM"
  formattedDate: string // e.g. "Today", "Tomorrow", "Thu, Oct 23"
  countdownText: string // e.g. "in 45 mins", "in 2 days", "30 mins ago"
  summaryLine: string // e.g. "Reminder at 9:00 AM (in 45 mins) · In-app"
  isTriggered: boolean
  isSnoozed: boolean
}

/**
 * Produces clear visual timing indicators for Reminders.
 */
export function getReminderVisualInfo(
  triggerMs: number,
  dateStr?: string,
  timeStr?: string,
  status?: string,
  method?: string,
  refDate: Date = new Date(),
): FormattedReminderVisual {
  const isSnoozed = status === "snoozed"
  const isCompleted = status === "completed"

  const formattedTime = formatTime12(timeStr || "09:00")
  const formattedDate = dateStr ? formatFriendlyDate(dateStr, refDate) : "Today"

  if (isCompleted) {
    return {
      urgencyColor: "success",
      statusBadge: "Completed",
      formattedTime,
      formattedDate,
      countdownText: "Done",
      summaryLine: `Completed · Notified at ${formattedTime}`,
      isTriggered: true,
      isSnoozed: false,
    }
  }

  if (isSnoozed) {
    return {
      urgencyColor: "warning",
      statusBadge: `Snoozed to ${formattedTime}`,
      formattedTime,
      formattedDate,
      countdownText: "Snoozed",
      summaryLine: `Snoozed until ${formattedDate} at ${formattedTime}`,
      isTriggered: false,
      isSnoozed: true,
    }
  }

  const nowMs = refDate.getTime()
  const diffMs = triggerMs - nowMs

  if (diffMs <= 0) {
    const absDiffMs = Math.abs(diffMs)
    const diffMins = Math.floor(absDiffMs / (1000 * 60))
    const diffHours = Math.floor(absDiffMs / (1000 * 60 * 60))

    let agoStr = "Just now"
    if (diffHours >= 1) {
      agoStr = `${diffHours}h ago`
    } else if (diffMins >= 1) {
      agoStr = `${diffMins}m ago`
    }

    return {
      urgencyColor: "danger",
      statusBadge: `Triggered (${agoStr})`,
      formattedTime,
      formattedDate,
      countdownText: agoStr,
      summaryLine: `Triggered at ${formattedTime} (${agoStr}) · ${method || "In-app"}`,
      isTriggered: true,
      isSnoozed: false,
    }
  }

  // Future trigger
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) {
    const minsLeft = Math.max(1, diffMins)
    return {
      urgencyColor: "danger",
      statusBadge: `Triggers in ${minsLeft}m`,
      formattedTime,
      formattedDate,
      countdownText: `in ${minsLeft} mins`,
      summaryLine: `Triggers in ${minsLeft} minutes at ${formattedTime} · ${method || "In-app"}`,
      isTriggered: false,
      isSnoozed: false,
    }
  }

  if (formattedDate === "Today") {
    return {
      urgencyColor: "brand",
      statusBadge: `Today at ${formattedTime} (in ${diffHours}h)`,
      formattedTime,
      formattedDate: "Today",
      countdownText: `in ${diffHours}h`,
      summaryLine: `Triggers Today at ${formattedTime} (in ${diffHours}h) · ${method || "In-app"}`,
      isTriggered: false,
      isSnoozed: false,
    }
  }

  if (formattedDate === "Tomorrow") {
    return {
      urgencyColor: "informative",
      statusBadge: `Tomorrow at ${formattedTime}`,
      formattedTime,
      formattedDate: "Tomorrow",
      countdownText: `in ${diffHours}h`,
      summaryLine: `Triggers Tomorrow at ${formattedTime} · ${method || "In-app"}`,
      isTriggered: false,
      isSnoozed: false,
    }
  }

  return {
    urgencyColor: "subtle",
    statusBadge: `${formattedDate} · ${formattedTime}`,
    formattedTime,
    formattedDate,
    countdownText: `in ${diffDays} days`,
    summaryLine: `Triggers ${formattedDate} at ${formattedTime} (in ${diffDays} days) · ${method || "In-app"}`,
    isTriggered: false,
    isSnoozed: false,
  }
}
