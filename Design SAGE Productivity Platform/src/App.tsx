import { useEffect, useMemo, useRef, useState } from "react"
import { Avatar } from "@fluentui/react-avatar"
import { Badge } from "@fluentui/react-badge"
import { Button } from "@fluentui/react-button"
import { Card } from "@fluentui/react-card"
import { Checkbox } from "@fluentui/react-checkbox"
import { Dropdown, Option } from "@fluentui/react-combobox"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-dialog"
import { Divider } from "@fluentui/react-divider"
import { Input } from "@fluentui/react-input"
import { Label } from "@fluentui/react-label"
import { ProgressBar } from "@fluentui/react-progress"
import { FluentProvider } from "@fluentui/react-provider"
import { Switch } from "@fluentui/react-switch"
import {
  Tab,
  TabList,
  type SelectTabData,
  type SelectTabEvent,
} from "@fluentui/react-tabs"
import { Text } from "@fluentui/react-text"
import { Textarea } from "@fluentui/react-textarea"
import { webLightTheme } from "@fluentui/react-theme"
import { Tooltip } from "@fluentui/react-tooltip"
import { Add20Regular } from "@fluentui/react-icons/svg/add"
import { Alert20Regular } from "@fluentui/react-icons/svg/alert"
import { ArrowLeft20Regular } from "@fluentui/react-icons/svg/arrow-left"
import { ArrowReset20Regular } from "@fluentui/react-icons/svg/arrow-reset"
import { ArrowRight20Regular } from "@fluentui/react-icons/svg/arrow-right"
import { Book20Regular } from "@fluentui/react-icons/svg/book"
import { Bot20Regular } from "@fluentui/react-icons/svg/bot"
import { CalendarLtr20Regular } from "@fluentui/react-icons/svg/calendar-ltr"
import {
  CheckmarkCircle20Filled,
  CheckmarkCircle20Regular,
} from "@fluentui/react-icons/svg/checkmark-circle"
import { Clock20Regular } from "@fluentui/react-icons/svg/clock"
import { Code20Regular } from "@fluentui/react-icons/svg/code"
import { DataTrending20Regular } from "@fluentui/react-icons/svg/data-trending"
import { Delete20Regular } from "@fluentui/react-icons/svg/delete"
import { Dismiss20Regular } from "@fluentui/react-icons/svg/dismiss"
import { Edit20Regular } from "@fluentui/react-icons/svg/edit"
import { Home20Regular } from "@fluentui/react-icons/svg/home"
import { List20Regular } from "@fluentui/react-icons/svg/list"
import { MoreHorizontal20Regular } from "@fluentui/react-icons/svg/more-horizontal"
import { Navigation20Regular } from "@fluentui/react-icons/svg/navigation"
import { Pause20Regular } from "@fluentui/react-icons/svg/pause"
import { Play20Filled } from "@fluentui/react-icons/svg/play"
import { Search20Regular } from "@fluentui/react-icons/svg/search"
import { Settings20Regular } from "@fluentui/react-icons/svg/settings"
import { Sparkle20Filled } from "@fluentui/react-icons/svg/sparkle"
import { TargetArrow20Regular } from "@fluentui/react-icons/svg/target-arrow"
import { Timer20Regular } from "@fluentui/react-icons/svg/timer"
import { Location20Regular } from "@fluentui/react-icons/svg/location"
import { Open20Regular } from "@fluentui/react-icons/svg/open"
import {
  deleteGoogleCalendarEvent,
  disconnectGoogleCalendar,
  getCustomGoogleClientId,
  getGoogleClientId,
  isGoogleCalendarConnected,
  openInGoogleCalendar,
  pushGoogleCalendarEvent,
  setCustomGoogleClientId,
  signOutGoogle,
  syncGoogleCalendarEvents,
  type GoogleUser,
} from "./googleCalendar"
import GoogleAuthButton from "./GoogleAuthButton"
import {
  AuthProvider,
  useAuth,
  type AuthUser,
  AUTH_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
} from "./AuthContext"
import {
  getUserItem,
  setUserItem,
  removeUserItem,
  getUserScopeKey,
} from "./userStorage"
import {
  type TimetableEntry,
  COURSE_CATALOG,
  resolveCourseName,
  normalizeLocation,
  formatTime12,
  formatTimeRange,
  mergeConsecutivePeriods,
  OFFICIAL_TIMETABLE_SLOTS,
  getSampleTimetableTemplate,
  createManualTimetableEntry,
  parseUploadedTimetableFile,
  fileToDataUrl,
  loadSavedTimetable,
  saveTimetable,
  getClassesForDay,
  getHomeClassStatus,
} from "./timetable"
import {
  type Reminder,
  type NotificationPreferences,
  type ReminderTiming,
  NOTIFICATIONS_STORAGE_KEY,
  REMINDERS_STORAGE_KEY,
  DEFAULT_NOTIFICATION_PREFERENCES,
  TIMING_LABELS,
  buildDueAtTimestamp,
  isReminderDue,
  isWithinQuietHours,
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  dispatchBrowserNotification,
  syncNotificationPreferences,
  normalizeReminder,
  upsertContestReminder,
  removeContestReminder,
  findContestReminder,
  getReminderTriggerTime,
  loadSavedReminders,
  saveReminders,
  upsertTaskDeadlineReminder,
  removeTaskDeadlineReminder,
  buildTaskDeadlineReminder,
} from "./notifications"
import {
  getTaskDeadlineInfo,
  getReminderVisualInfo,
  formatFriendlyDate,
} from "./dateTimeUtils"
import {
  type ChatMessage,
  type SageContext,
  askSage,
} from "./services/sageService"
import AskSageChatbot from "./components/AskSageChatbot"
import InAppNotificationBanner from "./components/InAppNotificationBanner"
import {
  syncReminderToBackend,
  getBackendReminders,
  updateBackendReminderStatus,
  deleteBackendReminder,
  sendTestReminderEmail,
  backendReminderToFrontend,
  type BackendReminder,
} from "./services/reminderService"
import {
  taskService,
  getStoredLocalTasks,
  saveStoredLocalTasks,
} from "./services/taskService"
import {
  getFocusRecommendation,
  getFocusNowRecommendation,
} from "./decision/decisionEngine.ts"
import {
  recordRecommendationEvent,
  recordFocusSessionEvent,
} from "./decision/decisionUtils.ts"
import type {
  DecisionContext,
  FocusRecommendation as EngineRecommendation,
  ItemStatus,
  Task,
  Goal,
  EventItem,
} from "./decision/decisionTypes.ts"
import "./index.css"
import DiagnosticsDashboard from "./DiagnosticsDashboard"

type Flow = "landing" | "auth" | "onboarding" | "app"
type View = "Home" | "Tasks" | "Goals" | "Calendar" | "Contests" | "Reminders" | "Progress" | "Ask SAGE" | "Settings"
type Contest = {
  id: string
  platform: string
  name: string
  startTime: string
  duration: number
  url: string
  status: "upcoming" | "ongoing" | "ended"
  lastUpdated: string
  reminder: string | null
}
type Profile = {
  name: string
  email: string
  college: string
  course: string
  year: string
  timezone: string
}

export type UserPreferences = {
  period: string
  duration: string
  target: string
  includeBreaks?: boolean
  avoidPersonalCommitments?: boolean
}

export const USER_PREFERENCES_STORAGE_KEY = "sage-user-preferences"
export const PLATFORMS_STORAGE_KEY = "sage-platforms"
export const FOCUS_SESSIONS_STORAGE_KEY = "sage-focus-sessions"

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

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  period: "Afternoon",
  duration: "45",
  target: "2",
  includeBreaks: true,
  avoidPersonalCommitments: false,
}

const emptyTask: Omit<Task, "id"> = {
  title: "",
  description: "",
  course: "",
  dueDate: "",
  dueTime: "",
  duration: "30",
  priority: "Medium",
  goal: "",
  notes: "",
  status: "open",
}
const emptyGoal: Omit<Goal, "id"> = {
  title: "",
  description: "",
  category: "Academic",
  targetDate: "",
  milestones: [],
  completed: 0,
}
const emptyEvent: Omit<EventItem, "id"> = {
  title: "",
  type: "Class",
  date: "",
  time: "",
  endTime: "",
}
const platformOptions = [
  "LeetCode",
  "CodeChef",
  "Codeforces",
  "HackerRank",
  "AtCoder",
]

type NavItem = {
  label: View
  icon: React.ReactElement
}

type SchedulePatch = {
  title: string
  date: string
  time: string
  endTime: string
}

type ExamDraft = {
  title: string
  date: string
  time: string
}

const nav: NavItem[] = [
  { label: "Home", icon: <Home20Regular /> },
  { label: "Tasks", icon: <List20Regular /> },
  { label: "Goals", icon: <TargetArrow20Regular /> },
  { label: "Calendar", icon: <CalendarLtr20Regular /> },
  { label: "Contests", icon: <Code20Regular /> },
  { label: "Reminders", icon: <Alert20Regular /> },
  { label: "Progress", icon: <DataTrending20Regular /> },
  { label: "Ask SAGE", icon: <Bot20Regular /> },
]

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Book20Regular />
      </div>
      <div>
        <Text as="span" size={500} weight="semibold">
          SAGE
        </Text>
        <Text size={100}>Student workspace</Text>
      </div>
    </div>
  )
}

function Landing({ start }: { start: (mode: "google" | "email") => void }) {
  return (
    <div className="public-page">
      <header className="public-nav">
        <Brand />
        <div className="button-row">
          <Button appearance="subtle" onClick={() => start("email")}>
            Sign in
          </Button>
          <Button appearance="primary" onClick={() => start("email")}>
            Get started
          </Button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <Text className="eyebrow">ONE CALM PLACE FOR STUDENT WORK</Text>
            <Text as="span" className="hero-title">
              Make your next move clear.
            </Text>
            <Text size={500}>
              SAGE brings your tasks, schedule, goals, exams, and coding
              contests together—then helps you decide what deserves your
              attention next.
            </Text>
            <div className="hero-actions">
              <Button
                size="large"
                appearance="primary"
                icon={<span className="google-mark">G</span>}
                onClick={() => start("google")}
              >
                Continue with Google
              </Button>
              <Button
                size="large"
                appearance="secondary"
                onClick={() => start("email")}
              >
                Continue with Email
              </Button>
            </div>
            <Text size={200}>
              Your information stays yours. No rankings, noise, or fabricated
              insights.
            </Text>
          </div>
          <Card className="hero-preview">
            <div className="preview-top">
              <div>
                <Text className="eyebrow">FOCUS NOW</Text>
                <Text as="span" size={600} weight="semibold">
                  Know what matters next
                </Text>
              </div>
              <div className="sage-mark">
                <Sparkle20Filled />
              </div>
            </div>
            <Card className="preview-recommendation">
              <Text weight="semibold">Your recommendation appears here</Text>
              <Text size={200}>
                SAGE explains why, based on your deadlines and available time.
              </Text>
              <Button appearance="primary" icon={<Play20Filled />}>
                Start focus
              </Button>
            </Card>
            <div className="preview-grid">
              {[
                ["Tasks", <List20Regular />, "Capture every deadline"],
                [
                  "Calendar",
                  <CalendarLtr20Regular />,
                  "See classes and study time",
                ],
                ["Goals", <TargetArrow20Regular />, "Move milestones forward"],
                ["Contests", <Code20Regular />, "Follow selected platforms"],
              ].map(([title, icon, copy]) => (
                <div className="preview-tile" key={String(title)}>
                  {icon}
                  <div>
                    <Text as="span" weight="semibold">
                      {title}
                    </Text>
                    <Text size={100}>{copy}</Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
        <section className="landing-section">
          <Text className="eyebrow">HOW SAGE WORKS</Text>
          <Text as="span" size={800} weight="semibold">
            Context becomes a clear next action.
          </Text>
          <div className="how-grid">
            {[
              "Your information",
              "SAGE understands your context",
              "Recommends your next action",
              "You complete or reschedule",
              "SAGE adapts",
            ].map((item, index) => (
              <div className="how-step" key={item}>
                <span>{index + 1}</span>
                <Text weight="semibold">{item}</Text>
                {index < 4 && <ArrowRight20Regular />}
              </div>
            ))}
          </div>
        </section>
        <section className="feature-section">
          <div>
            <Text className="eyebrow">BUILT AROUND YOUR REAL WORK</Text>
            <Text as="span" size={800} weight="semibold">
              Less sorting. More steady progress.
            </Text>
          </div>
          <div className="feature-grid">
            {[
              [
                "Tasks",
                "Create, prioritize, snooze, reschedule, and complete your own work.",
                <List20Regular />,
              ],
              [
                "Focus Now",
                "Get one reasoned recommendation based on what you have entered.",
                <Timer20Regular />,
              ],
              [
                "Calendar",
                "Balance classes, exams, assignments, study sessions, and life.",
                <CalendarLtr20Regular />,
              ],
              [
                "Goals",
                "Connect daily effort to academic, technical, and personal milestones.",
                <TargetArrow20Regular />,
              ],
              [
                "Contests",
                "See legitimate listings from the coding platforms you select.",
                <Code20Regular />,
              ],
            ].map(([title, copy, icon]) => (
              <Card className="feature-card" key={String(title)}>
                <div className="goal-icon">{icon}</div>
                <Text as="span" size={500} weight="semibold">
                  {title}
                </Text>
                <Text>{copy}</Text>
              </Card>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <Text as="span" size={800} weight="semibold">
            Ready to make your next move clear?
          </Text>
          <Button
            size="large"
            appearance="primary"
            onClick={() => start("email")}
          >
            Get started
          </Button>
        </section>
      </main>
      <footer className="public-footer">
        <Text size={200}>© 2026 SAGE</Text>
        <div>
          <Button
            appearance="subtle"
            onClick={() => {
              window.location.href = "/privacy.html"
            }}
          >
            Privacy
          </Button>
          <Button
            appearance="subtle"
            onClick={() => {
              window.location.href = "/terms.html"
            }}
          >
            Terms
          </Button>
        </div>
      </footer>
    </div>
  )
}

function Auth({
  mode,
  back,
  success,
}: {
  mode: "google" | "email"
  back: () => void
  success: (user: AuthUser) => void
}) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const { user: googleUser } = useAuth()
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Brand />
      </div>
      <Card className="auth-card">
        <Button
          appearance="subtle"
          icon={<ArrowLeft20Regular />}
          onClick={back}
        >
          Back
        </Button>
        {googleUser ? (
          <div className="auth-state">
            <Avatar
              name={googleUser.name || googleUser.email}
              image={
                googleUser.picture ? { src: googleUser.picture } : undefined
              }
              size={64}
            />
            <Text as="span" size={600} weight="semibold">
              You’re signed in.
            </Text>
            <Text>{googleUser.name || googleUser.email}</Text>
            <Text>We’ll help you set up your workspace next.</Text>
            <Button appearance="primary" onClick={() => success(googleUser)}>
              Continue
            </Button>
          </div>
        ) : mode === "google" ? (
          <div className="auth-state">
            <div className="google-auth-mark">
              <span className="google-mark">G</span>
            </div>
            <Text as="span" size={700} weight="semibold">
              Continue with Google
            </Text>
            <Text>Use your Google account to securely sign in to SAGE.</Text>
            <GoogleAuthButton onSuccess={success} />
            <Text size={200}>Google will ask you to choose an account.</Text>
          </div>
        ) : (
          <div className="auth-form">
            <Text className="eyebrow">WELCOME TO SAGE</Text>
            <Text as="span" size={700} weight="semibold">
              {sent ? "Check your email" : "Continue with email"}
            </Text>
            {sent ? (
              <>
                <Text>We sent a secure sign-in link to {email}.</Text>
                <Button
                  appearance="primary"
                  onClick={() =>
                    success({
                      authenticated: true,
                      email,
                      name: email.split("@")[0],
                      sub: email,
                    })
                  }
                >
                  Open SAGE
                </Button>
                <Button appearance="subtle" onClick={() => setSent(false)}>
                  Use a different email
                </Button>
              </>
            ) : (
              <>
                <Text>
                  Enter your school or personal email to sign in or create an
                  account.
                </Text>
                <Label>
                  Email address
                  <Input
                    type="email"
                    value={email}
                    onChange={(_, d) => setEmail(d.value)}
                    placeholder="you@example.com"
                  />
                </Label>
                <Button
                  appearance="primary"
                  disabled={!email.includes("@")}
                  onClick={() => setSent(true)}
                >
                  Continue
                </Button>
                <Divider>or</Divider>
                <GoogleAuthButton onSuccess={success} />
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function getLocalDateString(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getOffsetDateString(daysOffset: number, refDate = new Date()): string {
  const d = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate() + daysOffset,
  )
  return getLocalDateString(d)
}

function getDaysDifference(
  targetDateStr: string,
  fromDate = new Date(),
): number {
  if (!targetDateStr) return 999
  const parts = targetDateStr.split("-").map(Number)
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2]))
    return 999
  const target = new Date(parts[0], parts[1] - 1, parts[2])
  const from = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  )
  const diffMs = target.getTime() - from.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split("-").map(Number)
  if (parts.length < 3 || isNaN(parts[0])) return dateStr
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function formatRelativeDateBadge(dateStr: string): string {
  if (!dateStr) return ""
  const diff = getDaysDifference(dateStr)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  if (diff > 1 && diff <= 6)
    return `In ${diff} days (${formatShortDate(dateStr)})`
  return formatShortDate(dateStr)
}

function getCurrentWeekMonday(refDate = new Date()): Date {
  const d = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate(),
  )
  const day = d.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // If today is Sunday (0), upcoming academic week begins tomorrow (Monday, +1 day)
  const diffToMonday = day === 0 ? 1 : 1 - day
  d.setDate(d.getDate() + diffToMonday)
  return d
}

function getDayDateForCurrentWeek(
  dayOfWeek: number,
  refDate = new Date(),
): string {
  const monday = getCurrentWeekMonday(refDate)
  const target = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + (dayOfWeek - 1),
  )
  return getLocalDateString(target)
}

function getDayOfWeekFromDate(dateStr: string): number {
  if (!dateStr) return 1
  const parts = dateStr.split("-").map(Number)
  if (parts.length < 3 || isNaN(parts[0])) return 1
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  const day = d.getDay()
  return day === 0 ? 7 : day
}

function syncEventsToCurrentWeek(
  items: EventItem[],
  refDate = new Date(),
): EventItem[] {
  let changed = false
  const updated = items.map((item) => {
    if (item.type === "Class" || item.isRecurring) {
      const dayOfWeek = item.dayOfWeek || getDayOfWeekFromDate(item.date)
      if (dayOfWeek >= 1 && dayOfWeek <= 7) {
        const currentWeekDate = getDayDateForCurrentWeek(dayOfWeek, refDate)
        if (item.date !== currentWeekDate) {
          changed = true
          return {
            ...item,
            date: currentWeekDate,
            dayOfWeek,
            isRecurring: true,
          }
        }
      }
    }
    return item
  })
  return changed ? updated : items
}

async function parseUploadedExamFile(file: File): Promise<EventItem[]> {
  if (!file) return []

  const isImageOrPdf =
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    /\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name)

  if (isImageOrPdf) {
    try {
      const dataUrl = await fileToDataUrl(file)
      const prompt =
        "Please inspect this uploaded exam schedule, test announcement, or notification image/document. Extract all upcoming exams, midterms, finals, tests, or quizzes into the structured ```sage-action``` tasks format with: title (course code and exam name), dueDate (YYYY-MM-DD), dueTime (HH:mm), priority='HIGH', and category='Exam'."

      const res = await askSage({
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

      const match = res.message.match(/```sage-action\s*([\s\S]*?)\s*```/i)
      if (match) {
        const parsed = JSON.parse(match[1])
        const tasks = parsed.tasks || parsed.items || []
        if (Array.isArray(tasks) && tasks.length > 0) {
          return tasks.map((t: any, idx: number) => ({
            id: Date.now() + idx,
            title: t.title || "Exam",
            type: "Exam" as const,
            date: t.dueDate || new Date().toISOString().slice(0, 10),
            time: t.dueTime || "09:30",
            endTime: "",
            isRecurring: false,
            originalFileName: file.name,
          }))
        }
      }
    } catch (e) {
      console.warn("AI exam image parsing error:", e)
    }
  }

  try {
    const text = await file.text()
    if (text && text.length > 10) {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      const extracted: EventItem[] = []
      const dateRegex = /\b(\d{4}-\d{2}-\d{2})\b/
      const timeRegex = /\b(\d{1,2}:\d{2})\b/

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/midterm|final|exam|test|viva|quiz|assessment/i.test(line)) {
          const dateMatch = line.match(dateRegex)
          const timeMatch = line.match(timeRegex)
          const title = line
            .replace(dateRegex, "")
            .replace(timeRegex, "")
            .replace(/[-,;:|]/g, " ")
            .trim()
          if (title) {
            extracted.push({
              id: Date.now() + extracted.length,
              title,
              type: "Exam",
              date: dateMatch ? dateMatch[1] : getOffsetDateString(7),
              time: timeMatch ? timeMatch[1] : "09:30",
              endTime: "",
              isRecurring: false,
              originalFileName: file.name,
            })
          }
        }
      }
      if (extracted.length > 0) return extracted
    }
  } catch {}
  return []
}

function EditItemDialog({
  open,
  item,
  close,
  save,
}: {
  open: boolean
  item: {
    id: number
    title: string
    type: string
    date: string
    time: string
    endTime?: string
  } | null
  close: () => void
  save: (id: number, patch: SchedulePatch) => void
}) {
  const [title, setTitle] = useState(item?.title || "")
  const [date, setDate] = useState(item?.date || "")
  const [time, setTime] = useState(item?.time || "")
  const [endTime, setEndTime] = useState(item?.endTime || "")

  useEffect(() => {
    if (item) {
      setTitle(item.title)
      setDate(item.date)
      setTime(item.time)
      setEndTime(item.endTime || "")
    }
  }, [item])

  return (
    <Dialog open={open}>
      <DialogSurface className="form-dialog">
        <DialogBody>
          <DialogTitle>Edit Schedule Item</DialogTitle>
          <DialogContent>
            <div className="form-grid">
              <Label className="full-field">
                Title
                <Input value={title} onChange={(_, d) => setTitle(d.value)} />
              </Label>
              <Label>
                Date
                <Input
                  type="date"
                  value={date}
                  onChange={(_, d) => setDate(d.value)}
                />
              </Label>
              <Label>
                Start Time
                <Input
                  type="time"
                  value={time}
                  onChange={(_, d) => setTime(d.value)}
                />
              </Label>
              <Label>
                End Time
                <Input
                  type="time"
                  value={endTime}
                  onChange={(_, d) => setEndTime(d.value)}
                />
              </Label>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!title}
              onClick={() => {
                if (item) {
                  save(item.id, { title, date, time, endTime })
                }
                close()
              }}
            >
              Save Changes
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function UploadReview({
  label,
  uploaded,
  previewUrl,
  statusMessage,
  isExtracting = false,
  isError = false,
  onFileSelect,
}: {
  label: string
  uploaded: string
  previewUrl?: string
  statusMessage?: string
  isExtracting?: boolean
  isError?: boolean
  onFileSelect: (file: File) => void
}) {
  return (
    <div className="upload-zone-wrapper">
      <div className="upload-zone">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Uploaded preview"
            className="upload-thumb"
          />
        ) : (
          <CalendarLtr20Regular />
        )}
        <div className="upload-details">
          <Text as="span" weight="semibold">
            {uploaded || label}
          </Text>
          <Text size={200}>
            {uploaded
              ? isExtracting
                ? "Analyzing document with SAGE Multimodal AI (Google Gemini)..."
                : "Extracted and mapped to current date/time. Review and edit any items below."
              : "Upload an image (PNG, JPG) or PDF of your timetable or schedule."}
          </Text>
          {isExtracting && (
            <div style={{ marginTop: "6px" }}>
              <ProgressBar />
            </div>
          )}
          {statusMessage && (
            <div
              className="upload-status-sync"
              style={{
                color: isError ? "var(--colorPaletteRedForeground1)" : undefined,
              }}
            >
              {isError ? (
                <Alert20Regular style={{ color: "var(--colorPaletteRedForeground1)" }} />
              ) : isExtracting ? (
                <Sparkle20Filled />
              ) : (
                <CheckmarkCircle20Filled />
              )}
              <Text size={200} weight="semibold">
                {statusMessage}
              </Text>
            </div>
          )}
        </div>
        <Input
          className="file-input"
          type={"file" as never}
          accept="image/*,.pdf"
          disabled={isExtracting}
          aria-label={label}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              onFileSelect(file)
            }
          }}
        />
      </div>
      {uploaded && (
        <div className="upload-sync-badge">
          <Sparkle20Filled />
          <Text size={100}>
            SAGE keeps all recurring classes synced to the active calendar week.
          </Text>
        </div>
      )}
    </div>
  )
}

function EditableItems({
  items,
  remove,
  update,
  empty,
}: {
  items: Array<{
    id: number
    title: string
    type: string
    date: string
    time: string
    endTime?: string
    isRecurring?: boolean
  }>
  remove: (id: number) => void
  update?: (id: number, patch: SchedulePatch) => void
  empty: string
}) {
  const [editingItem, setEditingItem] = useState<{
    id: number
    title: string
    type: string
    date: string
    time: string
    endTime?: string
  } | null>(null)

  if (!items.length) {
    return (
      <div className="inline-empty">
        <Text>{empty}</Text>
      </div>
    )
  }

  return (
    <>
      <div className="review-list">
        {items.map((item) => {
          const relativeDate = formatRelativeDateBadge(item.date)
          const timeText = item.time
            ? `${item.time}${item.endTime ? ` – ${item.endTime}` : ""}`
            : ""
          return (
            <div key={item.id}>
              <div>
                <Text weight="semibold">{item.title}</Text>
                <Text size={200}>
                  <Badge
                    appearance="tint"
                    color={
                      item.type === "Exam"
                        ? "danger"
                        : item.type === "Class"
                          ? "brand"
                          : "informative"
                    }
                  >
                    {item.type}
                  </Badge>
                  {relativeDate ? ` · ${relativeDate}` : ""}
                  {timeText ? ` · ${timeText}` : ""}
                  {item.isRecurring ? " · Repeats weekly" : ""}
                </Text>
              </div>
              {update && (
                <Button
                  appearance="subtle"
                  icon={<Edit20Regular />}
                  aria-label={`Edit ${item.title}`}
                  onClick={() => setEditingItem(item)}
                />
              )}
              <Button
                appearance="subtle"
                icon={<Delete20Regular />}
                onClick={() => remove(item.id)}
                aria-label={`Delete ${item.title}`}
              />
            </div>
          )
        })}
      </div>
      {editingItem && update && (
        <EditItemDialog
          open={Boolean(editingItem)}
          item={editingItem}
          close={() => setEditingItem(null)}
          save={update}
        />
      )}
    </>
  )
}

function TimetableReviewList({
  items,
  remove,
  empty,
}: {
  items: TimetableEntry[]
  remove: (id: string) => void
  empty: string
}) {
  if (!items.length) {
    return (
      <div className="inline-empty">
        <Text>{empty}</Text>
      </div>
    )
  }

  return (
    <div className="review-list">
      {items.map((item) => (
        <div
          key={item.id}
          style={{ display: "flex", alignItems: "center", gap: "12px" }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <Text weight="semibold">{item.courseName}</Text>
              <span className="course-code-pill">{item.courseCode}</span>
              {!item.isKnownCourse && (
                <span className="unavailable-note">
                  Course name unavailable
                </span>
              )}
            </div>
            <Text
              size={200}
              style={{ color: "var(--colorNeutralForeground3)" }}
            >
              {item.dayName} · {formatTimeRange(item.startTime, item.endTime)}
              {` · ${
                item.startPeriod === item.endPeriod
                  ? `Period ${item.startPeriod}`
                  : `Periods ${item.startPeriod}–${item.endPeriod}`
              }`}
              {item.location ? ` · ${item.location}` : ""}
            </Text>
          </div>
          <Button
            appearance="subtle"
            icon={<Delete20Regular />}
            onClick={() => remove(item.id)}
            aria-label={`Remove ${item.courseName}`}
          />
        </div>
      ))}
    </div>
  )
}

function Onboarding({
  initialEmail,
  initialName,
  initialTimetable,
  initialPreferences,
  initialNotifications,
  initialPlatforms,
  finish,
}: {
  initialEmail: string
  initialName: string
  initialTimetable?: TimetableEntry[]
  initialPreferences?: UserPreferences
  initialNotifications?: NotificationPreferences
  initialPlatforms?: string[]
  finish: (data: {
    profile: Profile
    events: EventItem[]
    goals: Goal[]
    platforms: string[]
    reminders: Reminder[]
    timetable: TimetableEntry[]
    preferences: UserPreferences
    notifications: NotificationPreferences
  }) => void
}) {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<Profile>({
    name: initialName,
    email: initialEmail,
    college: "",
    course: "",
    year: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  const [timetable, setTimetable] = useState<TimetableEntry[]>(() =>
    initialTimetable && initialTimetable.length > 0 ? initialTimetable : [],
  )
  const [events, setEvents] = useState<EventItem[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [platforms, setPlatforms] = useState<string[]>(
    () => initialPlatforms || [],
  )
  const [examDraft, setExamDraft] = useState({ title: "", date: "", time: "" })
  const [goalTitle, setGoalTitle] = useState("")

  const [timetableFile, setTimetableFile] = useState("")
  const [timetablePreview, setTimetablePreview] = useState("")
  const [timetableStatus, setTimetableStatus] = useState("")
  const [isTimetableExtracting, setIsTimetableExtracting] = useState(false)
  const [isTimetableError, setIsTimetableError] = useState(false)

  const [manualDay, setManualDay] = useState(1)
  const [manualCourseCode, setManualCourseCode] = useState("")
  const [manualCourseName, setManualCourseName] = useState("")
  const [manualStartPeriod, setManualStartPeriod] = useState(1)
  const [manualEndPeriod, setManualEndPeriod] = useState(2)
  const [manualLocation, setManualLocation] = useState("")
  const [manualError, setManualError] = useState("")

  const handleAddManualClass = () => {
    if (!manualCourseCode.trim()) {
      setManualError("Please enter a course code or name.")
      return
    }
    const entry = createManualTimetableEntry({
      dayOfWeek: manualDay,
      courseCode: manualCourseCode.trim(),
      startPeriod: manualStartPeriod,
      endPeriod: manualEndPeriod,
      location: manualLocation.trim() || undefined,
      customCourseName: manualCourseName.trim() || undefined,
    })
    if (entry) {
      setTimetable((prev) => [...prev, entry])
      setManualCourseCode("")
      setManualCourseName("")
      setManualLocation("")
      setManualError("")
    } else {
      setManualError("Invalid period range. Periods must be between 1 and 11.")
    }
  }

  const handleLoadSampleTemplate = () => {
    const template = getSampleTimetableTemplate()
    setTimetable(template)
    setIsTimetableError(false)
    setTimetableStatus(
      `✓ Loaded sample curriculum template (${template.length} class blocks). Review or edit before proceeding.`,
    )
  }

  const [examFile, setExamFile] = useState("")
  const [examPreview, setExamPreview] = useState("")
  const [examStatus, setExamStatus] = useState("")
  const [isExamExtracting, setIsExamExtracting] = useState(false)
  const [isExamError, setIsExamError] = useState(false)

  const [preferences, setPreferences] = useState<UserPreferences>(
    () => initialPreferences || DEFAULT_USER_PREFERENCES,
  )
  const [notices, setNotices] = useState<NotificationPreferences>(
    () => initialNotifications || DEFAULT_NOTIFICATION_PREFERENCES,
  )
  const titles = [
    "About You",
    "Your Schedule",
    "Exams",
    "Work Preferences",
    "Goals",
    "Coding Platforms",
    "Notifications",
  ]

  const addExam = (draft: ExamDraft) => {
    if (!draft.title) return
    const targetDate = draft.date || getOffsetDateString(7)
    setEvents((list) => [
      ...list,
      {
        id: Date.now(),
        title: draft.title,
        type: "Exam",
        date: targetDate,
        time: draft.time || "09:30",
        endTime: "",
        isRecurring: false,
      },
    ])
  }

  const updateEvent = (id: number, patch: SchedulePatch) => {
    const dayOfWeek = getDayOfWeekFromDate(patch.date)
    setEvents((list) =>
      list.map((item) =>
        item.id === id ? { ...item, ...patch, dayOfWeek } : item,
      ),
    )
  }

  const handleTimetableUpload = async (file: File) => {
    setTimetableFile(file.name)
    if (file.type.startsWith("image/")) {
      setTimetablePreview(URL.createObjectURL(file))
    }
    setIsTimetableExtracting(true)
    setIsTimetableError(false)
    setTimetableStatus("")
    try {
      const extracted = await parseUploadedTimetableFile(file)
      if (extracted.length > 0) {
        setTimetable(extracted)
        setIsTimetableError(false)
        setTimetableStatus(
          `✓ ${extracted.length} class blocks merged · College periods (8:10 AM – 5:20 PM) · Resolved via Course Catalog`,
        )
      } else {
        setIsTimetableError(true)
        setTimetableStatus(
          "Could not detect timetable data from this image or file. Please load the sample template or enter classes manually below.",
        )
      }
    } catch (err) {
      console.warn("Timetable upload extraction error:", err)
      setIsTimetableError(true)
      setTimetableStatus(
        "An error occurred while analyzing the timetable. Please load the sample template or enter classes manually below.",
      )
    } finally {
      setIsTimetableExtracting(false)
    }
  }

  const handleExamUpload = async (file: File) => {
    setExamFile(file.name)
    if (file.type.startsWith("image/")) {
      setExamPreview(URL.createObjectURL(file))
    }
    setIsExamExtracting(true)
    setIsExamError(false)
    setExamStatus("")
    try {
      const extracted = await parseUploadedExamFile(file)
      if (extracted.length > 0) {
        setEvents((current) => [
          ...current.filter((e) => e.type !== "Exam"),
          ...extracted,
        ])
        setIsExamError(false)
        setExamStatus(`✓ ${extracted.length} exams extracted from document.`)
      } else {
        setIsExamError(true)
        setExamStatus(
          "Could not detect exam deadlines from this document. Please enter your exams manually below.",
        )
      }
    } catch (err) {
      console.warn("Exam upload extraction error:", err)
      setIsExamError(true)
      setExamStatus("Failed to extract exams. Please enter your exams manually below.")
    } finally {
      setIsExamExtracting(false)
    }
  }

  const complete = () =>
    finish({
      profile,
      events: syncEventsToCurrentWeek(events),
      goals,
      platforms,
      reminders: [],
      timetable,
      preferences,
      notifications: notices,
    })

  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <Brand />
        <Text>Step {step} of 7</Text>
      </header>
      <div className="onboarding-progress">
        <ProgressBar value={step / 7} />
        <div>
          {titles.map((title, index) => (
            <span className={step >= index + 1 ? "active" : ""} key={title}>
              {index + 1}
              <b>{title}</b>
            </span>
          ))}
        </div>
      </div>
      <main className="onboarding-main">
        <Card className="onboarding-card">
          <div>
            <Text className="eyebrow">
              STEP {step} OF 7 · CALIBRATION WIZARD
            </Text>
            <Text as="span" size={700} weight="semibold">
              {titles[step - 1]}
            </Text>
            <Text>
              {
                [
                  "Tell SAGE enough to personalize your workspace.",
                  "Upload your timetable. SAGE resolves course codes and merges consecutive periods automatically (Informational only · No reminder spam).",
                  "Add exams so SAGE can help you prepare ahead of time. Unlike weekly timetable classes, exams are deadlines and can generate reminders.",
                  "Choose a rhythm that works with your energy and time.",
                  "Create goals that your daily work can move forward.",
                  "Choose the platforms you follow. No account details are needed.",
                  "Choose useful nudges and protect your quiet time.",
                ][step - 1]
              }
            </Text>
          </div>
          {step === 1 && (
            <div className="form-grid">
              <Label>
                Name
                <Input
                  value={profile.name}
                  onChange={(_, d) => setProfile({ ...profile, name: d.value })}
                />
              </Label>
              <Label>
                College
                <Input
                  value={profile.college}
                  onChange={(_, d) =>
                    setProfile({ ...profile, college: d.value })
                  }
                />
              </Label>
              <Label>
                Course
                <Input
                  value={profile.course}
                  onChange={(_, d) =>
                    setProfile({ ...profile, course: d.value })
                  }
                />
              </Label>
              <Label>
                Year
                <Dropdown
                  value={profile.year}
                  onOptionSelect={(_, d) =>
                    setProfile({ ...profile, year: String(d.optionValue) })
                  }
                  placeholder="Select year"
                >
                  {[
                    "First year",
                    "Second year",
                    "Third year",
                    "Fourth year",
                    "Postgraduate",
                  ].map((x) => (
                    <Option key={x}>{x}</Option>
                  ))}
                </Dropdown>
              </Label>
              <Label>
                Timezone
                <Input
                  value={profile.timezone}
                  onChange={(_, d) =>
                    setProfile({ ...profile, timezone: d.value })
                  }
                />
              </Label>
            </div>
          )}
          {step === 2 && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: "var(--colorBrandBackground2)",
                  borderRadius: "var(--borderRadiusMedium)",
                  color: "var(--colorBrandForeground1)",
                }}
              >
                <Book20Regular />
                <Text size={200} weight="semibold">
                  Timetable is background academic context for Calendar. It will
                  never create notification spam or reminders.
                </Text>
              </div>
              <UploadReview
                label="Upload timetable image or schedule"
                uploaded={timetableFile}
                previewUrl={timetablePreview}
                statusMessage={timetableStatus}
                isExtracting={isTimetableExtracting}
                isError={isTimetableError}
                onFileSelect={handleTimetableUpload}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginTop: "8px",
                  marginBottom: "8px",
                }}
              >
                <Text
                  size={200}
                  style={{ color: "var(--colorNeutralForeground3)" }}
                >
                  Want to see how SAGE organizes college periods?
                </Text>
                <Button
                  appearance="subtle"
                  size="small"
                  onClick={handleLoadSampleTemplate}
                >
                  Load Sample Curriculum Template
                </Button>
              </div>
              <div
                style={{
                  background: "var(--colorNeutralBackground2)",
                  padding: "12px",
                  borderRadius: "var(--borderRadiusMedium)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <Text weight="semibold" size={200}>
                  Or Add Class Manually:
                </Text>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "8px",
                  }}
                >
                  <Label size="small">
                    Day
                    <Dropdown
                      value={
                        [
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ][manualDay - 1]
                      }
                      onOptionSelect={(_, d) =>
                        setManualDay(Number(d.optionValue))
                      }
                    >
                      <Option value="1">Monday</Option>
                      <Option value="2">Tuesday</Option>
                      <Option value="3">Wednesday</Option>
                      <Option value="4">Thursday</Option>
                      <Option value="5">Friday</Option>
                      <Option value="6">Saturday</Option>
                    </Dropdown>
                  </Label>
                  <Label size="small">
                    Course Code
                    <Input
                      placeholder="e.g. 23CS3105"
                      value={manualCourseCode}
                      onChange={(_, d) => setManualCourseCode(d.value)}
                    />
                  </Label>
                  <Label size="small">
                    Course Name
                    <Input
                      placeholder="e.g. Data Systems"
                      value={manualCourseName}
                      onChange={(_, d) => setManualCourseName(d.value)}
                    />
                  </Label>
                  <Label size="small">
                    Periods
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        alignItems: "center",
                      }}
                    >
                      <Input
                        type="number"
                        min={1}
                        max={11}
                        value={String(manualStartPeriod)}
                        onChange={(_, d) =>
                          setManualStartPeriod(Number(d.value))
                        }
                        style={{ width: "60px" }}
                      />
                      <span>to</span>
                      <Input
                        type="number"
                        min={1}
                        max={11}
                        value={String(manualEndPeriod)}
                        onChange={(_, d) => setManualEndPeriod(Number(d.value))}
                        style={{ width: "60px" }}
                      />
                    </div>
                  </Label>
                  <Label size="small">
                    Room
                    <Input
                      placeholder="e.g. C-421"
                      value={manualLocation}
                      onChange={(_, d) => setManualLocation(d.value)}
                    />
                  </Label>
                </div>
                {manualError && (
                  <Text
                    size={200}
                    style={{ color: "var(--colorPaletteRedForeground1)" }}
                  >
                    {manualError}
                  </Text>
                )}
                <div>
                  <Button
                    appearance="secondary"
                    size="small"
                    onClick={handleAddManualClass}
                  >
                    Add Class Block
                  </Button>
                </div>
              </div>
              <TimetableReviewList
                items={timetable}
                remove={(id) =>
                  setTimetable(timetable.filter((t) => t.id !== id))
                }
                empty="No timetable loaded yet. You can upload an image, enter classes above, load a sample template, or click Next to skip."
              />
            </>
          )}
          {step === 3 && (
            <>
              <div className="entry-grid">
                <Label>
                  Exam
                  <Input
                    value={examDraft.title}
                    onChange={(_, d) =>
                      setExamDraft({ ...examDraft, title: d.value })
                    }
                  />
                </Label>
                <Label>
                  Date
                  <Input
                    type="date"
                    value={examDraft.date}
                    onChange={(_, d) =>
                      setExamDraft({ ...examDraft, date: d.value })
                    }
                  />
                </Label>
                <Label>
                  Time
                  <Input
                    type="time"
                    value={examDraft.time}
                    onChange={(_, d) =>
                      setExamDraft({ ...examDraft, time: d.value })
                    }
                  />
                </Label>
                <Button
                  appearance="secondary"
                  icon={<Add20Regular />}
                  onClick={() => {
                    addExam(examDraft)
                    setExamDraft({ title: "", date: "", time: "" })
                  }}
                >
                  Add exam
                </Button>
              </div>
              <UploadReview
                label="Upload exam schedule"
                uploaded={examFile}
                previewUrl={examPreview}
                statusMessage={examStatus}
                isExtracting={isExamExtracting}
                isError={isExamError}
                onFileSelect={handleExamUpload}
              />
              <EditableItems
                items={events.filter((e) => e.type === "Exam")}
                remove={(id) => setEvents(events.filter((e) => e.id !== id))}
                update={updateEvent}
                empty="No exams added yet."
              />
            </>
          )}
          {step === 4 && (
            <div className="form-grid">
              <Label>
                Preferred study period
                <Dropdown
                  value={preferences.period}
                  onOptionSelect={(_, d) =>
                    setPreferences({
                      ...preferences,
                      period: String(d.optionValue),
                    })
                  }
                >
                  {["Morning", "Afternoon", "Evening"].map((x) => (
                    <Option key={x}>{x}</Option>
                  ))}
                </Dropdown>
              </Label>
              <Label>
                Session duration
                <Input
                  type="number"
                  contentAfter="minutes"
                  value={preferences.duration}
                  onChange={(_, d) =>
                    setPreferences({ ...preferences, duration: d.value })
                  }
                />
              </Label>
              <Label>
                Daily focus target
                <Input
                  type="number"
                  contentAfter="hours"
                  value={preferences.target}
                  onChange={(_, d) =>
                    setPreferences({ ...preferences, target: d.value })
                  }
                />
              </Label>
              <div className="choice-card">
                <Text weight="semibold">Working preference</Text>
                <Checkbox
                  checked={preferences.includeBreaks !== false}
                  onChange={(_, d) =>
                    setPreferences({
                      ...preferences,
                      includeBreaks: d.checked === true,
                    })
                  }
                  label="Include short breaks between sessions"
                />
                <Checkbox
                  checked={preferences.avoidPersonalCommitments === true}
                  onChange={(_, d) =>
                    setPreferences({
                      ...preferences,
                      avoidPersonalCommitments: d.checked === true,
                    })
                  }
                  label="Avoid scheduling over personal commitments"
                />
              </div>
            </div>
          )}
          {step === 5 && (
            <>
              <div className="entry-grid">
                <Label>
                  Goal title
                  <Input
                    value={goalTitle}
                    onChange={(_, d) => setGoalTitle(d.value)}
                    placeholder="e.g. Prepare for calculus final"
                  />
                </Label>
                <Dropdown defaultValue="Academic">
                  <Option>Academic</Option>
                  <Option>Technical</Option>
                  <Option>Personal learning</Option>
                </Dropdown>
                <Button
                  appearance="secondary"
                  icon={<Add20Regular />}
                  onClick={() => {
                    if (goalTitle)
                      setGoals([
                        ...goals,
                        { ...emptyGoal, id: Date.now(), title: goalTitle },
                      ])
                    setGoalTitle("")
                  }}
                >
                  Add goal
                </Button>
              </div>
              <EditableItems
                items={goals.map((g) => ({
                  ...g,
                  type: g.category,
                  date: g.targetDate,
                  time: "",
                  endTime: "",
                }))}
                remove={(id) => setGoals(goals.filter((g) => g.id !== id))}
                empty="No goals yet. You can create them now or later."
              />
            </>
          )}
          {step === 6 && (
            <div className="platform-grid">
              {platformOptions.map((platform) => (
                <label
                  className={`platform-choice ${
                    platforms.includes(platform) ? "selected" : ""
                  }`}
                  key={platform}
                >
                  <Checkbox
                    checked={platforms.includes(platform)}
                    onChange={() =>
                      setPlatforms((list) =>
                        list.includes(platform)
                          ? list.filter((x) => x !== platform)
                          : [...list, platform],
                      )
                    }
                  />
                  <Code20Regular />
                  <Text weight="semibold">{platform}</Text>
                </label>
              ))}
            </div>
          )}
          {step === 7 && (
            <div className="settings-list">
              {[
                [
                  "Email notifications",
                  "Helpful summaries and selected reminders",
                  "email",
                ],
                ["In-app notifications", "Updates while you use SAGE", "inApp"],
                [
                  "Task reminders",
                  "Nudges based on your task due times",
                  "tasks",
                ],
                [
                  "Contest reminders",
                  "Alerts for contests from selected platforms",
                  "contests",
                ],
              ].map(([title, copy, key]) => (
                <div className="setting-row" key={key}>
                  <div>
                    <Text weight="semibold">{title}</Text>
                    <Text size={200}>{copy}</Text>
                  </div>
                  <Switch
                    checked={Boolean(
                      notices[(key as keyof NotificationPreferences)],
                    )}
                    onChange={(_, d) =>
                      setNotices({ ...notices, [key]: d.checked })
                    }
                  />
                </div>
              ))}
              <Label>
                Quiet hours
                <Input
                  value={notices.quietHours}
                  onChange={(_, d) =>
                    setNotices({ ...notices, quietHours: d.value })
                  }
                />
              </Label>
            </div>
          )}
          <div className="onboarding-actions">
            <Button
              appearance="secondary"
              disabled={step === 1}
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
            {step < 7 ? (
              <Button appearance="primary" onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button
                appearance="primary"
                icon={<CheckmarkCircle20Filled />}
                onClick={complete}
              >
                Finish setup
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <Text className="eyebrow">{eyebrow}</Text>}
        <Text as="span" size={500} weight="semibold">
          {title}
        </Text>
      </div>
      {action}
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <Text className="eyebrow">{eyebrow}</Text>
        <Text as="span" size={800} weight="semibold">
          {title}
        </Text>
        <Text size={400}>{subtitle}</Text>
      </div>
      {action}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  copy,
  action,
}: {
  icon: React.ReactNode
  title: string
  copy: string
  action?: React.ReactNode
}) {
  return (
    <div className="empty-state compact-empty">
      <div className="empty-icon">{icon}</div>
      <Text as="span" size={500} weight="semibold">
        {title}
      </Text>
      <Text>{copy}</Text>
      {action}
    </div>
  )
}

function TaskDialog({
  open,
  task,
  goals,
  close,
  save,
}: {
  open: boolean
  task: Task | null
  goals: Goal[]
  close: () => void
  save: (task: Omit<Task, "id">) => void
}) {
  const [draft, setDraft] = useState<Omit<Task, "id">>(
    task ? { ...task } : emptyTask,
  )
  const field = (key: keyof typeof draft, value: string) =>
    setDraft({ ...draft, [key]: value })
  return (
    <Dialog open={open}>
      <DialogSurface className="form-dialog">
        <DialogBody>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogContent>
            <div className="form-grid">
              <Label className="full-field">
                Task title
                <Input
                  value={draft.title}
                  onChange={(_, d) => field("title", d.value)}
                />
              </Label>
              <Label className="full-field">
                Description
                <Textarea
                  value={draft.description}
                  onChange={(_, d) => field("description", d.value)}
                />
              </Label>
              <Label>
                Category / course
                <Input
                  value={draft.course}
                  onChange={(_, d) => field("course", d.value)}
                />
              </Label>
              <Label>
                Priority
                <Dropdown
                  value={draft.priority}
                  onOptionSelect={(_, d) =>
                    field("priority", String(d.optionValue))
                  }
                >
                  {["Low", "Medium", "High"].map((x) => (
                    <Option key={x}>{x}</Option>
                  ))}
                </Dropdown>
              </Label>
              <Label>
                Due date
                <Input
                  type="date"
                  value={draft.dueDate}
                  onChange={(_, d) => field("dueDate", d.value)}
                />
              </Label>
              <Label>
                Due time
                <Input
                  type="time"
                  value={draft.dueTime}
                  onChange={(_, d) => field("dueTime", d.value)}
                />
              </Label>
              <div className="quick-preset-chips">
                <span className="quick-chip-label">Quick set:</span>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    const d = new Date()
                    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                    setDraft({ ...draft, dueDate: ymd, dueTime: "23:59" })
                  }}
                >
                  Today (11:59 PM)
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + 1)
                    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                    setDraft({ ...draft, dueDate: ymd, dueTime: "17:00" })
                  }}
                >
                  Tomorrow (5:00 PM)
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    const d = new Date()
                    const todayDay = d.getDay()
                    const daysUntilFri = (5 - todayDay + 7) % 7 || 7
                    d.setDate(d.getDate() + daysUntilFri)
                    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                    setDraft({ ...draft, dueDate: ymd, dueTime: "17:00" })
                  }}
                >
                  Friday (5:00 PM)
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    const d = new Date()
                    const todayDay = d.getDay()
                    const daysUntilMon = (8 - todayDay) % 7 || 7
                    d.setDate(d.getDate() + daysUntilMon)
                    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                    setDraft({ ...draft, dueDate: ymd, dueTime: "09:00" })
                  }}
                >
                  Next Mon (9:00 AM)
                </button>
                {draft.dueDate && (
                  <button
                    type="button"
                    className="quick-chip"
                    style={{ color: "var(--colorPaletteRedForeground1)" }}
                    onClick={() => setDraft({ ...draft, dueDate: "", dueTime: "" })}
                  >
                    Clear
                  </button>
                )}
              </div>
              {draft.dueDate && (
                <div
                  className={`deadline-preview-banner ${
                    getTaskDeadlineInfo(draft.dueDate, draft.dueTime, "open").urgencyColor
                  }`}
                >
                  {getTaskDeadlineInfo(draft.dueDate, draft.dueTime, "open").isOverdue ? (
                    <Alert20Regular />
                  ) : (
                    <Clock20Regular />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="semibold" size={200}>
                      {getTaskDeadlineInfo(draft.dueDate, draft.dueTime, "open").fullDisplay}
                    </Text>
                    <Text size={100} style={{ display: "block", opacity: 0.85 }}>
                      {getTaskDeadlineInfo(draft.dueDate, draft.dueTime, "open").isOverdue
                        ? "⚠️ Notice: This deadline is in the past."
                        : `✦ SAGE tracking: Due ${
                            getTaskDeadlineInfo(draft.dueDate, draft.dueTime, "open").relativeCountdown
                          } from now`}
                    </Text>
                  </div>
                </div>
              )}
              <Label>
                Estimated duration
                <Input
                  type="number"
                  contentAfter="minutes"
                  value={draft.duration}
                  onChange={(_, d) => field("duration", d.value)}
                />
              </Label>
              <Label>
                Goal / project
                <Dropdown
                  value={draft.goal}
                  placeholder="Optional"
                  onOptionSelect={(_, d) =>
                    field("goal", String(d.optionValue))
                  }
                >
                  {goals.map((g) => (
                    <Option key={g.id}>{g.title}</Option>
                  ))}
                </Dropdown>
              </Label>
              <Label className="full-field">
                Notes
                <Textarea
                  value={draft.notes}
                  onChange={(_, d) => field("notes", d.value)}
                />
              </Label>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!draft.title}
              onClick={() => save(draft)}
            >
              {task ? "Save changes" : "Create task"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function GoalDialog({
  open,
  goal,
  close,
  save,
}: {
  open: boolean
  goal: Goal | null
  close: () => void
  save: (goal: Omit<Goal, "id">) => void
}) {
  const [draft, setDraft] = useState<Omit<Goal, "id">>(
    goal ? { ...goal } : emptyGoal,
  )
  const [milestone, setMilestone] = useState("")
  return (
    <Dialog open={open}>
      <DialogSurface className="form-dialog">
        <DialogBody>
          <DialogTitle>{goal ? "Edit goal" : "Create goal"}</DialogTitle>
          <DialogContent>
            <div className="form-grid">
              <Label className="full-field">
                Title
                <Input
                  value={draft.title}
                  onChange={(_, d) => setDraft({ ...draft, title: d.value })}
                />
              </Label>
              <Label className="full-field">
                Description
                <Textarea
                  value={draft.description}
                  onChange={(_, d) =>
                    setDraft({ ...draft, description: d.value })
                  }
                />
              </Label>
              <Label>
                Category
                <Dropdown
                  value={draft.category}
                  onOptionSelect={(_, d) =>
                    setDraft({ ...draft, category: String(d.optionValue) })
                  }
                >
                  <Option>Academic</Option>
                  <Option>Technical</Option>
                  <Option>Personal learning</Option>
                </Dropdown>
              </Label>
              <Label>
                Target date
                <Input
                  type="date"
                  value={draft.targetDate}
                  onChange={(_, d) =>
                    setDraft({ ...draft, targetDate: d.value })
                  }
                />
              </Label>
            </div>
            <Label>
              Milestones
              <div className="input-action">
                <Input
                  value={milestone}
                  onChange={(_, d) => setMilestone(d.value)}
                />
                <Button
                  icon={<Add20Regular />}
                  onClick={() => {
                    if (milestone)
                      setDraft({
                        ...draft,
                        milestones: [...draft.milestones, milestone],
                      })
                    setMilestone("")
                  }}
                >
                  Add
                </Button>
              </div>
            </Label>
            <div className="review-list">
              {draft.milestones.map((item, index) => (
                <div key={`${item}-${index}`}>
                  <Text>{item}</Text>
                  <Button
                    appearance="subtle"
                    icon={<Dismiss20Regular />}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        milestones: draft.milestones.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!draft.title}
              onClick={() => save(draft)}
            >
              Save goal
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function TaskRow({
  task,
  update,
  edit,
  focus,
}: {
  task: Task
  update: (patch: Partial<Task>) => void
  edit: () => void
  focus: () => void
}) {
  const deadline = getTaskDeadlineInfo(task.dueDate, task.dueTime, task.status)

  return (
    <div className={`task-row ${task.status === "completed" ? "is-done" : ""}`}>
      <Checkbox
        checked={task.status === "completed"}
        onChange={() =>
          update({ status: task.status === "completed" ? "open" : "completed" })
        }
        aria-label={`Complete ${task.title}`}
      />
      <div className="task-main">
        <Text weight="semibold" strikethrough={task.status === "completed"}>
          {task.title}
        </Text>
        <div className="task-meta">
          <span>{task.course || "Personal"}</span>
          <span>{task.duration} min</span>
          {task.dueDate ? (
            <span
              className={`deadline-pill ${deadline.urgencyColor}`}
              title={deadline.fullDisplay}
            >
              {deadline.isOverdue ? (
                <Alert20Regular />
              ) : (
                <Clock20Regular />
              )}
              <span>{deadline.badgeText}</span>
              {deadline.formattedTime && !deadline.isOverdue && (
                <span className="deadline-countdown-chip">
                  · {deadline.formattedTime}
                </span>
              )}
            </span>
          ) : (
            <span className="deadline-pill subtle">
              <Clock20Regular />
              <span>No deadline</span>
            </span>
          )}
        </div>
      </div>
      <Badge
        appearance="tint"
        color={task.priority === "High" ? "danger" : "brand"}
      >
        {task.priority}
      </Badge>
      {task.status === "open" && (
        <Button
          appearance="subtle"
          icon={<Play20Filled />}
          onClick={focus}
          aria-label={`Focus on ${task.title}`}
        />
      )}
      <Button
        appearance="subtle"
        icon={<Edit20Regular />}
        onClick={edit}
        aria-label={`Edit ${task.title}`}
      />
    </div>
  )
}

export type FocusRecommendation = {
  task: Task | null
  score: number
  reason: string
  isClassInProgress: boolean
  activeClass?: TimetableEntry
  freeMinutesBeforeNextClass?: number
  factors: string[]
}

function FocusSessionDialog({
  task,
  defaultDuration = 25,
  close,
  finish,
}: {
  task: Task | null
  defaultDuration?: number
  close: () => void
  finish: (session: FocusSessionRecord, completeTask: boolean) => void
}) {
  const initialDuration = task
    ? parseInt(task.duration || "25", 10) || defaultDuration || 25
    : defaultDuration || 25
  const [selectedDuration, setSelectedDuration] =
    useState<number>(initialDuration)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    initialDuration * 60,
  )
  const [timerState, setTimerState] =
    useState<"idle" | "running" | "paused" | "completed">("running")
  const [startedAt, setStartedAt] = useState<string>("")
  const [markTaskComplete, setMarkTaskComplete] = useState<boolean>(true)

  useEffect(() => {
    if (task) {
      const mins = parseInt(task.duration || "25", 10) || defaultDuration || 25
      setSelectedDuration(mins)
      setSecondsRemaining(mins * 60)
      setTimerState("running")
      setStartedAt(new Date().toISOString())
      setMarkTaskComplete(true)
    }
  }, [task, defaultDuration])

  useEffect(() => {
    let timer: number | undefined
    if (timerState === "running" && secondsRemaining > 0) {
      timer = window.setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setTimerState("completed")
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [timerState, secondsRemaining])

  if (!task) return null

  const totalSeconds = selectedDuration * 60
  const elapsedSeconds = Math.max(0, totalSeconds - secondsRemaining)
  const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60))
  const mins = Math.floor(secondsRemaining / 60)
  const secs = secondsRemaining % 60
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  const progress =
    totalSeconds > 0 ? (totalSeconds - secondsRemaining) / totalSeconds : 0

  const handleStart = () => {
    if (!startedAt) setStartedAt(new Date().toISOString())
    setTimerState("running")
  }

  const handlePause = () => {
    setTimerState("paused")
  }

  const handleResume = () => {
    setTimerState("running")
  }

  const handleReset = () => {
    setSecondsRemaining(selectedDuration * 60)
    setTimerState("idle")
  }

  const handleFinishEarly = () => {
    setTimerState("completed")
  }

  const handleSaveAndComplete = () => {
    const sessionRecord: FocusSessionRecord = {
      id: `focus-${Date.now()}`,
      taskId: task.id,
      taskTitle: task.title,
      startedAt: startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      plannedDuration: selectedDuration,
      actualDuration: elapsedMinutes,
      status: "completed",
    }
    recordFocusSessionEvent({
      taskId: task.id,
      startedAt: sessionRecord.startedAt,
      endedAt: sessionRecord.completedAt,
      durationMinutes: elapsedMinutes,
      completed: markTaskComplete,
    })
    finish(sessionRecord, markTaskComplete)
    close()
  }

  const handleCancel = () => {
    if (elapsedSeconds >= 60 && timerState !== "completed") {
      if (
        window.confirm(
          `You have focused for ${elapsedMinutes} minute${
            elapsedMinutes === 1 ? "" : "s"
          }. Record this focus session before closing?`,
        )
      ) {
        const sessionRecord: FocusSessionRecord = {
          id: `focus-${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          startedAt: startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          plannedDuration: selectedDuration,
          actualDuration: elapsedMinutes,
          status: "completed",
        }
        recordFocusSessionEvent({
          taskId: task.id,
          startedAt: sessionRecord.startedAt,
          endedAt: sessionRecord.completedAt,
          durationMinutes: elapsedMinutes,
          completed: false,
        })
        finish(sessionRecord, false)
      }
    }
    close()
  }

  const handleDurationSelect = (m: number) => {
    setSelectedDuration(m)
    setSecondsRemaining(m * 60)
  }

  return (
    <Dialog open={Boolean(task)}>
      <DialogSurface className="focus-dialog">
        <DialogBody>
          <DialogTitle>Focus session</DialogTitle>
          {timerState !== "completed" ? (
            <>
              <DialogContent>
                <div className="focus-icon">
                  <Timer20Regular />
                </div>
                <Text className="eyebrow">NOW FOCUSING ON</Text>
                <Text as="span" size={600} weight="semibold">
                  {task.title}
                </Text>
                {timerState === "idle" && (
                  <div
                    style={{ display: "flex", gap: "6px", marginTop: "4px" }}
                  >
                    {[15, 25, 45, 60].map((m) => (
                      <Button
                        key={m}
                        size="small"
                        appearance={
                          selectedDuration === m ? "primary" : "subtle"
                        }
                        onClick={() => handleDurationSelect(m)}
                      >
                        {m}m
                      </Button>
                    ))}
                  </div>
                )}
                <Text as="span" className="timer-value">
                  {timeFormatted}
                </Text>
                <ProgressBar value={progress} />
                <Text
                  size={200}
                  style={{ color: "var(--colorNeutralForeground2)" }}
                >
                  {timerState === "running"
                    ? "Focus session in progress… Stay present."
                    : timerState === "paused"
                      ? "Paused · Click Resume to continue."
                      : `Ready to focus · Configured for ${selectedDuration} min.`}
                </Text>
              </DialogContent>
              <DialogActions>
                {timerState === "idle" && (
                  <>
                    <Button
                      appearance="primary"
                      icon={<Play20Filled />}
                      onClick={handleStart}
                    >
                      Start
                    </Button>
                    <Button appearance="subtle" onClick={close}>
                      Exit
                    </Button>
                  </>
                )}
                {timerState === "running" && (
                  <>
                    <Button
                      appearance="secondary"
                      icon={<Pause20Regular />}
                      onClick={handlePause}
                    >
                      Pause
                    </Button>
                    <Button
                      appearance="subtle"
                      icon={<ArrowReset20Regular />}
                      onClick={handleReset}
                    >
                      Reset
                    </Button>
                    <Button appearance="primary" onClick={handleFinishEarly}>
                      Finish
                    </Button>
                    <Button appearance="subtle" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </>
                )}
                {timerState === "paused" && (
                  <>
                    <Button
                      appearance="primary"
                      icon={<Play20Filled />}
                      onClick={handleResume}
                    >
                      Resume
                    </Button>
                    <Button
                      appearance="subtle"
                      icon={<ArrowReset20Regular />}
                      onClick={handleReset}
                    >
                      Reset
                    </Button>
                    <Button appearance="secondary" onClick={handleFinishEarly}>
                      Finish
                    </Button>
                    <Button appearance="subtle" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </>
                )}
              </DialogActions>
            </>
          ) : (
            <>
              <DialogContent>
                <div
                  className="focus-icon"
                  style={{
                    background: "var(--colorPaletteGreenBackground2)",
                    color: "var(--colorPaletteGreenForeground1)",
                  }}
                >
                  <CheckmarkCircle20Filled />
                </div>
                <Text className="eyebrow">SESSION COMPLETE</Text>
                <Text as="span" size={600} weight="semibold">
                  Great focus!
                </Text>
                <Text
                  size={300}
                  style={{ color: "var(--colorNeutralForeground2)" }}
                >
                  You recorded {elapsedMinutes} minute
                  {elapsedMinutes === 1 ? "" : "s"} of focus time on “
                  {task.title}”.
                </Text>
                <div style={{ marginTop: "12px" }}>
                  <Checkbox
                    checked={markTaskComplete}
                    onChange={(_, d) => setMarkTaskComplete(d.checked === true)}
                    label={`Mark “${task.title}” as completed`}
                  />
                </div>
              </DialogContent>
              <DialogActions>
                <Button appearance="primary" onClick={handleSaveAndComplete}>
                  Save & Record Session
                </Button>
                <Button appearance="subtle" onClick={close}>
                  Dismiss
                </Button>
              </DialogActions>
            </>
          )}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function Workspace({
  profile,
  setProfile,
  tasks,
  setTasks,
  goals,
  setGoals,
  events,
  setEvents,
  reminders,
  setReminders,
  platforms,
  setPlatforms,
  timetable,
  setTimetable,
  preferences,
  setPreferences,
  notifications,
  setNotifications,
  focusSessions,
  setFocusSessions,
  signOut,
  onAccountDeleted,
}: {
  profile: Profile
  setProfile: (p: Profile) => void
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  goals: Goal[]
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>
  events: EventItem[]
  setEvents: React.Dispatch<React.SetStateAction<EventItem[]>>
  reminders: Reminder[]
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>
  platforms: string[]
  setPlatforms: React.Dispatch<React.SetStateAction<string[]>>
  timetable: TimetableEntry[]
  setTimetable: React.Dispatch<React.SetStateAction<TimetableEntry[]>>
  preferences: UserPreferences
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>
  notifications: NotificationPreferences
  setNotifications: React.Dispatch<React.SetStateAction<NotificationPreferences>>
  focusSessions: FocusSessionRecord[]
  setFocusSessions: React.Dispatch<React.SetStateAction<FocusSessionRecord[]>>
  signOut: () => void
  onAccountDeleted?: () => void
}) {
  const [view, setView] = useState<View>("Home")
  const [mobileNav, setMobileNav] = useState(false)
  const [taskDialog, setTaskDialog] = useState(false)
  const [goalDialog, setGoalDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [focusTask, setFocusTask] = useState<Task | null>(null)
  const [search, setSearch] = useState("")
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [activeToastAlert, setActiveToastAlert] = useState<Reminder | null>(null)

  const newTask = () => {
    setEditingTask(null)
    setTaskDialog(true)
  }
  const saveTask = (data: Omit<Task, "id">) => {
    if (editingTask) {
      const id = editingTask.id
      setTasks((list) =>
        list.map((x) =>
          x.id === id
            ? {
                ...data,
                id: x.id,
                createdAt: x.createdAt || new Date().toISOString(),
              }
            : x,
        ),
      )
      taskService.updateTask(id, data).catch(() => {})

      if (data.dueDate) {
        const taskReminderInput = {
          id,
          title: data.title,
          dueDate: data.dueDate,
          dueTime: data.dueTime,
        }
        setReminders((cur) => {
          const next = upsertTaskDeadlineReminder(
            cur,
            taskReminderInput,
            notifications.timing || "exact",
          )
          saveReminders(next)
          return next
        })
        const deadlineReminder = buildTaskDeadlineReminder(
          taskReminderInput,
          notifications.timing || "exact",
        )
        syncReminderToBackend(deadlineReminder).catch(() => {})
      } else {
        setReminders((cur) => {
          const next = removeTaskDeadlineReminder(cur, id)
          saveReminders(next)
          return next
        })
        deleteBackendReminder(id).catch(() => {})
      }
    } else {
      const tempId = Date.now()
      const optimisticTask: Task = {
        ...data,
        id: tempId,
        createdAt: new Date().toISOString(),
      }
      setTasks((list) => [...list, optimisticTask])

      if (data.dueDate) {
        const taskReminderInput = {
          id: tempId,
          title: data.title,
          dueDate: data.dueDate,
          dueTime: data.dueTime,
        }
        setReminders((cur) => {
          const next = upsertTaskDeadlineReminder(
            cur,
            taskReminderInput,
            notifications.timing || "exact",
          )
          saveReminders(next)
          return next
        })
        const deadlineReminder = buildTaskDeadlineReminder(
          taskReminderInput,
          notifications.timing || "exact",
        )
        syncReminderToBackend(deadlineReminder).catch(() => {})
      }

      taskService
        .createTask(data)
        .then((created) => {
          if (created && created.id !== tempId) {
            setTasks((list) => list.map((x) => (x.id === tempId ? created : x)))
            if (data.dueDate) {
              const updatedReminderInput = {
                id: created.id,
                title: created.title,
                dueDate: created.dueDate || data.dueDate,
                dueTime: created.dueTime || data.dueTime,
              }
              setReminders((cur) => {
                const cleaned = removeTaskDeadlineReminder(cur, tempId)
                const next = upsertTaskDeadlineReminder(
                  cleaned,
                  updatedReminderInput,
                  notifications.timing || "exact",
                )
                saveReminders(next)
                return next
              })
              const updatedDeadlineReminder = buildTaskDeadlineReminder(
                updatedReminderInput,
                notifications.timing || "exact",
              )
              syncReminderToBackend(updatedDeadlineReminder).catch(() => {})
            }
          }
        })
        .catch(() => {})
    }
    setTaskDialog(false)
  }
  const saveGoal = (data: Omit<Goal, "id">) => {
    setGoals((list) =>
      editingGoal
        ? list.map((x) => (x.id === editingGoal.id ? { ...data, id: x.id } : x))
        : [...list, { ...data, id: Date.now() }],
    )
    setGoalDialog(false)
  }
  const updateTask = (id: number, patch: Partial<Task>) => {
    setTasks((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    taskService.updateTask(id, patch).catch(() => {})

    if (patch.status === "completed") {
      setReminders((cur) => {
        const next = cur.map((r) =>
          r.targetType === "task" && String(r.targetId) === String(id)
            ? {
                ...r,
                status: "completed" as const,
                completedAt: new Date().toISOString(),
                read: true,
              }
            : r,
        )
        saveReminders(next)
        return next
      })
      updateBackendReminderStatus(id, {
        status: "completed",
        completedAt: new Date().toISOString(),
      }).catch(() => {})
    } else if (patch.dueDate || patch.title || patch.dueTime) {
      const existing = tasks.find((t) => t.id === id)
      if (existing) {
        const updatedTask = { ...existing, ...patch }
        if (updatedTask.dueDate) {
          const taskReminderInput = {
            id,
            title: updatedTask.title,
            dueDate: updatedTask.dueDate,
            dueTime: updatedTask.dueTime,
          }
          setReminders((cur) => {
            const next = upsertTaskDeadlineReminder(
              cur,
              taskReminderInput,
              notifications.timing || "exact",
            )
            saveReminders(next)
            return next
          })
          const rObj = buildTaskDeadlineReminder(
            taskReminderInput,
            notifications.timing || "exact",
          )
          syncReminderToBackend(rObj).catch(() => {})
        }
      }
    }
  }
  const results =
    search.length > 1
      ? tasks.filter((x) =>
          x.title.toLowerCase().includes(search.toLowerCase()),
        )
      : []
  // Real-time reminder checker and browser/in-app notification dispatcher
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date()
      const quiet = isWithinQuietHours(notifications.quietHours, now)
      let updated = false

      const nextReminders = reminders.map((r) => {
        if (r.status === "completed" || r.dismissed) return r

        // Snoozed reminder: check if snoozedUntil has arrived
        if (r.status === "snoozed" && r.snoozedUntil) {
          const snoozedMs = new Date(r.snoozedUntil).getTime()
          if (!isNaN(snoozedMs) && now.getTime() >= snoozedMs) {
            updated = true
            const canNotify =
              notifications.inApp &&
              !quiet &&
              (r.targetType === "contest" ? notifications.contests : true) &&
              (r.targetType === "task" ? notifications.tasks : true)
            if (canNotify) {
              setActiveToastAlert(r)
              if (notifications.browserNotifications) {
                dispatchBrowserNotification("SAGE Reminder Due: " + r.title, r.title, () => {
                  setView(
                    r.targetType === "contest"
                      ? "Contests"
                      : r.targetType === "task"
                        ? "Tasks"
                        : "Reminders",
                  )
                  setNotifPanelOpen(true)
                })
              }
            }
            return {
              ...r,
              status: "open" as const,
              snoozedUntil: undefined,
              read: false,
              notifiedAt: now.toISOString(),
            }
          }
          return r
        }

        // Regular reminder due check
        if (isReminderDue(r, now)) {
          if (!r.notifiedAt) {
            updated = true
            const canNotify =
              notifications.inApp &&
              !quiet &&
              (r.targetType === "contest" ? notifications.contests : true) &&
              (r.targetType === "task" ? notifications.tasks : true)
            if (canNotify) {
              setActiveToastAlert(r)
              if (notifications.browserNotifications) {
                dispatchBrowserNotification("SAGE Reminder Due: " + r.title, r.title, () => {
                  setView(
                    r.targetType === "contest"
                      ? "Contests"
                      : r.targetType === "task"
                        ? "Tasks"
                        : "Reminders",
                  )
                  setNotifPanelOpen(true)
                })
              }
            }
            return {
              ...r,
              read: false,
              notifiedAt: now.toISOString(),
            }
          }
        }

        return r
      })

      if (updated) {
        setReminders(nextReminders)
        saveReminders(nextReminders)
      }
    }

    checkReminders()
    const timer = setInterval(checkReminders, 5000)
    return () => clearInterval(timer)
  }, [reminders, notifications, setReminders])

  const activeDueNotifications = reminders
    .filter((r) => isReminderDue(r) && r.status !== "completed" && !r.dismissed)
    .sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1
      return (
        new Date(b.dueAt || b.createdAt).getTime() -
        new Date(a.dueAt || a.createdAt).getTime()
      )
    })

  const unreadCount = activeDueNotifications.filter((r) => !r.read).length

  const handleMarkAsRead = (id: number) => {
    setReminders((list) => {
      const next = list.map((r) => (r.id === id ? { ...r, read: true } : r))
      try {
        window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const handleMarkAllAsRead = () => {
    setReminders((list) => {
      const next = list.map((r) =>
        isReminderDue(r) && !r.dismissed ? { ...r, read: true } : r,
      )
      try {
        window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const handleDismissNotification = (id: number) => {
    setReminders((list) => {
      const next = list.map((r) =>
        r.id === id ? { ...r, dismissed: true, read: true } : r,
      )
      try {
        window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const handleSnoozeFromNotification = (id: number) => {
    const d = new Date()
    d.setHours(d.getHours() + 1)
    let nextDate = getLocalDateString(d)
    let nextTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    if (d.getHours() >= 22 || d.getHours() < 6) {
      const tmrw = new Date()
      tmrw.setDate(tmrw.getDate() + 1)
      nextDate = getLocalDateString(tmrw)
      nextTime = "09:00"
    }

    setReminders((list) => {
      const next = list.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "snoozed" as const,
              date: nextDate,
              time: nextTime,
              snoozedUntil: new Date(
                `${nextDate}T${nextTime}:00`,
              ).toISOString(),
              notifiedAt: undefined,
              read: true,
            }
          : r,
      )
      try {
        window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const handleNavigateToReminder = (id: number) => {
    handleMarkAsRead(id)
    setView("Reminders")
    setNotifPanelOpen(false)
  }

  const screen =
    view === "Home" ? (
      <HomeScreen
        profile={profile}
        tasks={tasks}
        goals={goals}
        events={events}
        reminders={reminders}
        timetable={timetable}
        preferences={preferences}
        focusSessions={focusSessions}
        newTask={newTask}
        newGoal={() => setGoalDialog(true)}
        addSchedule={() => setView("Calendar")}
        focus={setFocusTask}
        go={setView}
        updateTask={updateTask}
      />
    ) : view === "Tasks" ? (
      <TasksScreen
        tasks={tasks}
        updateTask={updateTask}
        edit={(t) => {
          setEditingTask(t)
          setTaskDialog(true)
        }}
        focus={setFocusTask}
        create={newTask}
        remove={(id) => {
          setTasks((list) => list.filter((x) => x.id !== id))
          taskService.deleteTask(id).catch(() => {})
          setReminders((cur) => {
            const next = removeTaskDeadlineReminder(cur, id)
            saveReminders(next)
            return next
          })
          deleteBackendReminder(id).catch(() => {})
        }}
      />
    ) : view === "Goals" ? (
      <GoalsScreen
        goals={goals}
        create={() => {
          setEditingGoal(null)
          setGoalDialog(true)
        }}
        edit={(g) => {
          setEditingGoal(g)
          setGoalDialog(true)
        }}
        remove={(id) => setGoals(goals.filter((x) => x.id !== id))}
      />
    ) : view === "Calendar" ? (
      <CalendarScreen
        events={events}
        setEvents={setEvents}
        timetable={timetable}
        setTimetable={setTimetable}
      />
    ) : view === "Contests" ? (
      <ContestsScreen
        platforms={platforms}
        setPlatforms={setPlatforms}
        reminders={reminders}
        setReminders={setReminders}
      />
    ) : view === "Reminders" ? (
      <RemindersScreen reminders={reminders} setReminders={setReminders} />
    ) : view === "Progress" ? (
      <ProgressScreen
        tasks={tasks}
        goals={goals}
        events={events}
        focusSessions={focusSessions}
        preferences={preferences}
      />
    ) : view === "Ask SAGE" ? (
      <AskSageScreen
        tasks={tasks}
        events={events}
        timetable={timetable}
        setTasks={setTasks}
        setEvents={setEvents}
        setTimetable={setTimetable}
        focus={setFocusTask}
        addTask={newTask}
        updateTask={updateTask}
      />
    ) : (
      <SettingsScreen
        profile={profile}
        setProfile={setProfile}
        preferences={preferences}
        setPreferences={setPreferences}
        notifications={notifications}
        setNotifications={setNotifications}
        platforms={platforms}
        setPlatforms={setPlatforms}
        events={events}
        setEvents={setEvents}
        timetable={timetable}
        setTimetable={setTimetable}
        tasks={tasks}
        goals={goals}
        reminders={reminders}
        focusSessions={focusSessions}
        setFocusSessions={setFocusSessions}
        go={setView}
        signOut={signOut}
        onAccountDeleted={onAccountDeleted}
      />
    )
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <Brand />
        <Button
          className="close-nav"
          appearance="subtle"
          icon={<Dismiss20Regular />}
          onClick={() => setMobileNav(false)}
        />
        <nav aria-label="Main navigation">
          <Text className="nav-label">WORKSPACE</Text>
          {nav.map((item) => (
            <Tooltip content={item.label} relationship="label" key={item.label}>
              <Button
                appearance="subtle"
                icon={item.icon}
                className={`nav-item ${view === item.label ? "selected" : ""}`}
                onClick={() => {
                  setView(item.label)
                  setMobileNav(false)
                }}
              >
                {item.label}
                {item.label === "Tasks" &&
                  tasks.filter((x) => x.status === "open").length > 0 && (
                    <Badge appearance="tint">
                      {tasks.filter((x) => x.status === "open").length}
                    </Badge>
                  )}
              </Button>
            </Tooltip>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Button
            appearance="subtle"
            icon={<Settings20Regular />}
            className={`nav-item ${view === "Settings" ? "selected" : ""}`}
            onClick={() => setView("Settings")}
          >
            Settings
          </Button>
          <Button
            appearance="subtle"
            className="profile-block"
            onClick={() => setView("Settings")}
          >
            <Avatar name={profile.name || profile.email} />
            <span>
              <Text as="span" weight="semibold">
                {profile.name || "Your profile"}
              </Text>
              <Text size={100}>{profile.course}</Text>
            </span>
            <MoreHorizontal20Regular />
          </Button>
        </div>
      </aside>
      {mobileNav && (
        <div className="scrim" onClick={() => setMobileNav(false)} />
      )}
      <div className="app-main">
        <InAppNotificationBanner
          alert={activeToastAlert}
          onDismiss={() => setActiveToastAlert(null)}
          onSnooze={handleSnoozeFromNotification}
          onView={(alert) => {
            setActiveToastAlert(null)
            setView(
              alert.targetType === "contest"
                ? "Contests"
                : alert.targetType === "task"
                  ? "Tasks"
                  : "Reminders",
            )
          }}
        />
        <header className="topbar">
          <Button
            className="menu-button"
            appearance="subtle"
            icon={<Navigation20Regular />}
            onClick={() => setMobileNav(true)}
          />
          <div className="search-wrap">
            <Input
              contentBefore={<Search20Regular />}
              placeholder="Search your workspace…"
              value={search}
              onChange={(_, d) => setSearch(d.value)}
            />
            {results.length > 0 && (
              <Card className="search-results">
                {results.map((task) => (
                  <Button
                    appearance="subtle"
                    key={task.id}
                    onClick={() => {
                      setView("Tasks")
                      setSearch("")
                    }}
                  >
                    {task.title}
                  </Button>
                ))}
              </Card>
            )}
          </div>
          <Button
            className="global-create"
            appearance="primary"
            icon={<Add20Regular />}
            onClick={newTask}
          >
            New Task
          </Button>
          <Button
            className="notification-button"
            appearance="subtle"
            icon={<Alert20Regular />}
            onClick={() => setNotifPanelOpen(!notifPanelOpen)}
            aria-label={
              unreadCount > 0
                ? `Notifications (${unreadCount} unread)`
                : "Notifications"
            }
          >
            {unreadCount > 0 && <span className="unread-dot" />}
          </Button>
        </header>
        <main className="page-content">{screen}</main>
        {notifPanelOpen && (
          <Card className="notification-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--spacingVerticalS)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Text as="span" weight="semibold" size={400}>
                  Notifications
                </Text>
                {unreadCount > 0 && (
                  <Badge appearance="tint" color="brand">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                {unreadCount > 0 && (
                  <Button
                    appearance="subtle"
                    size="small"
                    onClick={handleMarkAllAsRead}
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Dismiss20Regular />}
                  onClick={() => setNotifPanelOpen(false)}
                  aria-label="Close notifications"
                />
              </div>
            </div>

            {activeDueNotifications.length ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  maxHeight: "22rem",
                  overflowY: "auto",
                }}
              >
                {activeDueNotifications.map((r) => (
                  <div
                    className={`notice ${!r.read ? "unread" : ""}`}
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "8px",
                      borderRadius: "var(--borderRadiusMedium)",
                      cursor: "pointer",
                    }}
                    onClick={() => handleNavigateToReminder(r.id)}
                  >
                    <div className="notice-icon" style={{ marginTop: "2px" }}>
                      <Alert20Regular />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Text
                          weight={!r.read ? "bold" : "semibold"}
                          style={{ fontSize: "14px" }}
                        >
                          {r.title}
                        </Text>
                        {!r.read && (
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: "var(--colorBrandForeground1)",
                            }}
                          />
                        )}
                      </div>
                      <Text
                        size={200}
                        style={{ color: "var(--colorNeutralForeground3)" }}
                      >
                        {r.date} · {r.time}
                        {r.status === "snoozed" ? " · Snoozed" : ""}
                        {r.notificationTiming !== "exact"
                          ? ` · ${TIMING_LABELS[r.notificationTiming] || ""}`
                          : ""}
                      </Text>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          marginTop: "6px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!r.read && (
                          <Button
                            appearance="subtle"
                            size="small"
                            onClick={() => handleMarkAsRead(r.id)}
                          >
                            Mark read
                          </Button>
                        )}
                        <Button
                          appearance="subtle"
                          size="small"
                          onClick={() => handleSnoozeFromNotification(r.id)}
                        >
                          Snooze +1h
                        </Button>
                        <Button
                          appearance="subtle"
                          size="small"
                          onClick={() => handleDismissNotification(r.id)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CheckmarkCircle20Regular />}
                title="You’re all caught up."
                copy="When reminders or tasks become due, they will appear here."
              />
            )}
          </Card>
        )}
      </div>
      <nav className="mobile-tabs">
        {nav.slice(0, 4).map((item) => (
          <Button
            key={item.label}
            appearance="subtle"
            icon={item.icon}
            className={view === item.label ? "selected" : ""}
            onClick={() => setView(item.label)}
          >
            {item.label}
          </Button>
        ))}
        <Button
          appearance="subtle"
          icon={<MoreHorizontal20Regular />}
          onClick={() => setMobileNav(true)}
        >
          More
        </Button>
      </nav>
      {taskDialog && (
        <TaskDialog
          key={editingTask?.id || "new"}
          open
          task={editingTask}
          goals={goals}
          close={() => setTaskDialog(false)}
          save={saveTask}
        />
      )}
      {goalDialog && (
        <GoalDialog
          key={editingGoal?.id || "new"}
          open
          goal={editingGoal}
          close={() => setGoalDialog(false)}
          save={saveGoal}
        />
      )}
      <FocusSessionDialog
        task={focusTask}
        defaultDuration={parseInt(preferences.duration, 10) || 25}
        close={() => setFocusTask(null)}
        finish={(session, completeTask) => {
          setFocusSessions((list) => [session, ...list])
          if (completeTask && session.taskId) {
            updateTask(session.taskId, { status: "completed" })
          }
        }}
      />
    </div>
  )
}

function HomeScreen({
  profile,
  tasks,
  goals,
  events,
  reminders,
  timetable,
  preferences,
  focusSessions,
  newTask,
  newGoal,
  addSchedule,
  focus,
  go,
  updateTask,
}: {
  profile: Profile
  tasks: Task[]
  goals: Goal[]
  events: EventItem[]
  reminders: Reminder[]
  timetable: TimetableEntry[]
  preferences: UserPreferences
  focusSessions: FocusSessionRecord[]
  newTask: () => void
  newGoal: () => void
  addSchedule: () => void
  focus: (t: Task) => void
  go: (v: View) => void
  updateTask: (id: number, patch: Partial<Task>) => void
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const todayStr = getLocalDateString(now)
  const todayFormatted = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  // 1. "WHAT SHOULD I DO NOW?" - DETERMINISTIC SAGE DECISION ENGINE (PHASE 3)
  const decisionContext = useMemo<DecisionContext>(
    () => ({
      currentDateTime: now,
      tasks,
      goals,
      timetable,
      calendarEvents: events,
      userPreferences: preferences,
      focusSessions,
    }),
    [now, tasks, goals, timetable, events, preferences, focusSessions],
  )

  const rec = useMemo(
    () => getFocusRecommendation(decisionContext),
    [decisionContext],
  )
  const nextTask = rec.candidateTask
  const nextReason = rec.reason
  const openTasks = tasks.filter((x) => x.status === "open")

  // Log recommendation shown event for future learning (deduplicated)
  const lastShownRef = useRef<number | null>(null)
  useEffect(() => {
    if (rec.taskId && rec.taskId !== lastShownRef.current) {
      lastShownRef.current = rec.taskId
      recordRecommendationEvent({
        recommendationId: `rec-${rec.taskId}`,
        taskId: rec.taskId,
        action: "shown",
        timestamp: new Date().toISOString(),
      })
    }
  }, [rec.taskId])

  const handleStartFocus = (t: Task) => {
    recordRecommendationEvent({
      recommendationId: `rec-${t.id}`,
      taskId: t.id,
      action: "started",
      timestamp: new Date().toISOString(),
    })
    focus(t)
  }

  const handleSnoozeTask = (t: Task) => {
    const snoozedUntilIso = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    recordRecommendationEvent({
      recommendationId: `rec-${t.id}`,
      taskId: t.id,
      action: "snoozed",
      timestamp: new Date().toISOString(),
    })
    updateTask(t.id, {
      status: "snoozed",
      snoozedUntil: snoozedUntilIso,
    })
  }

  const handleCompleteTask = (t: Task) => {
    recordRecommendationEvent({
      recommendationId: `rec-${t.id}`,
      taskId: t.id,
      action: "completed",
      timestamp: new Date().toISOString(),
    })
    updateTask(t.id, {
      status: "completed",
    })
  }

  // 2. "WHAT'S IMPORTANT TODAY?"
  // Stored academic data for today only (max 1–3 items). Full timetable belongs in Calendar.
  // Home should show only relevant current information: Next class (or in-progress class),
  // plus any urgent deadline/exam today. Never dump all classes on Home.
  const homeClass = getHomeClassStatus(timetable, now)

  const todayEvents = events
    .filter((e) => e.date === todayStr && e.type !== "Class")
    .sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"))

  const todayTasks = openTasks
    .filter((t) => t.dueDate === todayStr)
    .sort((a, b) => (a.dueTime || "23:59").localeCompare(b.dueTime || "23:59"))

  type TodayDeadlineItem = {
    id: string
    title: string
    time: string
    badge: string
    badgeColor: "brand" | "danger" | "informative" | "warning"
    type: string
  }

  const todayDeadlines: TodayDeadlineItem[] = [
    ...todayEvents.map((e) => ({
      id: `ev-${e.id}`,
      title: e.title,
      time: e.time
        ? `${e.time}${e.endTime ? ` – ${e.endTime}` : ""}`
        : "All day",
      badge: e.type,
      badgeColor: (e.type === "Exam"
        ? "danger"
        : "informative") as "brand" | "danger" | "informative",
      type: e.type,
    })),
    ...todayTasks.map((t) => ({
      id: `task-${t.id}`,
      title: t.title,
      time: t.dueTime ? `Due ${formatTime12(t.dueTime)}` : "Due today (by 11:59 PM)",
      badge: t.course ? t.course : "Assignment",
      badgeColor: "warning" as const,
      type: "Task",
    })),
  ].slice(0, 2)

  const totalTodayCount = todayEvents.length + todayTasks.length

  // 3. "IS THERE ANYTHING I MIGHT MISS?"
  // Anticipate risks: Overdue tasks, upcoming exams (next 7 days), deadlines tomorrow
  // Max 1–3 items, never fake data
  type MightMissItem = {
    id: string
    title: string
    subtitle: string
    badge: string
    badgeColor: "danger" | "important" | "warning"
  }

  const mightMissList: MightMissItem[] = []

  // Overdue open tasks
  openTasks
    .filter((t) => t.dueDate && getDaysDifference(t.dueDate) < 0)
    .sort(
      (a, b) =>
        getDaysDifference(a.dueDate || "") - getDaysDifference(b.dueDate || ""),
    )
    .forEach((t) => {
      const diff = Math.abs(getDaysDifference(t.dueDate || ""))
      mightMissList.push({
        id: `overdue-${t.id}`,
        title: t.title,
        subtitle: `Overdue by ${diff} day${
          diff === 1 ? "" : "s"
        } (was due ${formatShortDate(t.dueDate || "")})`,
        badge: "Overdue",
        badgeColor: "danger",
      })
    })

  // Upcoming exams in next 7 days
  events
    .filter(
      (e) =>
        e.type === "Exam" &&
        getDaysDifference(e.date) >= 0 &&
        getDaysDifference(e.date) <= 7,
    )
    .sort((a, b) => getDaysDifference(a.date) - getDaysDifference(b.date))
    .forEach((e) => {
      const diff = getDaysDifference(e.date)
      const whenStr =
        diff === 0
          ? "Today"
          : diff === 1
            ? "Tomorrow"
            : `In ${diff} days (${formatShortDate(e.date)})`
      mightMissList.push({
        id: `exam-${e.id}`,
        title: e.title,
        subtitle: `${whenStr}${e.time ? ` at ${e.time}` : ""} · Exam`,
        badge: diff <= 1 ? "Urgent Exam" : "Upcoming Exam",
        badgeColor: "important",
      })
    })

  // Tasks due tomorrow
  openTasks
    .filter((t) => t.dueDate && getDaysDifference(t.dueDate || "") === 1)
    .forEach((t) => {
      mightMissList.push({
        id: `tomorrow-${t.id}`,
        title: t.title,
        subtitle: `Due tomorrow${t.dueTime ? ` at ${t.dueTime}` : ""}${
          t.course ? ` · ${t.course}` : ""
        }`,
        badge: "Due Tomorrow",
        badgeColor: "warning",
      })
    })

  // Active reminders due today or overdue
  reminders
    .filter(
      (r) => r.status === "open" && r.date && getDaysDifference(r.date) <= 0,
    )
    .forEach((r) => {
      mightMissList.push({
        id: `rem-${r.id}`,
        title: r.title,
        subtitle: `Reminder · ${r.date} ${r.time}`,
        badge: "Reminder",
        badgeColor: "warning",
      })
    })

  const mightMissItems = mightMissList.slice(0, 3)

  return (
    <>
      <div className="welcome">
        <div>
          <Text as="span" size={800} weight="semibold">
            Hello{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}
          </Text>
          <Text size={300} style={{ color: "var(--colorNeutralForeground3)" }}>
            {todayFormatted}
          </Text>
        </div>
        <div className="button-row">
          <Button
            appearance="subtle"
            icon={<CalendarLtr20Regular />}
            onClick={() => go("Calendar")}
          >
            Full Calendar
          </Button>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={newTask}
          >
            New Task
          </Button>
        </div>
      </div>

      {/* FOCUS NOW — DETERMINISTIC SAGE DECISION ENGINE */}
      {rec.isClassInProgress && rec.activeClass ? (
        <Card
          className="sage-callout"
          style={{
            marginBottom: "var(--spacingVerticalL)",
            borderLeft: "4px solid var(--colorBrandBackground)",
          }}
        >
          <div className="sage-mark">
            <Book20Regular />
          </div>
          <div className="callout-copy">
            <Text className="eyebrow">
              ACADEMIC CONTEXT · CLASS IN PROGRESS
            </Text>
            <Text as="span" size={600} weight="semibold">
              {rec.activeClass.courseName}
            </Text>
            <Text
              size={300}
              style={{ color: "var(--colorNeutralForeground2)" }}
            >
              {formatTimeRange(
                rec.activeClass.startTime,
                rec.activeClass.endTime,
              )}
              {rec.activeClass.location ? ` · ${rec.activeClass.location}` : ""}{" "}
              · Live class period
            </Text>
            {nextTask && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  background: "var(--colorNeutralBackground3)",
                  borderRadius: "var(--borderRadiusMedium)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <Text
                    className="eyebrow"
                    style={{ fontSize: "11px", margin: 0 }}
                  >
                    FOCUS RECOMMENDATION FOR YOUR NEXT FREE WINDOW
                  </Text>
                  {nextTask.priority === "High" && (
                    <Badge appearance="tint" color="danger" size="small">
                      High Priority
                    </Badge>
                  )}
                </div>
                <Text size={300} weight="semibold">
                  {nextTask.title}
                </Text>
                <Text
                  size={200}
                  style={{ color: "var(--colorNeutralForeground2)" }}
                >
                  {nextTask.dueDate
                    ? `Due ${
                        nextTask.dueDate === todayStr
                          ? "today"
                          : getDaysDifference(nextTask.dueDate, now) === 1
                            ? "tomorrow"
                            : formatShortDate(nextTask.dueDate)
                      }${nextTask.dueTime ? ` at ${nextTask.dueTime}` : ""}`
                    : ""}
                  {rec.estimatedMinutes
                    ? ` · ~${rec.estimatedMinutes} min`
                    : ""}
                  {nextTask.course ? ` · ${nextTask.course}` : ""}
                </Text>
                <Text
                  size={200}
                  style={{
                    color: "var(--colorBrandForeground1)",
                    fontWeight: 500,
                  }}
                >
                  {nextReason}
                </Text>
              </div>
            )}
          </div>
          {nextTask && (
            <div className="button-row">
              <Button
                appearance="primary"
                icon={<Play20Filled />}
                onClick={() => handleStartFocus(nextTask)}
              >
                Start focus
              </Button>
              <Button
                appearance="subtle"
                icon={<Clock20Regular />}
                onClick={() => handleSnoozeTask(nextTask)}
              >
                Snooze
              </Button>
              <Button
                appearance="subtle"
                icon={<CheckmarkCircle20Regular />}
                onClick={() => handleCompleteTask(nextTask)}
              >
                Done
              </Button>
            </div>
          )}
        </Card>
      ) : nextTask ? (
        <Card
          className="sage-callout"
          style={{ marginBottom: "var(--spacingVerticalL)" }}
        >
          <div className="sage-mark">
            <Sparkle20Filled />
          </div>
          <div className="callout-copy">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "4px",
              }}
            >
              <Text className="eyebrow" style={{ margin: 0 }}>
                FOCUS NOW
              </Text>
              {nextTask.priority === "High" && (
                <Badge appearance="tint" color="danger" size="small">
                  High Priority
                </Badge>
              )}
            </div>
            <Text as="span" size={600} weight="semibold">
              {nextTask.title}
            </Text>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexWrap: "wrap",
                marginTop: "2px",
              }}
            >
              <Text
                size={200}
                style={{ color: "var(--colorNeutralForeground2)" }}
              >
                {nextTask.dueDate
                  ? `Due ${
                      nextTask.dueDate === todayStr
                        ? "today"
                        : getDaysDifference(nextTask.dueDate, now) === 1
                          ? "tomorrow"
                          : formatShortDate(nextTask.dueDate)
                    }${nextTask.dueTime ? ` at ${nextTask.dueTime}` : ""}`
                  : "No deadline"}
                {rec.estimatedMinutes ? ` · ~${rec.estimatedMinutes} min` : ""}
                {nextTask.course ? ` · ${nextTask.course}` : ""}
              </Text>
            </div>
            <Text
              size={300}
              style={{
                color: "var(--colorNeutralForeground2)",
                marginTop: "6px",
              }}
            >
              {nextReason}
            </Text>
          </div>
          <div className="button-row">
            <Button
              appearance="primary"
              icon={<Play20Filled />}
              onClick={() => handleStartFocus(nextTask)}
            >
              Start
            </Button>
            <Button
              appearance="secondary"
              icon={<Clock20Regular />}
              onClick={() => handleSnoozeTask(nextTask)}
            >
              Snooze
            </Button>
            <Button
              appearance="subtle"
              icon={<CheckmarkCircle20Regular />}
              onClick={() => handleCompleteTask(nextTask)}
            >
              Done
            </Button>
          </div>
        </Card>
      ) : (
        <Card
          className="sage-callout"
          style={{ marginBottom: "var(--spacingVerticalL)" }}
        >
          <div className="sage-mark">
            <Sparkle20Filled />
          </div>
          <div className="callout-copy">
            <Text className="eyebrow">FOCUS NOW</Text>
            <Text as="span" size={600} weight="semibold">
              {rec.title}
            </Text>
            <Text
              size={300}
              style={{ color: "var(--colorNeutralForeground2)" }}
            >
              {rec.reason}
            </Text>
          </div>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={newTask}
          >
            Add task
          </Button>
        </Card>
      )}

      {/* QUESTIONS 2 & 3: WHAT'S IMPORTANT TODAY? & IS THERE ANYTHING I MIGHT MISS? */}
      <div
        className="dashboard-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--spacingHorizontalL)",
        }}
      >
        {/* QUESTION 2: WHAT'S IMPORTANT TODAY? */}
        <Card className="content-card">
          <SectionTitle
            eyebrow="WHAT'S IMPORTANT TODAY?"
            title="Today's Schedule"
            action={
              <Button appearance="subtle" onClick={() => go("Calendar")}>
                Full Calendar
              </Button>
            }
          />
          {homeClass.entry || todayDeadlines.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {/* Single relevant class (informational only, no reminders) */}
              {homeClass.entry && (
                <div className="next-class-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                          marginBottom: "4px",
                        }}
                      >
                        <span
                          className={`class-status-badge ${homeClass.type}`}
                        >
                          {homeClass.type === "in-progress"
                            ? "● CLASS IN PROGRESS"
                            : homeClass.type === "next"
                              ? "NEXT CLASS"
                              : "UPCOMING CLASS"}
                        </span>
                        <span className="course-code-pill">
                          {homeClass.entry.courseCode}
                        </span>
                        {!homeClass.entry.isKnownCourse && (
                          <span className="unavailable-note">
                            Course name unavailable
                          </span>
                        )}
                      </div>
                      <Text
                        as="h3"
                        size={500}
                        weight="semibold"
                        style={{ margin: "2px 0 4px 0", display: "block" }}
                      >
                        {homeClass.entry.courseName}
                      </Text>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                          marginTop: "4px",
                        }}
                      >
                        <Text
                          size={200}
                          weight="semibold"
                          style={{ color: "var(--colorBrandForeground1)" }}
                        >
                          {formatTimeRange(
                            homeClass.entry.startTime,
                            homeClass.entry.endTime,
                          )}
                        </Text>
                        <span className="period-chip">
                          {homeClass.entry.startPeriod ===
                          homeClass.entry.endPeriod
                            ? `Period ${homeClass.entry.startPeriod}`
                            : `Periods ${homeClass.entry.startPeriod}–${homeClass.entry.endPeriod}`}
                        </span>
                        {homeClass.entry.location && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              color: "var(--colorNeutralForeground2)",
                            }}
                          >
                            <Location20Regular style={{ fontSize: "14px" }} />
                            {homeClass.entry.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "8px",
                      paddingTop: "6px",
                      borderTop: "1px dashed var(--colorNeutralStroke3)",
                    }}
                  >
                    <Text
                      size={100}
                      style={{ color: "var(--colorNeutralForeground3)" }}
                    >
                      Academic context · Information only · No reminders
                    </Text>
                    <Button
                      appearance="subtle"
                      size="small"
                      onClick={() => go("Calendar")}
                    >
                      Full Timetable →
                    </Button>
                  </div>
                </div>
              )}

              {/* Deadlines / exams today if any (max 2) */}
              {todayDeadlines.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {todayDeadlines.map((item) => (
                    <div
                      className="simple-row"
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--colorNeutralStroke2)",
                      }}
                    >
                      <div
                        className={`event-marker ${item.type.toLowerCase()}`}
                        style={{
                          width: "4px",
                          height: "26px",
                          borderRadius: "2px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          weight="semibold"
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.title}
                        </Text>
                        <Text
                          size={200}
                          style={{ color: "var(--colorNeutralForeground3)" }}
                        >
                          {item.time}
                        </Text>
                      </div>
                      <Badge appearance="tint" color={item.badgeColor}>
                        {item.badge}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarLtr20Regular />}
              title="Nothing scheduled right now"
              copy="Your calendar has no classes or deadlines today. The complete timetable is in Calendar."
              action={
                <Button appearance="secondary" onClick={() => go("Calendar")}>
                  Open Calendar
                </Button>
              }
            />
          )}
        </Card>

        {/* QUESTION 3: IS THERE ANYTHING I MIGHT MISS? */}
        <Card className="content-card">
          <SectionTitle
            eyebrow="IS THERE ANYTHING I MIGHT MISS?"
            title="Heads-Up & Deadlines"
            action={
              <Button appearance="subtle" onClick={() => go("Tasks")}>
                View all tasks
              </Button>
            }
          />
          {mightMissItems.length ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {mightMissItems.map((item) => (
                <div
                  className="simple-row"
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--colorNeutralStroke2)",
                  }}
                >
                  <div style={{ flexShrink: 0 }}>
                    {item.badgeColor === "danger" ? (
                      <Alert20Regular
                        style={{ color: "var(--colorPaletteRedForeground1)" }}
                      />
                    ) : item.badgeColor === "important" ? (
                      <Book20Regular
                        style={{ color: "var(--colorPaletteBerryForeground1)" }}
                      />
                    ) : (
                      <Clock20Regular
                        style={{
                          color: "var(--colorPaletteDarkOrangeForeground1)",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      weight="semibold"
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      size={200}
                      style={{ color: "var(--colorNeutralForeground3)" }}
                    >
                      {item.subtitle}
                    </Text>
                  </div>
                  <Badge appearance="filled" color={item.badgeColor}>
                    {item.badge}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CheckmarkCircle20Regular />}
              title="You’re all caught up"
              copy="No overdue tasks, urgent deadlines, or exams in the next 7 days."
            />
          )}
        </Card>
      </div>
    </>
  )
}

function TasksScreen({
  tasks,
  updateTask,
  edit,
  focus,
  create,
  remove,
}: {
  tasks: Task[]
  updateTask: (id: number, patch: Partial<Task>) => void
  edit: (t: Task) => void
  focus: (t: Task) => void
  create: () => void
  remove: (id: number) => void
}) {
  const [tab, setTab] = useState("All")
  const todayStr = getLocalDateString()

  const openTasks = tasks.filter((x) => x.status === "open")
  const overdueTasks = openTasks.filter(
    (x) => x.dueDate && x.dueDate < todayStr,
  )
  const todayTasks = openTasks.filter((x) => x.dueDate === todayStr)
  const upcomingTasks = openTasks.filter(
    (x) => x.dueDate && x.dueDate > todayStr,
  )
  const completedTasks = tasks.filter((x) => x.status === "completed")
  const snoozedTasks = tasks.filter((x) => x.status === "snoozed")

  const filtered = tasks.filter((x) => {
    if (tab === "All") return true
    if (tab === "Today") return x.status === "open" && x.dueDate === todayStr
    if (tab === "Upcoming")
      return x.status === "open" && x.dueDate && x.dueDate > todayStr
    if (tab === "Overdue")
      return x.status === "open" && x.dueDate && x.dueDate < todayStr
    if (tab === "Completed") return x.status === "completed"
    if (tab === "Snoozed") return x.status === "snoozed"
    return x.status === "open"
  })

  return (
    <>
      <PageHeading
        eyebrow="YOUR WORK"
        title="Tasks"
        subtitle="Capture your work with clear deadlines, countdowns, and priorities."
        action={
          <Button appearance="primary" icon={<Add20Regular />} onClick={create}>
            New Task
          </Button>
        }
      />
      {overdueTasks.length > 0 && tab !== "Overdue" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "var(--colorPaletteRedBackground1)",
            border: "1px solid rgba(209, 52, 56, 0.3)",
            borderRadius: "var(--borderRadiusMedium)",
            marginBottom: "var(--spacingVerticalM)",
            color: "var(--colorPaletteRedForeground1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Alert20Regular />
            <Text weight="semibold" size={200}>
              You have {overdueTasks.length} overdue task
              {overdueTasks.length === 1 ? "" : "s"} needing attention.
            </Text>
          </div>
          <Button
            appearance="subtle"
            size="small"
            style={{ color: "var(--colorPaletteRedForeground1)" }}
            onClick={() => setTab("Overdue")}
          >
            View Overdue Tasks
          </Button>
        </div>
      )}
      <Card className="content-card large-card">
        <TabList
          selectedValue={tab}
          onTabSelect={(_: SelectTabEvent, d: SelectTabData) =>
            setTab(String(d.value))
          }
        >
          <Tab value="All">All ({tasks.length})</Tab>
          <Tab value="Today">Today ({todayTasks.length})</Tab>
          <Tab value="Upcoming">Upcoming ({upcomingTasks.length})</Tab>
          <Tab value="Overdue">Overdue ({overdueTasks.length})</Tab>
          <Tab value="Completed">Completed ({completedTasks.length})</Tab>
          <Tab value="Snoozed">Snoozed ({snoozedTasks.length})</Tab>
        </TabList>
        {filtered.length ? (
          filtered.map((task) => (
            <div key={task.id}>
              <TaskRow
                task={task}
                update={(p) => updateTask(task.id, p)}
                edit={() => edit(task)}
                focus={() => focus(task)}
              />
              <div className="row-actions">
                <Button
                  appearance="subtle"
                  onClick={() => updateTask(task.id, { status: "snoozed" })}
                >
                  Snooze
                </Button>
                <Button
                  appearance="subtle"
                  onClick={() =>
                    updateTask(task.id, {
                      dueDate: new Date(Date.now() + 86400000)
                        .toISOString()
                        .slice(0, 10),
                      status: "open",
                    })
                  }
                >
                  Move to tomorrow
                </Button>
                <Button
                  appearance="subtle"
                  icon={<Delete20Regular />}
                  onClick={() => remove(task.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={<List20Regular />}
            title={
              tab === "Completed"
                ? "Nothing completed yet."
                : "You don’t have any tasks here."
            }
            copy="Create a task with a due date, priority, and estimated duration."
            action={
              <Button appearance="primary" onClick={create}>
                New Task
              </Button>
            }
          />
        )}
      </Card>
    </>
  )
}

function GoalsScreen({
  goals,
  create,
  edit,
  remove,
}: {
  goals: Goal[]
  create: () => void
  edit: (g: Goal) => void
  remove: (id: number) => void
}) {
  return (
    <>
      <PageHeading
        eyebrow="DIRECTION"
        title="Goals"
        subtitle="Connect the work you do today with outcomes that matter to you."
        action={
          <Button appearance="primary" icon={<Add20Regular />} onClick={create}>
            Create Goal
          </Button>
        }
      />
      {goals.length ? (
        <div className="cards-grid">
          {goals.map((goal) => {
            const value = goal.milestones.length
              ? goal.completed / goal.milestones.length
              : 0
            return (
              <Card className="goal-card" key={goal.id}>
                <div className="goal-icon">
                  <TargetArrow20Regular />
                </div>
                <SectionTitle
                  title={goal.title}
                  action={
                    <div className="button-row">
                      <Button
                        appearance="subtle"
                        icon={<Edit20Regular />}
                        onClick={() => edit(goal)}
                      />
                      <Button
                        appearance="subtle"
                        icon={<Delete20Regular />}
                        onClick={() => remove(goal.id)}
                      />
                    </div>
                  }
                />
                <Text>{goal.description || "No description added."}</Text>
                <Text size={200}>
                  {goal.category} · Target {goal.targetDate || "not set"}
                </Text>
                <ProgressBar value={value} />
                <Text size={200}>
                  {goal.completed} of {goal.milestones.length} milestones
                  completed
                </Text>
                {goal.milestones.map((m, i) => (
                  <Checkbox
                    key={m}
                    label={m}
                    checked={i < goal.completed}
                    onChange={() =>
                      edit({
                        ...goal,
                        completed:
                          i < goal.completed
                            ? Math.max(0, goal.completed - 1)
                            : goal.completed + 1,
                      })
                    }
                  />
                ))}
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<TargetArrow20Regular />}
          title="No goals yet."
          copy="Create an academic, technical, or personal learning goal."
          action={
            <Button appearance="primary" onClick={create}>
              Create your first goal
            </Button>
          }
        />
      )}
    </>
  )
}

function UploadScheduleDialog({
  open,
  close,
  onImportEvents,
  onImportTimetable,
}: {
  open: boolean
  close: () => void
  onImportEvents: (items: EventItem[]) => void
  onImportTimetable: (entries: TimetableEntry[]) => void
}) {
  const [scheduleType, setScheduleType] = useState<"timetable" | "exam">(
    "timetable",
  )
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [extractedTimetable, setExtractedTimetable] =
    useState<TimetableEntry[]>([])
  const [extractedEvents, setExtractedEvents] = useState<EventItem[]>([])
  const [statusMsg, setStatusMsg] = useState("")
  const [isExtracting, setIsExtracting] = useState(false)
  const [isError, setIsError] = useState(false)

  const handleFile = async (f: File) => {
    setFile(f)
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f))
    } else {
      setPreviewUrl("")
    }
    setIsExtracting(true)
    setIsError(false)
    setStatusMsg("")

    try {
      if (scheduleType === "timetable") {
        const entries = await parseUploadedTimetableFile(f)
        setExtractedTimetable(entries)
        if (entries.length > 0) {
          setIsError(false)
          setStatusMsg(
            `✓ ${entries.length} class blocks merged · College periods (8:10 AM – 5:20 PM) · Resolved via Course Catalog`,
          )
        } else {
          setIsError(true)
          setStatusMsg(
            "Could not detect timetable data from this image or document. You can load our standard university curriculum template below or review image clarity.",
          )
        }
      } else {
        const items = await parseUploadedExamFile(f)
        setExtractedEvents(items)
        if (items.length > 0) {
          setIsError(false)
          setStatusMsg(
            `✓ ${items.length} upcoming exams extracted from document.`,
          )
        } else {
          setIsError(true)
          setStatusMsg(
            "Could not detect exam deadlines from this document. Please check image clarity or use 'Add Event' in Calendar.",
          )
        }
      }
    } catch (err) {
      console.warn("Failed to process schedule file:", err)
      setIsError(true)
      setStatusMsg(
        "An error occurred while analyzing the schedule with SAGE AI. Please try again or load the standard template.",
      )
    } finally {
      setIsExtracting(false)
    }
  }

  const handleTypeChange = async (type: "timetable" | "exam") => {
    setScheduleType(type)
    if (file) {
      setIsExtracting(true)
      setIsError(false)
      setStatusMsg("")
      try {
        if (type === "timetable") {
          const entries = await parseUploadedTimetableFile(file)
          setExtractedTimetable(entries)
          if (entries.length > 0) {
            setIsError(false)
            setStatusMsg(
              `✓ ${entries.length} class blocks merged · College periods (8:10 AM – 5:20 PM)`,
            )
          } else {
            setIsError(true)
            setStatusMsg(
              "Could not detect timetable data from this file. You can load our standard curriculum template below.",
            )
          }
        } else {
          const items = await parseUploadedExamFile(file)
          setExtractedEvents(items)
          if (items.length > 0) {
            setIsError(false)
            setStatusMsg(
              `✓ ${items.length} upcoming exams extracted from document.`,
            )
          } else {
            setIsError(true)
            setStatusMsg(
              "Could not detect exam deadlines from this document. Please check image clarity or use 'Add Event' in Calendar.",
            )
          }
        }
      } catch (err) {
        setIsError(true)
        setStatusMsg("Failed to analyze schedule file.")
      } finally {
        setIsExtracting(false)
      }
    }
  }

  const save = () => {
    if (scheduleType === "timetable" && extractedTimetable.length) {
      onImportTimetable(extractedTimetable)
      close()
    } else if (scheduleType === "exam" && extractedEvents.length) {
      onImportEvents(extractedEvents)
      close()
    }
  }

  return (
    <Dialog open={open}>
      <DialogSurface className="form-dialog" style={{ maxWidth: "48rem" }}>
        <DialogBody>
          <DialogTitle>Upload Timetable or Exam Schedule</DialogTitle>
          <DialogContent>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacingVerticalM)",
              }}
            >
              <div className="timetable-info-banner">
                <Book20Regular />
                <Text size={200}>
                  Timetable classes are recurring background context for
                  Calendar (Informational only · No reminder fatigue). Exams are
                  actionable deadlines.
                </Text>
              </div>

              <TabList
                selectedValue={scheduleType}
                onTabSelect={(_, d) =>
                  handleTypeChange(d.value as "timetable" | "exam")
                }
              >
                <Tab value="timetable">Weekly Timetable (Classes)</Tab>
                <Tab value="exam">Exam Schedule (Deadlines)</Tab>
              </TabList>

              <UploadReview
                label={
                  scheduleType === "timetable"
                    ? "Upload timetable image or document"
                    : "Upload exam schedule image"
                }
                uploaded={file?.name || ""}
                previewUrl={previewUrl}
                statusMessage={statusMsg}
                isExtracting={isExtracting}
                isError={isError}
                onFileSelect={handleFile}
              />

              {scheduleType === "timetable" && (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "var(--colorNeutralBackground2)",
                    borderRadius: "var(--borderRadiusMedium)",
                    border: "1px solid var(--colorNeutralStroke2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      flex: 1,
                      minWidth: "220px",
                    }}
                  >
                    <Text weight="semibold" size={200}>
                      Standard College Curriculum Template
                    </Text>
                    <Text
                      size={200}
                      style={{ color: "var(--colorNeutralForeground3)" }}
                    >
                      {extractedTimetable.length > 0
                        ? "Want to reset? Replace with the standard engineering curriculum timetable."
                        : "No classes detected yet? Load the standard college curriculum timetable with 1-click."}
                    </Text>
                  </div>
                  <Button
                    appearance={
                      extractedTimetable.length === 0 ? "primary" : "secondary"
                    }
                    size="small"
                    icon={<Book20Regular />}
                    disabled={isExtracting}
                    onClick={() => {
                      const template = getSampleTimetableTemplate()
                      setExtractedTimetable(template)
                      setIsError(false)
                      setStatusMsg(
                        `✓ Loaded standard curriculum template (${template.length} class blocks). Review below before saving.`,
                      )
                    }}
                  >
                    {extractedTimetable.length > 0
                      ? "Replace with Template"
                      : "Load Standard Curriculum Template"}
                  </Button>
                </div>
              )}

              {scheduleType === "timetable" &&
                extractedTimetable.length > 0 && (
                  <div className="upload-dialog-preview">
                    <div
                      style={{
                        marginBottom: "var(--spacingVerticalS)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text weight="semibold" size={300}>
                        Extracted Timetable Preview (Consecutive Periods Merged)
                      </Text>
                      <Badge appearance="tint" color="brand">
                        {extractedTimetable.length} Class Blocks
                      </Badge>
                    </div>
                    <TimetableReviewList
                      items={extractedTimetable}
                      remove={(id) =>
                        setExtractedTimetable(
                          extractedTimetable.filter((t) => t.id !== id),
                        )
                      }
                      empty="No timetable classes extracted."
                    />
                  </div>
                )}

              {scheduleType === "exam" && extractedEvents.length > 0 && (
                <div className="upload-dialog-preview">
                  <div
                    style={{
                      marginBottom: "var(--spacingVerticalS)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text weight="semibold" size={300}>
                      Extracted Exams Preview
                    </Text>
                    <Badge appearance="tint" color="danger">
                      {extractedEvents.length} Exams
                    </Badge>
                  </div>
                  <EditableItems
                    items={extractedEvents}
                    remove={(id) =>
                      setExtractedEvents(
                        extractedEvents.filter((e) => e.id !== id),
                      )
                    }
                    empty="No exams extracted."
                  />
                </div>
              )}

              {scheduleType === "exam" &&
                file &&
                extractedEvents.length === 0 && (
                  <div
                    style={{
                      padding: "12px",
                      background: "var(--colorNeutralBackground2)",
                      borderRadius: "var(--borderRadiusMedium)",
                      color: "var(--colorNeutralForeground2)",
                    }}
                  >
                    <Text size={200}>
                      Document extraction from images/PDFs requires backend OCR.
                      You can close this dialog and click{" "}
                      <strong>Add Event</strong> in Calendar to enter exams
                      manually.
                    </Text>
                  </div>
                )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={close} disabled={isExtracting}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={
                isExtracting ||
                (scheduleType === "timetable"
                  ? !extractedTimetable.length
                  : !extractedEvents.length)
              }
              onClick={save}
            >
              {isExtracting
                ? "Extracting Schedule..."
                : scheduleType === "timetable"
                ? `Save Timetable (${extractedTimetable.length} Blocks)`
                : `Save ${extractedEvents.length} Exams`}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function CalendarScreen({
  events,
  setEvents,
  timetable,
  setTimetable,
}: {
  events: EventItem[]
  setEvents: React.Dispatch<React.SetStateAction<EventItem[]>>
  timetable: TimetableEntry[]
  setTimetable: React.Dispatch<React.SetStateAction<TimetableEntry[]>>
}) {
  const [open, setOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [draft, setDraft] = useState(emptyEvent)
  const [calendarView, setCalendarView] = useState<"timetable" | "events">(
    "timetable",
  )
  const [selectedDay, setSelectedDay] = useState<string>("Today")
  const [mode, setMode] = useState("Week")
  const [syncing, setSyncing] = useState(false)
  const [syncNotice, setSyncNotice] = useState<{
    text: string
    error?: boolean
  } | null>(null)

  const isConnected =
    isGoogleCalendarConnected() || events.some((e) => e.source === "google")

  const todayDate = new Date()
  const currentDayOfWeek = todayDate.getDay() === 0 ? 7 : todayDate.getDay()
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
  const todayDayName = dayNames[currentDayOfWeek] || "Today"

  const handleImportTimetable = (entries: TimetableEntry[]) => {
    setTimetable(entries)
    saveTimetable(entries)
    setSyncNotice({
      text: `✓ Timetable updated with ${entries.length} merged class blocks. Resolved via Course Catalog.`,
    })
    setTimeout(() => setSyncNotice(null), 5000)
  }

  const handleImportExams = (newItems: EventItem[]) => {
    setEvents((current) => [...current, ...newItems])
    setSyncNotice({
      text: `✓ Added ${newItems.length} exam deadlines to Calendar.`,
    })
    setTimeout(() => setSyncNotice(null), 5000)
  }

  const syncCalendar = async () => {
    setSyncing(true)
    setSyncNotice(null)
    try {
      const sageEvents = events
        .filter((event) => event.source !== "google")
        .map((event) => ({
          localId: event.id,
          externalId: event.externalId || "",
          title: event.title,
          type: event.type,
          date: event.date,
          time: event.time,
          endTime: event.endTime,
        }))
      const result = await syncGoogleCalendarEvents(sageEvents)
      const linkedIds = new Set([
        ...Object.values(result.links),
        ...sageEvents.map((event) => event.externalId).filter(Boolean),
      ])
      const imported = result.importedEvents
        .filter((event) => !linkedIds.has(event.externalId))
        .map((event) => ({
          id: Array.from(event.externalId).reduce(
            (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
            7,
          ),
          title: event.title,
          type: "Personal",
          date: event.date,
          time: event.time,
          endTime: event.endTime,
          source: "google" as const,
          externalId: event.externalId,
        }))
      setEvents((current) => [
        ...current
          .filter((event) => event.source !== "google")
          .map((event) => ({
            ...event,
            externalId: result.links[event.id] || event.externalId,
            source: event.source || "sage" as const,
          })),
        ...imported,
      ])
      setSyncNotice({
        text: `Google Calendar synced (${result.importedEvents.length} events imported)`,
      })
      setTimeout(() => setSyncNotice(null), 4000)
    } catch {
      setSyncNotice({
        text: "Couldn't sync with Google Calendar. Check settings or grant access.",
        error: true,
      })
      setTimeout(() => setSyncNotice(null), 6000)
    } finally {
      setSyncing(false)
    }
  }

  const saveEvent = async () => {
    if (!draft.title) return
    const targetDate = draft.date || getLocalDateString()
    const dayOfWeek = getDayOfWeekFromDate(targetDate)
    const isRecurring = draft.type === "Class"
    const event: EventItem = {
      ...draft,
      id: Date.now(),
      date: isRecurring ? getDayDateForCurrentWeek(dayOfWeek) : targetDate,
      dayOfWeek,
      isRecurring,
      source: "sage",
    }
    setEvents((current) => [...current, event])
    setOpen(false)
    setDraft(emptyEvent)
    const externalId = await pushGoogleCalendarEvent({
      localId: event.id,
      externalId: "",
      title: event.title,
      type: event.type,
      date: event.date,
      time: event.time,
      endTime: event.endTime,
    })
    if (externalId)
      setEvents((current) =>
        current.map((item) =>
          item.id === event.id ? { ...item, externalId } : item,
        ),
      )
  }

  const removeEvent = async (event: EventItem) => {
    await deleteGoogleCalendarEvent(event.externalId)
    setEvents((current) => current.filter((item) => item.id !== event.id))
  }

  // Determine active day filter for timetable
  const activeDayNumber: number | null =
    selectedDay === "Today"
      ? currentDayOfWeek
      : selectedDay === "Monday"
        ? 1
        : selectedDay === "Tuesday"
          ? 2
          : selectedDay === "Wednesday"
            ? 3
            : selectedDay === "Thursday"
              ? 4
              : selectedDay === "Friday"
                ? 5
                : null // All Week

  const daysToShow =
    activeDayNumber !== null ? [activeDayNumber] : [1, 2, 3, 4, 5]

  return (
    <>
      <PageHeading
        eyebrow="ACADEMIC CONTEXT"
        title="Calendar & Timetable"
        subtitle="Your complete weekly class timetable, exams, deadlines, and personal schedule."
        action={
          <div className="button-row">
            <Button
              appearance="secondary"
              icon={<Book20Regular />}
              onClick={() => setUploadOpen(true)}
            >
              Upload Timetable
            </Button>
            <Button
              appearance="secondary"
              icon={<CalendarLtr20Regular />}
              disabled={syncing}
              onClick={syncCalendar}
            >
              {syncing
                ? "Syncing…"
                : isConnected
                  ? "Sync Google Calendar"
                  : "Connect Google Calendar"}
            </Button>
            <Button
              appearance="subtle"
              onClick={() =>
                window.open(
                  "https://calendar.google.com/",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              Open Google Calendar
            </Button>
            <Button
              appearance="primary"
              icon={<Add20Regular />}
              onClick={() => setOpen(true)}
            >
              Add Event
            </Button>
          </div>
        }
      />

      {syncNotice && (
        <div
          className={`connection-message ${
            syncNotice.error ? "error" : "success"
          }`}
          style={{ marginBottom: "var(--spacingVerticalM)" }}
        >
          {syncNotice.error ? <Alert20Regular /> : <CheckmarkCircle20Filled />}
          <Text weight="semibold">{syncNotice.text}</Text>
        </div>
      )}

      {/* Main Calendar Navigation */}
      <TabList
        selectedValue={calendarView}
        onTabSelect={(_, data) =>
          setCalendarView(data.value as "timetable" | "events")
        }
        style={{ marginBottom: "var(--spacingVerticalM)" }}
      >
        <Tab value="timetable">Class Schedule ({timetable.length} Blocks)</Tab>
        <Tab value="events">Exams & Deadlines ({events.length})</Tab>
      </TabList>

      {/* TAB 1: CLASS SCHEDULE (TIMETABLE) */}
      {calendarView === "timetable" && (
        <Card className="content-card">
          <div className="timetable-info-banner">
            <Book20Regular />
            <Text size={200}>
              Timetable classes are background academic context (Informational
              only · No notification fatigue). College periods are 50 minutes
              starting at 8:10 AM. Consecutive periods are merged into single
              class blocks.
            </Text>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "var(--spacingVerticalM)",
            }}
          >
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[
                "Today",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "All Week",
              ].map((day) => (
                <Button
                  key={day}
                  appearance={selectedDay === day ? "primary" : "secondary"}
                  size="small"
                  onClick={() => setSelectedDay(day)}
                >
                  {day === "Today" ? `Today (${todayDayName})` : day}
                </Button>
              ))}
            </div>
            <Button
              appearance="subtle"
              size="small"
              icon={<Book20Regular />}
              onClick={() => setUploadOpen(true)}
            >
              Update Timetable
            </Button>
          </div>

          {timetable.length === 0 ? (
            <EmptyState
              icon={<Book20Regular />}
              title="No timetable loaded yet"
              copy="Upload your timetable image or schedule to view your resolved class blocks and periods."
              action={
                <Button
                  appearance="primary"
                  onClick={() => setUploadOpen(true)}
                >
                  Upload Timetable
                </Button>
              }
            />
          ) : (
            <div className="timetable-schedule-container">
              {daysToShow.map((dayNum) => {
                const dayClasses = getClassesForDay(timetable, dayNum)
                const dayName = dayNames[dayNum]
                const isCurrentToday = dayNum === currentDayOfWeek

                return (
                  <div
                    key={dayNum}
                    style={{ marginBottom: "var(--spacingVerticalL)" }}
                  >
                    <div className="timetable-day-header">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Text as="h3" size={500} weight="semibold">
                          {selectedDay === "Today"
                            ? `TODAY'S CLASSES · ${dayName.toUpperCase()}`
                            : `${dayName.toUpperCase()}'S CLASSES`}
                        </Text>
                        {isCurrentToday && (
                          <Badge appearance="tint" color="brand">
                            Today
                          </Badge>
                        )}
                      </div>
                      <Text
                        size={200}
                        style={{ color: "var(--colorNeutralForeground3)" }}
                      >
                        {dayClasses.length}{" "}
                        {dayClasses.length === 1
                          ? "class block"
                          : "class blocks"}
                      </Text>
                    </div>

                    {dayClasses.length === 0 ? (
                      <div
                        style={{
                          padding: "16px 0",
                          color: "var(--colorNeutralForeground3)",
                          fontStyle: "italic",
                          fontSize: "14px",
                        }}
                      >
                        No classes scheduled for {dayName}. Focused time for
                        studying or project work.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {dayClasses.map((cls) => (
                          <div className="timetable-row" key={cls.id}>
                            <div className="timetable-time-block">
                              <Text
                                weight="semibold"
                                style={{
                                  fontSize: "15px",
                                  color: "var(--colorNeutralForeground1)",
                                }}
                              >
                                {formatTimeRange(cls.startTime, cls.endTime)}
                              </Text>
                              <span
                                className="period-chip"
                                style={{
                                  marginTop: "4px",
                                  width: "fit-content",
                                }}
                              >
                                {cls.startPeriod === cls.endPeriod
                                  ? `Period ${cls.startPeriod}`
                                  : `Periods ${cls.startPeriod}–${cls.endPeriod}`}
                              </span>
                            </div>

                            <div className="timetable-main">
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <Text
                                  weight="semibold"
                                  size={400}
                                  style={{
                                    fontSize: "16px",
                                    color: "var(--colorNeutralForeground1)",
                                  }}
                                >
                                  {cls.courseName}
                                </Text>
                                <span className="course-code-pill">
                                  {cls.courseCode}
                                </span>
                                {!cls.isKnownCourse && (
                                  <span className="unavailable-note">
                                    Course name unavailable
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  marginTop: "4px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {cls.location && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "13px",
                                      color: "var(--colorNeutralForeground2)",
                                    }}
                                  >
                                    <Location20Regular
                                      style={{ fontSize: "14px" }}
                                    />
                                    {cls.location}
                                  </span>
                                )}
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--colorNeutralForeground3)",
                                  }}
                                >
                                  {cls.dayName} · Recurring weekly ·
                                  Informational
                                </span>
                              </div>
                            </div>

                            <div
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexShrink: 0,
                              }}
                            >
                              <Badge appearance="tint" color="informative">
                                Informational
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: EXAMS & DEADLINES */}
      {calendarView === "events" && (
        <Card className="content-card">
          <TabList
            selectedValue={mode}
            onTabSelect={(_, data) => setMode(String(data.value))}
          >
            <Tab value="Day">Day</Tab>
            <Tab value="Week">Week</Tab>
          </TabList>
          <div className="calendar-list">
            <div className="calendar-legend">
              <span>
                <i className="fixed-dot" />
                Fixed commitment
              </span>
              <span>
                <i className="study-dot" />
                Planned study
              </span>
              <span>
                <i className="deadline-dot" />
                Deadline / Exam
              </span>
            </div>
            {events.length ? (
              [...events]
                .sort((a, b) =>
                  `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
                )
                .map((event) => (
                  <div className="calendar-list-row" key={event.id}>
                    <div
                      className={`date-block ${event.type.toLowerCase().replace(" ", "-")}`}
                    >
                      <Text weight="semibold">
                        {formatShortDate(event.date) || event.date || "No date"}
                      </Text>
                      <Text size={200}>
                        {event.time}
                        {event.endTime ? ` – ${event.endTime}` : ""}
                      </Text>
                    </div>
                    <div className="task-main">
                      <Text weight="semibold">{event.title}</Text>
                      <Text size={200}>
                        <Badge
                          appearance="tint"
                          color={event.type === "Exam" ? "danger" : "brand"}
                        >
                          {event.type}
                        </Badge>
                        {event.source === "google"
                          ? " · Google Calendar"
                          : event.externalId
                            ? " · SAGE · Synced to Google"
                            : ""}
                        {event.endTime ? ` · until ${event.endTime}` : ""}
                      </Text>
                    </div>
                    <div
                      className="button-row"
                      style={{ marginLeft: "auto", flexShrink: 0 }}
                    >
                      <Button
                        appearance="subtle"
                        size="small"
                        title="Add to personal Google Calendar"
                        onClick={() => openInGoogleCalendar(event)}
                      >
                        Add to GCal
                      </Button>
                      <Button
                        appearance="subtle"
                        icon={<Delete20Regular />}
                        onClick={() => removeEvent(event)}
                        aria-label={`Delete ${event.title}`}
                      />
                    </div>
                  </div>
                ))
            ) : (
              <EmptyState
                icon={<CalendarLtr20Regular />}
                title="No exams or deadlines scheduled"
                copy="Add an exam or deadline with the Add Event button above."
                action={
                  <Button appearance="primary" onClick={() => setOpen(true)}>
                    Add Event
                  </Button>
                }
              />
            )}
          </div>
        </Card>
      )}

      <Dialog open={open}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Add calendar event</DialogTitle>
            <DialogContent>
              <div className="form-grid">
                <Label className="full-field">
                  Title
                  <Input
                    value={draft.title}
                    onChange={(_, data) =>
                      setDraft({ ...draft, title: data.value })
                    }
                  />
                </Label>
                <Label>
                  Type
                  <Dropdown
                    value={draft.type}
                    onOptionSelect={(_, data) =>
                      setDraft({ ...draft, type: String(data.optionValue) })
                    }
                  >
                    {["Exam", "Assignment", "Study Session", "Personal"].map(
                      (item) => (
                        <Option key={item}>{item}</Option>
                      ),
                    )}
                  </Dropdown>
                </Label>
                <Label>
                  Date
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(_, data) =>
                      setDraft({ ...draft, date: data.value })
                    }
                  />
                </Label>
                <Label>
                  Start
                  <Input
                    type="time"
                    value={draft.time}
                    onChange={(_, data) =>
                      setDraft({ ...draft, time: data.value })
                    }
                  />
                </Label>
                <Label>
                  End
                  <Input
                    type="time"
                    value={draft.endTime}
                    onChange={(_, data) =>
                      setDraft({ ...draft, endTime: data.value })
                    }
                  />
                </Label>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={!draft.title}
                onClick={saveEvent}
              >
                Save event
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {uploadOpen && (
        <UploadScheduleDialog
          open={uploadOpen}
          close={() => setUploadOpen(false)}
          onImportTimetable={handleImportTimetable}
          onImportEvents={handleImportExams}
        />
      )}
    </>
  )
}

function ContestsScreen({
  platforms,
  setPlatforms,
  reminders,
  setReminders,
}: {
  platforms: string[]
  setPlatforms: React.Dispatch<React.SetStateAction<string[]>>
  reminders: Reminder[]
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>
}) {
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [platformFilter, setPlatformFilter] = useState("All Platforms")
  const [statusFilter, setStatusFilter] = useState("Upcoming/Ongoing")
  const [dateFilter, setDateFilter] = useState("")
  const [search, setSearch] = useState("")
  const [success, setSuccess] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!platforms.length) return
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    fetch("/api/contests", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("unavailable")
        return response.json() as Promise<{ contests: Contest[] }>
      })
      .then((data) => setContests(data.contests))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setFailed(true)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [platforms.length, retry])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const relevant = contests
    .filter((contest) => platforms.includes(contest.platform))
    .filter(
      (contest) =>
        platformFilter === "All Platforms" ||
        contest.platform === platformFilter,
    )
    .filter(
      (contest) =>
        statusFilter === "All statuses" ||
        (statusFilter === "Upcoming/Ongoing"
          ? contest.status !== "ended"
          : contest.status === statusFilter.toLowerCase()),
    )
    .filter(
      (contest) => !dateFilter || contest.startTime.slice(0, 10) === dateFilter,
    )
    .filter((contest) =>
      contest.name.toLowerCase().includes(search.toLowerCase()),
    )

  const startingSoon = (contest: Contest) =>
    contest.status === "upcoming" &&
    new Date(contest.startTime).getTime() - now <= 24 * 60 * 60 * 1000
  const groups = [
    ["Live Now", relevant.filter((contest) => contest.status === "ongoing")],
    ["Starting Soon", relevant.filter(startingSoon)],
    [
      "Upcoming",
      relevant.filter(
        (contest) => contest.status === "upcoming" && !startingSoon(contest),
      ),
    ],
    [
      "Recently Ended",
      relevant.filter((contest) => contest.status === "ended"),
    ],
  ] as const

  const durationLabel = (seconds: number) => {
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
  }
  const countdown = (contest: Contest) => {
    const difference = new Date(contest.startTime).getTime() - now
    if (difference <= 0)
      return contest.status === "ongoing" ? "Live now" : "Contest ended"
    const minutes = Math.floor(difference / 60000)
    const days = Math.floor(minutes / 1440)
    const hours = Math.floor((minutes % 1440) / 60)
    return days
      ? `Starts in ${days}d ${hours}h`
      : `Starts in ${hours}h ${minutes % 60}m`
  }
  const reminderLabel: Record<string, string> = {
    "10m": "10 minutes before",
    "30m": "30 minutes before",
    "1h": "1 hour before",
    "2h": "2 hours before",
    "1d": "1 day before",
  }
  const handleSetReminder = (contest: Contest, timingStr: string) => {
    const timing = (timingStr || "1h") as ReminderTiming
    setReminders((current) => {
      const updated = upsertContestReminder(current, contest, timing)
      const target = updated.find(
        (r) =>
          (r.targetType === "contest" && String(r.targetId) === String(contest.id)) ||
          r.contestId === contest.id,
      )
      if (target) {
        syncReminderToBackend(target).catch(() => {})
      }
      return updated
    })
    setSuccess(true)
    window.setTimeout(() => setSuccess(false), 2400)
  }

  const handleRemoveReminder = (contestId: string) => {
    setReminders((current) => removeContestReminder(current, contestId))
    deleteBackendReminder(contestId).catch(() => {})
  }

  if (!platforms.length)
    return (
      <>
        <PageHeading
          eyebrow="COMPETE & LEARN"
          title="Upcoming Contests"
          subtitle="Keep track of coding contests from the platforms you follow."
        />
        <Card className="content-card contest-state">
          <EmptyState
            icon={<Code20Regular />}
            title="Choose the coding platforms you follow to personalize your contests."
            copy="Select platforms only—no handles, links, or credentials are needed."
            action={
              <div className="platform-grid compact-platforms">
                {platformOptions.map((platform) => (
                  <Button
                    appearance="secondary"
                    key={platform}
                    onClick={() => setPlatforms((list) => [...list, platform])}
                  >
                    {platform}
                  </Button>
                ))}
              </div>
            }
          />
        </Card>
      </>
    )

  return (
    <>
      <PageHeading
        eyebrow="COMPETE & LEARN"
        title="Upcoming Contests"
        subtitle="Keep track of coding contests from the platforms you follow."
        action={
          <Button
            appearance="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Refresh
          </Button>
        }
      />
      {success && (
        <Card className="contest-success">
          <CheckmarkCircle20Filled />
          <Text weight="semibold">Your contest reminder is set.</Text>
        </Card>
      )}
      <Card className="contest-controls">
        <Dropdown
          value={platformFilter}
          onOptionSelect={(_, data) =>
            setPlatformFilter(String(data.optionValue))
          }
          aria-label="Filter by platform"
        >
          <Option>All Platforms</Option>
          {platforms.map((platform) => (
            <Option key={platform}>{platform}</Option>
          ))}
        </Dropdown>
        <Input
          type="date"
          value={dateFilter}
          onChange={(_, data) => setDateFilter(data.value)}
          aria-label="Filter by date"
        />
        <Dropdown
          value={statusFilter}
          onOptionSelect={(_, data) =>
            setStatusFilter(String(data.optionValue))
          }
          aria-label="Filter by contest status"
        >
          <Option>Upcoming/Ongoing</Option>
          <Option>Upcoming</Option>
          <Option>Ongoing</Option>
          <Option>Ended</Option>
          <Option>All statuses</Option>
        </Dropdown>
        <Input
          contentBefore={<Search20Regular />}
          placeholder="Search contests"
          value={search}
          onChange={(_, data) => setSearch(data.value)}
          aria-label="Search contests"
        />
      </Card>
      {loading ? (
        <Card className="content-card contest-state">
          <div className="loading-state">
            <div className="loading-ring" />
            <Text as="span" size={500} weight="semibold">
              Loading upcoming contests…
            </Text>
          </div>
        </Card>
      ) : failed ? (
        <Card className="content-card contest-state">
          <EmptyState
            icon={<Alert20Regular />}
            title="Contest information is temporarily unavailable."
            copy="Please try again in a moment."
            action={
              <Button
                appearance="primary"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try Again
              </Button>
            }
          />
        </Card>
      ) : relevant.length === 0 ? (
        <Card className="content-card contest-state">
          <EmptyState
            icon={<Code20Regular />}
            title="No upcoming contests"
            copy="New contests will appear here when they become available."
          />
        </Card>
      ) : (
        <div className="contest-sections">
          {groups.map(
            ([title, items]) =>
              items.length > 0 && (
                <section key={title}>
                  <SectionTitle
                    title={title}
                    eyebrow={`${items.length} ${
                      items.length === 1 ? "CONTEST" : "CONTESTS"
                    }`}
                  />
                  <div className="contest-list">
                    {items.map((contest) => {
                      const reminder = findContestReminder(
                        reminders,
                        contest.id,
                      )
                      const start = new Date(contest.startTime)
                      return (
                        <Card
                          className={`contest-card ${
                            contest.status === "ended" ? "ended" : ""
                          }`}
                          key={contest.id}
                        >
                          <div className="platform-mark">
                            {contest.platform.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="contest-main">
                            <div className="contest-heading">
                              <Text size={200}>{contest.platform}</Text>
                              <Badge
                                appearance="tint"
                                color={
                                  contest.status === "ongoing"
                                    ? "success"
                                    : contest.status === "ended"
                                      ? "subtle"
                                      : "brand"
                                }
                              >
                                {contest.status === "ongoing"
                                  ? "Live now"
                                  : contest.status === "ended"
                                    ? "Contest ended"
                                    : "Upcoming"}
                              </Badge>
                            </div>
                            <Text as="span" size={500} weight="semibold">
                              {contest.name}
                            </Text>
                            <div className="task-meta">
                              <span>
                                <CalendarLtr20Regular />
                                {start.toLocaleDateString([], {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <span>
                                <Clock20Regular />
                                {start.toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span>{durationLabel(contest.duration)}</span>
                              <span>{countdown(contest)}</span>
                            </div>
                          </div>
                          <div className="contest-actions">
                            {reminder ? (
                              <div className="reminder-set">
                                <Text size={200}>
                                  Reminder:{" "}
                                  {TIMING_LABELS[reminder.notificationTiming] ||
                                    reminderLabel[
                                      reminder.notificationTiming
                                    ] ||
                                    reminder.notificationTiming}
                                </Text>
                                <div>
                                  <Dropdown
                                    placeholder="Change"
                                    value={
                                      TIMING_LABELS[reminder.notificationTiming]
                                    }
                                    onOptionSelect={(_, data) =>
                                      handleSetReminder(
                                        contest,
                                        String(data.optionValue),
                                      )
                                    }
                                    aria-label={`Change reminder for ${contest.name}`}
                                  >
                                    <Option value="10m">
                                      10 minutes before
                                    </Option>
                                    <Option value="30m">
                                      30 minutes before
                                    </Option>
                                    <Option value="1h">1 hour before</Option>
                                    <Option value="2h">2 hours before</Option>
                                    <Option value="1d">1 day before</Option>
                                  </Dropdown>
                                  <Button
                                    appearance="subtle"
                                    onClick={() =>
                                      handleRemoveReminder(contest.id)
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              contest.status !== "ended" && (
                                <Dropdown
                                  placeholder="Remind me"
                                  onOptionSelect={(_, data) =>
                                    handleSetReminder(
                                      contest,
                                      String(data.optionValue),
                                    )
                                  }
                                  aria-label={`Remind me about ${contest.name}`}
                                >
                                  <Option value="10m">10 minutes before</Option>
                                  <Option value="30m">30 minutes before</Option>
                                  <Option value="1h">1 hour before</Option>
                                  <Option value="2h">2 hours before</Option>
                                  <Option value="1d">1 day before</Option>
                                </Dropdown>
                              )
                            )}
                            <Button
                              appearance={
                                contest.status === "ongoing"
                                  ? "primary"
                                  : "secondary"
                              }
                              disabled={!contest.url}
                              onClick={() =>
                                window.open(
                                  contest.url,
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              Join Contest
                            </Button>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </>
  )
}

function RemindersScreen({
  reminders,
  setReminders,
}: {
  reminders: Reminder[]
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>
}) {
  const todayStr = getLocalDateString()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] =
    useState<"Today" | "Upcoming" | "Completed">("Today")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<{
    title: string
    date: string
    time: string
    timing: ReminderTiming
    method: string
  }>({
    title: "",
    date: todayStr,
    time: "09:00",
    timing: "exact",
    method: "Email + In-app",
  })

  const activeReminders = reminders.filter(
    (r) => r.status !== "completed" && !r.dismissed,
  )
  const completedReminders = reminders.filter(
    (r) => r.status === "completed" || r.dismissed,
  )

  const todayReminders = activeReminders.filter(
    (r) => !r.date || r.date <= todayStr,
  )
  const upcomingReminders = activeReminders.filter(
    (r) => r.date && r.date > todayStr,
  )

  const displayedReminders =
    activeTab === "Today"
      ? todayReminders
      : activeTab === "Upcoming"
        ? upcomingReminders
        : completedReminders

  const handleOpenNew = () => {
    setEditingId(null)
    const now = new Date()
    const defaultHour = String((now.getHours() + 1) % 24).padStart(2, "0")
    setDraft({
      title: "",
      date: todayStr,
      time: `${defaultHour}:00`,
      timing: "exact",
      method: "Email + In-app",
    })
    setOpen(true)
  }

  const handleEdit = (r: Reminder) => {
    setEditingId(r.id)
    const validTime = /^\d{1,2}:\d{2}$/.test(r.time) ? r.time : "09:00"
    setDraft({
      title: r.title,
      date: r.date || todayStr,
      time: validTime,
      timing: r.notificationTiming || "exact",
      method: r.method || "Email + In-app",
    })
    setOpen(true)
  }

  const handleSave = () => {
    if (!draft.title.trim()) return
    const dueAt = buildDueAtTimestamp(draft.date, draft.time)
    if (editingId) {
      let updatedObj: Reminder | null = null
      setReminders((list) => {
        const next = list.map((r) => {
          if (r.id === editingId) {
            updatedObj = normalizeReminder({
              ...r,
              title: draft.title.trim(),
              date: draft.date,
              time: draft.time,
              dueAt,
              notificationTiming: draft.timing,
              method: draft.method,
              status: "open",
              snoozedUntil: undefined,
              notifiedAt: undefined,
              read: false,
              dismissed: false,
            })
            return updatedObj
          }
          return r
        })
        saveReminders(next)
        return next
      })
      if (updatedObj) {
        syncReminderToBackend(updatedObj).catch(() => {})
      }
    } else {
      const newReminder = normalizeReminder({
        id: Date.now(),
        title: draft.title.trim(),
        date: draft.date,
        time: draft.time,
        dueAt,
        createdAt: new Date().toISOString(),
        notificationTiming: draft.timing,
        method: draft.method,
        status: "open",
        read: false,
        dismissed: false,
      })
      setReminders((list) => {
        const next = [...list, newReminder]
        saveReminders(next)
        return next
      })
      syncReminderToBackend(newReminder).catch(() => {})
    }
    setOpen(false)
    setEditingId(null)
  }

  const handleComplete = (id: number) => {
    const completedAtIso = new Date().toISOString()
    setReminders((list) => {
      const next = list.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "completed" as const,
              completedAt: completedAtIso,
              read: true,
            }
          : r,
      )
      saveReminders(next)
      return next
    })
    updateBackendReminderStatus(id, {
      status: "completed",
      completedAt: completedAtIso,
    }).catch(() => {})
  }

  const handleReopen = (id: number) => {
    setReminders((list) => {
      const next = list.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "open" as const,
              dismissed: false,
              completedAt: undefined,
              notifiedAt: undefined,
              read: false,
            }
          : r,
      )
      saveReminders(next)
      return next
    })
    updateBackendReminderStatus(id, { status: "open" }).catch(() => {})
  }

  const handleSnooze = (id: number) => {
    const d = new Date()
    d.setHours(d.getHours() + 1)
    let nextDate = getLocalDateString(d)
    let nextTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

    if (d.getHours() >= 22 || d.getHours() < 6) {
      const tmrw = new Date()
      tmrw.setDate(tmrw.getDate() + 1)
      nextDate = getLocalDateString(tmrw)
      nextTime = "09:00"
    }

    const snoozedUntilIso = new Date(`${nextDate}T${nextTime}:00`).toISOString()

    setReminders((list) => {
      const next = list.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "snoozed" as const,
              date: nextDate,
              time: nextTime,
              snoozedUntil: snoozedUntilIso,
              notifiedAt: undefined,
              read: true,
            }
          : r,
      )
      saveReminders(next)
      return next
    })
    updateBackendReminderStatus(id, {
      status: "snoozed",
      snoozedUntil: snoozedUntilIso,
    }).catch(() => {})
  }

  const handleDelete = (id: number) => {
    setReminders((list) => {
      const target = list.find((r) => r.id === id)
      let next: Reminder[]
      if (target?.status === "completed" || target?.dismissed) {
        next = list.filter((r) => r.id !== id)
      } else {
        next = list.map((r) =>
          r.id === id ? { ...r, dismissed: true, read: true } : r,
        )
      }
      saveReminders(next)
      return next
    })
    deleteBackendReminder(id).catch(() => {})
  }

  return (
    <>
      <PageHeading
        eyebrow="STAY AHEAD"
        title="Reminders"
        subtitle="Manage your own reminders and nudges connected to tasks, exams, and contests."
        action={
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={handleOpenNew}
          >
            New Reminder
          </Button>
        }
      />
      <Card className="content-card large-card">
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, d) =>
            setActiveTab(d.value as "Today" | "Upcoming" | "Completed")
          }
        >
          <Tab value="Today">Today ({todayReminders.length})</Tab>
          <Tab value="Upcoming">Upcoming ({upcomingReminders.length})</Tab>
          <Tab value="Completed">Completed ({completedReminders.length})</Tab>
        </TabList>

        {displayedReminders.length ? (
          <div
            className="review-list"
            style={{
              marginTop: "var(--spacingVerticalM)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {displayedReminders.map((r) => {
              const triggerMs = getReminderTriggerTime(r)
              const visual = getReminderVisualInfo(
                triggerMs,
                r.date,
                r.time,
                r.status,
                r.method,
              )
              const isCompleted = r.status === "completed"
              const isSnoozed = r.status === "snoozed"

              return (
                <div className="reminder-row" key={r.id}>
                  <div
                    className="reminder-icon"
                    style={{
                      background: isCompleted
                        ? "var(--colorPaletteGreenBackground2)"
                        : isSnoozed
                          ? "var(--colorPaletteBerryBackground2)"
                          : visual.isTriggered
                            ? "var(--colorPaletteRedBackground1)"
                            : undefined,
                      color: isCompleted
                        ? "var(--colorPaletteGreenForeground1)"
                        : isSnoozed
                          ? "var(--colorPaletteBerryForeground1)"
                          : visual.isTriggered
                            ? "var(--colorPaletteRedForeground1)"
                            : undefined,
                    }}
                  >
                    {isCompleted ? (
                      <CheckmarkCircle20Filled />
                    ) : visual.isTriggered ? (
                      <Alert20Regular />
                    ) : (
                      <Clock20Regular />
                    )}
                  </div>
                  <div className="task-main">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <Text weight="semibold" strikethrough={isCompleted}>
                        {r.title}
                      </Text>
                      {r.targetType === "contest" && (
                        <Badge appearance="tint" color="brand">
                          {r.platform || "Contest"}
                        </Badge>
                      )}
                      <div className={`reminder-timing-pill ${visual.urgencyColor}`}>
                        <Clock20Regular />
                        <span>{visual.statusBadge}</span>
                      </div>
                      {r.notificationTiming &&
                        r.notificationTiming !== "exact" && (
                          <Badge appearance="tint" color="informative">
                            🔔 {TIMING_LABELS[r.notificationTiming] || ""}
                          </Badge>
                        )}
                      {r.dismissed && (
                        <Badge appearance="tint" color="subtle">
                          Dismissed
                        </Badge>
                      )}
                    </div>
                    <Text
                      size={200}
                      style={{ color: "var(--colorNeutralForeground3)", marginTop: "2px" }}
                    >
                      {r.targetType === "contest" && r.eventStartTime ? (
                        <>
                          <strong>Contest starts:</strong>{" "}
                          {new Date(r.eventStartTime).toLocaleString([], {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          · <strong>Notification scheduled:</strong> {visual.formattedDate} at {visual.formattedTime} · Delivery: {r.method}
                        </>
                      ) : (
                        <>
                          <strong>Scheduled alert:</strong> {visual.formattedDate} at {visual.formattedTime}{" "}
                          ({visual.countdownText}) · Delivery: {r.method}
                        </>
                      )}
                    </Text>
                    {r.contestUrl && (
                      <div style={{ marginTop: "4px" }}>
                        <a
                          href={r.contestUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                            color: "var(--colorBrandForeground1)",
                            textDecoration: "none",
                          }}
                        >
                          <Open20Regular style={{ fontSize: "14px" }} />
                          View Contest
                        </a>
                      </div>
                    )}
                  </div>
                  <div
                    className="button-row"
                    style={{ marginLeft: "auto", flexShrink: 0 }}
                  >
                    {!isCompleted ? (
                      <>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<CheckmarkCircle20Regular />}
                          onClick={() => handleComplete(r.id)}
                        >
                          Complete
                        </Button>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Clock20Regular />}
                          onClick={() => handleSnooze(r.id)}
                        >
                          Snooze +1h
                        </Button>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Edit20Regular />}
                          onClick={() => handleEdit(r)}
                        >
                          Edit
                        </Button>
                      </>
                    ) : (
                      <Button
                        appearance="subtle"
                        size="small"
                        onClick={() => handleReopen(r.id)}
                      >
                        Mark Active
                      </Button>
                    )}
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Dismiss20Regular />}
                      onClick={() => handleDelete(r.id)}
                    >
                      {isCompleted ? "Remove" : "Dismiss"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Alert20Regular />}
            title={
              activeTab === "Today"
                ? "No reminders due today."
                : activeTab === "Upcoming"
                  ? "No upcoming reminders scheduled."
                  : "No completed reminders."
            }
            copy={
              activeTab === "Completed"
                ? "Completed reminders will appear here for your records."
                : "Create a reminder or schedule nudges for your academic work."
            }
            action={
              activeTab !== "Completed" && (
                <Button
                  appearance="primary"
                  icon={<Add20Regular />}
                  onClick={handleOpenNew}
                >
                  Create reminder
                </Button>
              )
            }
          />
        )}
      </Card>

      <Dialog open={open}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {editingId ? "Edit reminder" : "New reminder"}
            </DialogTitle>
            <DialogContent>
              <div className="form-grid">
                <Label className="full-field">
                  Reminder
                  <Input
                    value={draft.title}
                    onChange={(_, d) => setDraft({ ...draft, title: d.value })}
                    placeholder="e.g. Submit CS3105 lab report"
                  />
                </Label>
                <Label>
                  Date
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(_, d) => setDraft({ ...draft, date: d.value })}
                  />
                </Label>
                <Label>
                  Time
                  <Input
                    type="time"
                    value={draft.time}
                    onChange={(_, d) => setDraft({ ...draft, time: d.value })}
                  />
                </Label>
                <div className="quick-preset-chips">
                  <span className="quick-chip-label">Quick set:</span>
                  <button
                    type="button"
                    className="quick-chip"
                    onClick={() => {
                      const d = new Date()
                      d.setHours(d.getHours() + 1)
                      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                      const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
                      setDraft({ ...draft, date: ymd, time: hm })
                    }}
                  >
                    In 1 hour
                  </button>
                  <button
                    type="button"
                    className="quick-chip"
                    onClick={() => {
                      const d = new Date()
                      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                      setDraft({ ...draft, date: ymd, time: "20:00" })
                    }}
                  >
                    Tonight (8:00 PM)
                  </button>
                  <button
                    type="button"
                    className="quick-chip"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 1)
                      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                      setDraft({ ...draft, date: ymd, time: "09:00" })
                    }}
                  >
                    Tomorrow (9:00 AM)
                  </button>
                </div>
                {draft.date && (
                  <div className="deadline-preview-banner brand">
                    <Clock20Regular />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text weight="semibold" size={200}>
                        Alert scheduled for: {formatFriendlyDate(draft.date)} at {formatTime12(draft.time)}
                      </Text>
                      <Text size={100} style={{ display: "block", opacity: 0.85 }}>
                        {draft.timing === "exact"
                          ? "Triggers at the exact time"
                          : `${TIMING_LABELS[draft.timing] || "Before event"}`}{" "}
                        · Delivery via {draft.method}
                      </Text>
                    </div>
                  </div>
                )}
                <Label>
                  Reminder timing
                  <Dropdown
                    value={TIMING_LABELS[draft.timing] || "At time of event"}
                    onOptionSelect={(_, d) => {
                      const found = (Object.keys(
                        TIMING_LABELS,
                      ) as ReminderTiming[]).find(
                        (k) => TIMING_LABELS[k] === String(d.optionValue),
                      )
                      if (found) setDraft({ ...draft, timing: found })
                    }}
                  >
                    {(Object.keys(TIMING_LABELS) as ReminderTiming[]).map(
                      (k) => (
                        <Option key={k}>{TIMING_LABELS[k]}</Option>
                      ),
                    )}
                  </Dropdown>
                </Label>
                <Label className="full-field">
                  Notification method
                  <Dropdown
                    value={draft.method}
                    onOptionSelect={(_, d) =>
                      setDraft({ ...draft, method: String(d.optionValue) })
                    }
                  >
                    <Option>In-app</Option>
                    <Option>Email</Option>
                    <Option>Email + In-app</Option>
                  </Dropdown>
                </Label>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={!draft.title.trim()}
                onClick={handleSave}
              >
                {editingId ? "Save changes" : "Save reminder"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  )
}

function ProgressScreen({
  tasks,
  goals,
  events,
  focusSessions,
  preferences,
}: {
  tasks: Task[]
  goals: Goal[]
  events: EventItem[]
  focusSessions: FocusSessionRecord[]
  preferences: UserPreferences
}) {
  const completedTasks = tasks.filter((x) => x.status === "completed")
  const completedSessions = focusSessions.filter(
    (s) => s.status === "completed",
  )

  // Real focus minutes
  const totalFocusMinutes = completedSessions.reduce(
    (sum, s) => sum + (s.actualDuration || 0),
    0,
  )
  const todayStr = getLocalDateString()
  const todayFocusMinutes = completedSessions
    .filter((s) => s.completedAt.startsWith(todayStr))
    .reduce((sum, s) => sum + (s.actualDuration || 0), 0)

  const targetHours = parseInt(preferences.target, 10) || 2
  const targetMinutes = targetHours * 60

  // Real streak calculation strictly from session dates
  const sessionDates = new Set(
    completedSessions
      .filter((s) => s.actualDuration > 0)
      .map((s) => s.completedAt.slice(0, 10)),
  )

  let streak = 0
  if (sessionDates.size > 0) {
    const today = new Date()
    const todayDateStr = getLocalDateString(today)
    const yesterdayDateStr = getOffsetDateString(-1, today)

    if (sessionDates.has(todayDateStr) || sessionDates.has(yesterdayDateStr)) {
      let checkDate = sessionDates.has(todayDateStr)
        ? today
        : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      while (sessionDates.has(getLocalDateString(checkDate))) {
        streak++
        checkDate = new Date(
          checkDate.getFullYear(),
          checkDate.getMonth(),
          checkDate.getDate() - 1,
        )
      }
    }
  }

  // Real goal milestones
  const milestoneTotal = goals.reduce((sum, g) => sum + g.milestones.length, 0)
  const milestoneDone = goals.reduce((sum, g) => sum + g.completed, 0)

  const focusTimeDisplay =
    totalFocusMinutes === 0
      ? "0m"
      : totalFocusMinutes < 60
        ? `${totalFocusMinutes}m`
        : `${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`

  const focusTimeSubtext =
    totalFocusMinutes === 0
      ? "Complete a focus session to start tracking"
      : `${todayFocusMinutes}m today against ${targetHours}h daily target`

  const focusTimeProgress =
    totalFocusMinutes === 0 ? 0 : Math.min(1, todayFocusMinutes / targetMinutes)

  const tasksDisplay = String(completedTasks.length)
  const tasksSubtext =
    tasks.length === 0
      ? "No tasks created yet"
      : `${completedTasks.length} of ${tasks.length} total tasks`
  const tasksProgress =
    tasks.length === 0 ? 0 : completedTasks.length / tasks.length

  const goalDisplay =
    milestoneTotal === 0
      ? "—"
      : `${Math.round((milestoneDone / milestoneTotal) * 100)}%`
  const goalSubtext =
    milestoneTotal === 0
      ? "Add milestones to calculate progress"
      : `${milestoneDone} of ${milestoneTotal} milestones`
  const goalProgress = milestoneTotal === 0 ? 0 : milestoneDone / milestoneTotal

  const consistencyDisplay =
    sessionDates.size === 0 ? "—" : `${streak} day${streak === 1 ? "" : "s"}`
  const consistencySubtext =
    sessionDates.size === 0
      ? "Complete study sessions to build your rhythm"
      : streak === 0
        ? "No sessions in the last 24 hours"
        : `${sessionDates.size} active study day${
            sessionDates.size === 1 ? "" : "s"
          } recorded`
  const consistencyProgress = streak === 0 ? 0 : Math.min(1, streak / 7)

  const metrics = [
    ["Focus time", focusTimeDisplay, focusTimeSubtext, focusTimeProgress],
    ["Tasks completed", tasksDisplay, tasksSubtext, tasksProgress],
    ["Goal progress", goalDisplay, goalSubtext, goalProgress],
    [
      "Study consistency",
      consistencyDisplay,
      consistencySubtext,
      consistencyProgress,
    ],
  ] as const

  // Course progress
  const coursesWithTasks = [
    ...new Set(tasks.map((x) => x.course).filter(Boolean)),
  ]

  return (
    <>
      <PageHeading
        eyebrow="LEARNING"
        title="Progress"
        subtitle="Calculated only from your completed work and recorded activity."
      />

      <div className="metrics-row">
        {metrics.map(([label, value, copy, progress]) => (
          <Card className="metric-card" key={label}>
            <Text size={200}>{label}</Text>
            <Text as="span" size={700} weight="semibold">
              {value}
            </Text>
            <ProgressBar value={progress} />
            <Text size={200}>{copy}</Text>
          </Card>
        ))}
      </div>

      <Card className="content-card">
        <SectionTitle
          eyebrow="COURSE PROGRESS"
          title="Based on completed course tasks"
        />
        {coursesWithTasks.length ? (
          coursesWithTasks.map((course) => {
            const courseTasks = tasks.filter((x) => x.course === course)
            const done = courseTasks.filter(
              (x) => x.status === "completed",
            ).length
            return (
              <div className="course-row" key={course}>
                <div className="progress-label">
                  <Text weight="semibold">{course}</Text>
                  <Text>
                    {done} of {courseTasks.length}
                  </Text>
                </div>
                <ProgressBar
                  value={courseTasks.length ? done / courseTasks.length : 0}
                />
              </div>
            )
          })
        ) : (
          <EmptyState
            icon={<DataTrending20Regular />}
            title="No course activity to show yet."
            copy="Assign courses to tasks and complete them to track course progress."
          />
        )}
      </Card>

      <Card
        className="content-card"
        style={{ marginTop: "var(--spacingVerticalL)" }}
      >
        <SectionTitle
          eyebrow="RECORDED SESSIONS"
          title="Real focus session history"
        />
        {completedSessions.length ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            {completedSessions.slice(0, 10).map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "var(--borderRadiusMedium)",
                  background: "var(--colorNeutralBackground2)",
                  border: "1px solid var(--colorNeutralStroke2)",
                }}
              >
                <div>
                  <Text weight="semibold" style={{ display: "block" }}>
                    {s.taskTitle || "Focus session"}
                  </Text>
                  <Text
                    size={200}
                    style={{ color: "var(--colorNeutralForeground3)" }}
                  >
                    {formatShortDate(s.completedAt.slice(0, 10))} ·{" "}
                    {new Date(s.completedAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <Text weight="semibold">{s.actualDuration} min</Text>
                  <Badge appearance="tint" color="success">
                    Completed
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Timer20Regular />}
            title="No focus sessions recorded yet."
            copy="Start a focus session from Home or Tasks to begin logging your study time."
          />
        )}
      </Card>
    </>
  )
}

function AskSageScreen({
  tasks,
  events,
  timetable = [],
  setTasks,
  setEvents,
  setTimetable,
  focus,
  addTask: _addTask,
  updateTask: _updateTask,
}: {
  tasks: Task[]
  events: EventItem[]
  timetable?: TimetableEntry[]
  setTasks?: React.Dispatch<React.SetStateAction<Task[]>>
  setEvents?: React.Dispatch<React.SetStateAction<EventItem[]>>
  setTimetable?: React.Dispatch<React.SetStateAction<TimetableEntry[]>>
  focus: (t: Task) => void
  addTask: () => void
  updateTask: (id: number, p: Partial<Task>) => void
}) {
  return (
    <div className="assistant-page" style={{ padding: 0 }}>
      <AskSageChatbot
        tasks={tasks}
        events={events}
        timetable={timetable}
        onTaskCreated={(newTask) => {
          if (setTasks) {
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) return prev
              return [newTask, ...prev]
            })
          }
        }}
        onTimetableImported={(entries) => {
          if (setTimetable) {
            setTimetable((prev) => [...prev, ...entries])
          }
        }}
        onEventsCreated={(newEvents) => {
          if (setEvents) {
            setEvents((prev) => [...newEvents, ...prev])
          }
        }}
        onFocusTask={focus}
      />
    </div>
  )
}


function GoogleCalendarSettings({
  events,
  setEvents,
}: {
  events: EventItem[]
  setEvents: React.Dispatch<React.SetStateAction<EventItem[]>>
}) {
  const [status, setStatus] =
    useState<"idle" | "connecting" | "connected" | "error" | "unconfigured">(
      isGoogleCalendarConnected() ||
        events.some((event) => event.source === "google")
        ? "connected"
        : "idle",
    )
  const [imported, setImported] = useState(
    events.filter((event) => event.source === "google").length,
  )
  const [lastSync, setLastSync] = useState<string>("")
  const [clientIdInput, setClientIdInput] = useState<string>(
    () => getCustomGoogleClientId() || getGoogleClientId(),
  )
  const [idNotice, setIdNotice] = useState("")

  const handleSaveClientId = () => {
    setCustomGoogleClientId(clientIdInput)
    setIdNotice("Google Client ID saved. Reloading auth configuration…")
    setTimeout(() => {
      setIdNotice("")
      window.location.reload()
    }, 1200)
  }

  const handleResetClientId = () => {
    setCustomGoogleClientId("")
    setClientIdInput(getGoogleClientId())
    setIdNotice("Reset to default Client ID. Reloading…")
    setTimeout(() => {
      setIdNotice("")
      window.location.reload()
    }, 1200)
  }

  const connect = async () => {
    setStatus("connecting")
    try {
      const sageEvents = events
        .filter((event) => event.source !== "google")
        .map((event) => ({
          localId: event.id,
          externalId: event.externalId || "",
          title: event.title,
          type: event.type,
          date: event.date,
          time: event.time,
          endTime: event.endTime,
        }))
      const result = await syncGoogleCalendarEvents(sageEvents, true)
      const linkedIds = new Set([
        ...Object.values(result.links),
        ...sageEvents.map((event) => event.externalId).filter(Boolean),
      ])
      const importedList = result.importedEvents
        .filter((event) => !linkedIds.has(event.externalId))
        .map((event) => ({
          id: Array.from(event.externalId).reduce(
            (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
            7,
          ),
          title: event.title,
          type: "Personal",
          date: event.date,
          time: event.time,
          endTime: event.endTime,
          source: "google" as const,
          externalId: event.externalId,
        }))
      setEvents((current) => [
        ...current
          .filter((event) => event.source !== "google")
          .map((event) => ({
            ...event,
            externalId: result.links[event.id] || event.externalId,
            source: event.source || "sage" as const,
          })),
        ...importedList,
      ])
      setImported(result.importedEvents.length)
      setLastSync(
        result.lastSyncedAt ||
          new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
      )
      setStatus("connected")
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === "not-configured"
          ? "unconfigured"
          : "error",
      )
    }
  }

  const disconnect = () => {
    disconnectGoogleCalendar()
    setEvents((current) => current.filter((event) => event.source !== "google"))
    setImported(0)
    setLastSync("")
    setStatus("idle")
  }

  return (
    <div className="calendar-connection">
      <div className="connection-header">
        <div className="google-calendar-mark">
          <CalendarLtr20Regular />
        </div>
        <div>
          <Text as="span" size={500} weight="semibold">
            Google Calendar Integration
          </Text>
          <Text size={200}>
            Two-way sync: SAGE schedule and your primary Google Calendar stay
            unified.
          </Text>
        </div>
        <Badge
          appearance="tint"
          color={status === "connected" ? "success" : "informative"}
        >
          {status === "connected" ? "Connected" : "Not connected"}
        </Badge>
      </div>

      <div className="connection-details">
        <CheckmarkCircle20Regular />
        <Text>Two-way Calendar Sync</Text>
        <Text size={200}>
          {status === "connected"
            ? `${imported} events currently synced${
                lastSync ? ` · Last synced at ${lastSync}` : ""
              }`
            : "Sign in with Google to push local events and import schedule"}
        </Text>
      </div>

      {status === "connecting" && (
        <div className="connection-message">
          <div className="loading-ring" />
          <Text>Authorizing and syncing with Google Calendar…</Text>
        </div>
      )}
      {status === "connected" && (
        <div className="connection-message success">
          <CheckmarkCircle20Filled />
          <Text>
            {imported} upcoming {imported === 1 ? "event" : "events"} synced
            with Google Calendar.
          </Text>
        </div>
      )}
      {status === "unconfigured" && (
        <div className="connection-message error">
          <Alert20Regular />
          <Text>
            Google Calendar isn’t configured for this SAGE environment yet.
          </Text>
        </div>
      )}
      {status === "error" && (
        <div className="connection-message error">
          <Alert20Regular />
          <Text>
            Could not connect or authorization was declined. Please verify your
            Google Client ID and try again.
          </Text>
        </div>
      )}

      <div className="button-row">
        {status === "connected" ? (
          <>
            <Button appearance="primary" onClick={connect}>
              Sync now
            </Button>
            <Button
              appearance="secondary"
              onClick={() =>
                window.open(
                  "https://calendar.google.com/",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              Open Google Calendar
            </Button>
            <Button appearance="subtle" onClick={disconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            appearance="primary"
            disabled={status === "connecting"}
            onClick={connect}
          >
            Connect Google Calendar
          </Button>
        )}
      </div>

      <Divider />

      <div>
        <Text as="span" size={400} weight="semibold">
          Google OAuth Client Configuration
        </Text>
        <Text
          size={200}
          style={{
            display: "block",
            marginTop: "4px",
            color: "var(--colorNeutralForeground3)",
          }}
        >
          Configure the OAuth 2.0 Web Client ID from your Google Cloud Console.
        </Text>
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "12px",
            alignItems: "flex-end",
          }}
        >
          <Label style={{ flex: 1 }}>
            Google Client ID
            <Input
              value={clientIdInput}
              onChange={(_, d) => setClientIdInput(d.value)}
              placeholder="e.g. 123456789-xxxxxx.apps.googleusercontent.com"
            />
          </Label>
          <Button appearance="primary" onClick={handleSaveClientId}>
            Save Client ID
          </Button>
          <Button appearance="subtle" onClick={handleResetClientId}>
            Reset Default
          </Button>
        </div>
        {idNotice && (
          <Text
            size={200}
            style={{
              color: "var(--colorBrandForeground1)",
              display: "block",
              marginTop: "8px",
            }}
          >
            {idNotice}
          </Text>
        )}
      </div>

      <div
        style={{
          padding: "12px",
          background: "var(--colorNeutralBackground3)",
          borderRadius: "var(--borderRadiusMedium)",
        }}
      >
        <Text
          weight="semibold"
          size={200}
          style={{ display: "block", marginBottom: "4px" }}
        >
          Google Cloud Console Quick Setup Checklist:
        </Text>
        <Text
          size={100}
          style={{
            display: "block",
            color: "var(--colorNeutralForeground2)",
            lineHeight: "1.6",
          }}
        >
          1.{" "}
          <b>
            APIs & Services &gt; Credentials &gt; OAuth 2.0 Client IDs (Web
            application)
          </b>
          <br />
          2. <b>Authorized JavaScript Origins:</b>{" "}
          <code>http://localhost:8443</code> and{" "}
          <code>{window.location.origin}</code>
          <br />
          3. <b>Enabled APIs:</b> Google Calendar API &amp; Google Identity
          Services
          <br />
          4. <b>Scopes:</b> <code>userinfo.email</code>,{" "}
          <code>userinfo.profile</code>,{" "}
          <code>https://www.googleapis.com/auth/calendar.events</code>
        </Text>
      </div>
    </div>
  )
}

function SettingsScreen({
  profile,
  setProfile,
  preferences,
  setPreferences,
  notifications,
  setNotifications,
  platforms,
  setPlatforms,
  events,
  setEvents,
  timetable,
  setTimetable,
  tasks,
  goals,
  reminders,
  focusSessions,
  setFocusSessions,
  go,
  signOut,
  onAccountDeleted,
}: {
  profile: Profile
  setProfile: (p: Profile) => void
  preferences: UserPreferences
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>
  notifications: NotificationPreferences
  setNotifications: React.Dispatch<React.SetStateAction<NotificationPreferences>>
  platforms: string[]
  setPlatforms: React.Dispatch<React.SetStateAction<string[]>>
  events: EventItem[]
  setEvents: React.Dispatch<React.SetStateAction<EventItem[]>>
  timetable: TimetableEntry[]
  setTimetable: React.Dispatch<React.SetStateAction<TimetableEntry[]>>
  tasks: Task[]
  goals: Goal[]
  reminders: Reminder[]
  focusSessions: FocusSessionRecord[]
  setFocusSessions: React.Dispatch<React.SetStateAction<FocusSessionRecord[]>>
  go: (v: View) => void
  signOut: () => void
  onAccountDeleted?: () => void
}) {
  const { deleteAccount } = useAuth()
  const [section, setSection] = useState("Profile")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const sections = [
    "Profile",
    "Schedule",
    "Calendar",
    "Coding Platforms",
    "Notifications",
    "Preferences",
    "Privacy & Data",
  ]

  const [profileMsg, setProfileMsg] = useState("")
  const [prefMsg, setPrefMsg] = useState("")
  const [notifMsg, setNotifMsg] = useState("")
  const [testEmailLoading, setTestEmailLoading] = useState(false)
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null)

  const handleSaveProfile = () => {
    window.localStorage.setItem("sage-user-profile", JSON.stringify(profile))
    setProfileMsg("✓ Profile changes saved.")
    setTimeout(() => setProfileMsg(""), 3000)
  }

  const handleSavePreferences = () => {
    window.localStorage.setItem(
      USER_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
    setPrefMsg("✓ Work preferences saved.")
    setTimeout(() => setPrefMsg(""), 3000)
  }

  const handleSaveNotifications = async () => {
    const res = await syncNotificationPreferences(notifications)
    setNotifMsg(
      res.source === "backend"
        ? "✓ Notification preferences saved and synced."
        : "✓ Notification preferences saved.",
    )
    setTimeout(() => setNotifMsg(""), 3000)
  }

  const handleTogglePlatform = (p: string) => {
    setPlatforms((list) => {
      const next = list.includes(p) ? list.filter((x) => x !== p) : [...list, p]
      window.localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const handleExportData = () => {
    const data = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      profile,
      preferences,
      notifications,
      platforms,
      timetable,
      tasks,
      goals,
      events,
      reminders,
      focusSessions,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `sage-data-export-${getLocalDateString()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleResetWorkspace = () => {
    if (
      window.confirm(
        "Are you sure you want to reset your workspace? This will clear tasks, goals, schedule items, focus history, and reminders back to zero. Your user account and login credentials will remain active.",
      )
    ) {
      const workspaceKeys = [
        "sage-tasks",
        "sage-goals",
        "sage-events",
        "sage-timetable",
        REMINDERS_STORAGE_KEY,
        FOCUS_SESSIONS_STORAGE_KEY,
        "sage-contest-reminders",
      ]
      for (const k of workspaceKeys) {
        window.localStorage.removeItem(k)
        window.sessionStorage.removeItem(k)
      }
      setEvents([])
      setTimetable([])
      setFocusSessions([])
      window.location.reload()
    }
  }

  const handleDeleteAccount = async () => {
    if (
      window.confirm(
        "Are you sure you want to permanently delete your account? All your login credentials, profile, tasks, goals, timetable, reminders, and settings will be permanently erased. This cannot be undone.",
      )
    ) {
      setIsDeleting(true)
      setDeleteError(null)
      try {
        const ok = await deleteAccount()
        if (ok) {
          setEvents([])
          setTimetable([])
          setFocusSessions([])
          disconnectGoogleCalendar()
          if (onAccountDeleted) {
            onAccountDeleted()
          } else {
            window.location.href = "/?deleted=true"
          }
        } else {
          setDeleteError(
            "Account deletion could not be completed on the server. Your data was not deleted.",
          )
        }
      } catch (err: unknown) {
        setDeleteError(
          "Permanent account deletion failed. Please check your network connection and try again.",
        )
      } finally {
        setIsDeleting(false)
      }
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="YOUR SAGE"
        title="Settings"
        subtitle="Update any information you provided during onboarding."
      />
      <div className="settings-layout">
        <Card className="settings-nav">
          {sections.map((x) => (
            <Button
              appearance={section === x ? "primary" : "subtle"}
              key={x}
              onClick={() => setSection(x)}
            >
              {x}
            </Button>
          ))}
        </Card>
        <Card className="content-card settings-form">
          <SectionTitle title={section} eyebrow="SETTINGS" />
          {section === "Profile" && (
            <>
              <div className="form-grid">
                <Label>
                  Name
                  <Input
                    value={profile.name}
                    onChange={(_, d) =>
                      setProfile({ ...profile, name: d.value })
                    }
                  />
                </Label>
                <Label>
                  Email
                  <Input
                    value={profile.email}
                    readOnly
                    title="Account email from sign-in"
                  />
                </Label>
                <Label>
                  College
                  <Input
                    value={profile.college}
                    onChange={(_, d) =>
                      setProfile({ ...profile, college: d.value })
                    }
                  />
                </Label>
                <Label>
                  Course
                  <Input
                    value={profile.course}
                    onChange={(_, d) =>
                      setProfile({ ...profile, course: d.value })
                    }
                  />
                </Label>
                <Label>
                  Year
                  <Dropdown
                    value={profile.year}
                    onOptionSelect={(_, d) =>
                      setProfile({ ...profile, year: String(d.optionValue) })
                    }
                    placeholder="Select year"
                  >
                    {[
                      "First year",
                      "Second year",
                      "Third year",
                      "Fourth year",
                      "Postgraduate",
                    ].map((x) => (
                      <Option key={x}>{x}</Option>
                    ))}
                  </Dropdown>
                </Label>
                <Label>
                  Timezone
                  <Input
                    value={profile.timezone}
                    onChange={(_, d) =>
                      setProfile({ ...profile, timezone: d.value })
                    }
                  />
                </Label>
              </div>
              <div
                className="form-actions"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                <Button appearance="primary" onClick={handleSaveProfile}>
                  Save changes
                </Button>
                {profileMsg && (
                  <Text
                    size={200}
                    style={{ color: "var(--colorBrandForeground1)" }}
                  >
                    {profileMsg}
                  </Text>
                )}
                <Button
                  appearance="subtle"
                  onClick={signOut}
                  style={{ marginLeft: "auto" }}
                >
                  Sign out
                </Button>
              </div>
            </>
          )}

          {section === "Schedule" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacingVerticalM)",
              }}
            >
              <div className="timetable-info-banner">
                <Book20Regular />
                <Text size={200}>
                  Timetable classes are background academic context
                  (Informational only · No notification fatigue).
                </Text>
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <Card style={{ padding: "16px", flex: 1, minWidth: "200px" }}>
                  <Text size={200}>Weekly Timetable</Text>
                  <Text
                    as="p"
                    size={600}
                    weight="semibold"
                    style={{ margin: "4px 0" }}
                  >
                    {timetable.length} blocks
                  </Text>
                  <Text
                    size={100}
                    style={{ color: "var(--colorNeutralForeground3)" }}
                  >
                    Merged consecutive periods
                  </Text>
                </Card>
                <Card style={{ padding: "16px", flex: 1, minWidth: "200px" }}>
                  <Text size={200}>Scheduled Exams</Text>
                  <Text
                    as="p"
                    size={600}
                    weight="semibold"
                    style={{ margin: "4px 0" }}
                  >
                    {events.filter((e) => e.type === "Exam").length} exams
                  </Text>
                  <Text
                    size={100}
                    style={{ color: "var(--colorNeutralForeground3)" }}
                  >
                    Actionable academic deadlines
                  </Text>
                </Card>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <Button
                  appearance="primary"
                  icon={<CalendarLtr20Regular />}
                  onClick={() => go("Calendar")}
                >
                  Manage Timetable & Exams in Calendar
                </Button>
              </div>

              {timetable.length > 0 ? (
                <div style={{ marginTop: "12px" }}>
                  <Text
                    weight="semibold"
                    style={{ display: "block", marginBottom: "8px" }}
                  >
                    Current Timetable Classes:
                  </Text>
                  <TimetableReviewList
                    items={timetable}
                    remove={(id) => {
                      const next = timetable.filter((t) => t.id !== id)
                      setTimetable(next)
                      saveTimetable(next)
                    }}
                    empty="No timetable classes."
                  />
                </div>
              ) : (
                <EmptyState
                  icon={<Book20Regular />}
                  title="No timetable classes loaded"
                  copy="Navigate to Calendar to import your official class schedule or upload a timetable image."
                  action={
                    <Button
                      appearance="secondary"
                      icon={<CalendarLtr20Regular />}
                      onClick={() => go("Calendar")}
                    >
                      Open Calendar
                    </Button>
                  }
                />
              )}
            </div>
          )}

          {section === "Calendar" && (
            <GoogleCalendarSettings events={events} setEvents={setEvents} />
          )}

          {section === "Coding Platforms" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <Text size={200}>
                Select the platforms you follow to filter upcoming coding
                contests. No accounts or handles needed. Preferences persist
                immediately.
              </Text>
              <div className="platform-grid">
                {platformOptions.map((p) => (
                  <label
                    className={`platform-choice ${
                      platforms.includes(p) ? "selected" : ""
                    }`}
                    key={p}
                  >
                    <Checkbox
                      checked={platforms.includes(p)}
                      onChange={() => handleTogglePlatform(p)}
                    />
                    <Code20Regular />
                    <Text weight="semibold">{p}</Text>
                  </label>
                ))}
              </div>
            </div>
          )}

          {section === "Notifications" && (
            <div className="settings-list">
              <div className="setting-row">
                <div>
                  <Text weight="semibold">In-app reminders</Text>
                  <Text size={200}>
                    Show alerts and notification badges within SAGE when
                    reminders are due.
                  </Text>
                </div>
                <Switch
                  checked={notifications.inApp}
                  onChange={(_, d) =>
                    setNotifications((curr) => ({
                      ...curr,
                      inApp: d.checked,
                    }))
                  }
                />
              </div>

              <div className="setting-row">
                <div>
                  <Text weight="semibold">Browser notifications</Text>
                  <Text size={200}>
                    {isBrowserNotificationSupported()
                      ? getBrowserNotificationPermission() === "denied"
                        ? "Blocked in browser permissions. Please allow notifications in browser settings."
                        : getBrowserNotificationPermission() === "granted"
                          ? "Active. Desktop notifications will appear when enabled reminders become due."
                          : "Get desktop alerts even when the SAGE tab is in the background."
                      : "Desktop notifications are not supported in this browser."}
                  </Text>
                </div>
                <Switch
                  checked={notifications.browserNotifications}
                  disabled={
                    !isBrowserNotificationSupported() ||
                    getBrowserNotificationPermission() === "denied"
                  }
                  onChange={async (_, d) => {
                    if (d.checked) {
                      const granted =
                        await requestBrowserNotificationPermission()
                      setNotifications((curr) => ({
                        ...curr,
                        browserNotifications: granted,
                      }))
                    } else {
                      setNotifications((curr) => ({
                        ...curr,
                        browserNotifications: false,
                      }))
                    }
                  }}
                />
              </div>

              <div className="setting-row">
                <div>
                  <Text weight="semibold">Email reminders</Text>
                  <Text size={200}>
                    Transactional email engine active (Brevo). Automated notifications are sent to your verified inbox for upcoming deadlines and contests.
                  </Text>
                </div>
                <Switch
                  checked={notifications.email}
                  onChange={(_, d) =>
                    setNotifications((curr) => ({
                      ...curr,
                      email: d.checked,
                    }))
                  }
                />
              </div>

              <div
                style={{
                  marginTop: "8px",
                  marginBottom: "8px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "var(--colorNeutralBackground2, #f5f5f5)",
                  border: "1px solid var(--colorNeutralStroke2, #e0e0e0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <Text weight="semibold" size={200} block>
                    Verify Email Delivery (Brevo Engine)
                  </Text>
                  <Text size={100} style={{ color: "var(--colorNeutralForeground3)" }}>
                    Send an immediate test reminder to confirm email delivery to your inbox.
                  </Text>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Button
                    appearance="secondary"
                    size="small"
                    disabled={testEmailLoading}
                    onClick={async () => {
                      setTestEmailLoading(true)
                      setTestEmailStatus(null)
                      try {
                        const targetRecipient = profile.email || ""
                        const res = await sendTestReminderEmail("Upcoming Deadline: SAGE Milestone Check", targetRecipient)
                        if (res && res.success) {
                          setTestEmailStatus(`✓ Sent to ${res.recipient}!`)
                        } else {
                          setTestEmailStatus(`✕ Delivery failed: ${res?.error || "Check backend"}`)
                        }
                      } catch (e: any) {
                        setTestEmailStatus(`✕ Error: ${e?.message || "Failed to reach backend"}`)
                      } finally {
                        setTestEmailLoading(false)
                      }
                    }}
                  >
                    {testEmailLoading ? "Sending..." : "Send Test Reminder Email"}
                  </Button>
                  {testEmailStatus && (
                    <Text
                      size={200}
                      style={{
                        fontWeight: 600,
                        color: testEmailStatus.startsWith("✓")
                          ? "var(--colorPaletteGreenForeground1, #107c41)"
                          : "var(--colorPaletteRedForeground1, #c42b1c)",
                      }}
                    >
                      {testEmailStatus}
                    </Text>
                  )}
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <Text weight="semibold">Task reminders</Text>
                  <Text size={200}>
                    Send nudges based on your task due dates and times.
                  </Text>
                </div>
                <Switch
                  checked={notifications.tasks}
                  onChange={(_, d) =>
                    setNotifications((curr) => ({
                      ...curr,
                      tasks: d.checked,
                    }))
                  }
                />
              </div>

              <div className="setting-row">
                <div>
                  <Text weight="semibold">Contest reminders</Text>
                  <Text size={200}>
                    Alerts for contests from selected coding platforms.
                  </Text>
                </div>
                <Switch
                  checked={notifications.contests}
                  onChange={(_, d) =>
                    setNotifications((curr) => ({
                      ...curr,
                      contests: d.checked,
                    }))
                  }
                />
              </div>

              <Label style={{ marginTop: "8px" }}>
                Default reminder timing
                <Dropdown
                  value={
                    TIMING_LABELS[notifications.timing] || "At time of event"
                  }
                  onOptionSelect={(_, d) => {
                    const found = (Object.keys(
                      TIMING_LABELS,
                    ) as ReminderTiming[]).find(
                      (k) => TIMING_LABELS[k] === String(d.optionValue),
                    )
                    if (found)
                      setNotifications((curr) => ({ ...curr, timing: found }))
                  }}
                >
                  {(Object.keys(TIMING_LABELS) as ReminderTiming[]).map((k) => (
                    <Option key={k}>{TIMING_LABELS[k]}</Option>
                  ))}
                </Dropdown>
              </Label>

              <Label style={{ marginTop: "8px" }}>
                Quiet hours
                <Input
                  value={notifications.quietHours}
                  onChange={(_, d) =>
                    setNotifications((curr) => ({
                      ...curr,
                      quietHours: d.value,
                    }))
                  }
                  placeholder="e.g. 10:00 PM – 7:00 AM"
                />
              </Label>
              <div
                className="form-actions"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                <Button appearance="primary" onClick={handleSaveNotifications}>
                  Save notifications
                </Button>
                {notifMsg && (
                  <Text
                    size={200}
                    style={{ color: "var(--colorBrandForeground1)" }}
                  >
                    {notifMsg}
                  </Text>
                )}
              </div>
            </div>
          )}

          {section === "Preferences" && (
            <div className="form-grid">
              <Label>
                Preferred study period
                <Dropdown
                  value={preferences.period}
                  onOptionSelect={(_, d) =>
                    setPreferences((curr) => ({
                      ...curr,
                      period: String(d.optionValue),
                    }))
                  }
                >
                  {["Morning", "Afternoon", "Evening"].map((x) => (
                    <Option key={x}>{x}</Option>
                  ))}
                </Dropdown>
              </Label>
              <Label>
                Session duration
                <Input
                  type="number"
                  contentAfter="minutes"
                  value={preferences.duration}
                  onChange={(_, d) =>
                    setPreferences((curr) => ({ ...curr, duration: d.value }))
                  }
                />
              </Label>
              <Label>
                Daily focus target
                <Input
                  type="number"
                  contentAfter="hours"
                  value={preferences.target}
                  onChange={(_, d) =>
                    setPreferences((curr) => ({ ...curr, target: d.value }))
                  }
                />
              </Label>
              <div className="choice-card full-field">
                <Text weight="semibold">Working preferences</Text>
                <Checkbox
                  checked={preferences.includeBreaks !== false}
                  onChange={(_, d) =>
                    setPreferences((curr) => ({
                      ...curr,
                      includeBreaks: d.checked === true,
                    }))
                  }
                  label="Include short breaks between sessions"
                />
                <Checkbox
                  checked={preferences.avoidPersonalCommitments === true}
                  onChange={(_, d) =>
                    setPreferences((curr) => ({
                      ...curr,
                      avoidPersonalCommitments: d.checked === true,
                    }))
                  }
                  label="Avoid scheduling over personal commitments"
                />
              </div>
              <div
                className="form-actions full-field"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                <Button appearance="primary" onClick={handleSavePreferences}>
                  Save preferences
                </Button>
                {prefMsg && (
                  <Text
                    size={200}
                    style={{ color: "var(--colorBrandForeground1)" }}
                  >
                    {prefMsg}
                  </Text>
                )}
              </div>
            </div>
          )}

          {section === "Privacy & Data" && (
            <div
              className="privacy-actions"
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <Text weight="semibold" style={{ display: "block" }}>
                  Export your data
                </Text>
                <Text
                  size={200}
                  style={{ color: "var(--colorNeutralForeground2)" }}
                >
                  Download all your profile, tasks, goals, timetable, reminders,
                  focus session history, and preferences as JSON.
                </Text>
                <div style={{ marginTop: "8px" }}>
                  <Button appearance="secondary" onClick={handleExportData}>
                    Export Data
                  </Button>
                </div>
              </div>
              <Divider />
              <div>
                <Text weight="semibold" style={{ display: "block" }}>
                  Reset workspace data
                </Text>
                <Text
                  size={200}
                  style={{ color: "var(--colorNeutralForeground2)" }}
                >
                  Clears tasks, goals, schedule items, focus history, and
                  reminders back to zero. Your user account and login
                  credentials will remain active.
                </Text>
                <div style={{ marginTop: "8px" }}>
                  <Button appearance="secondary" onClick={handleResetWorkspace}>
                    Reset Workspace
                  </Button>
                </div>
              </div>
              <Divider />
              <div>
                <Text
                  weight="semibold"
                  style={{
                    display: "block",
                    color: "var(--colorPaletteRedForeground1)",
                  }}
                >
                  Permanently delete account
                </Text>
                <Text
                  size={200}
                  style={{ color: "var(--colorNeutralForeground2)" }}
                >
                  Permanently remove your account, cloud profile, tasks,
                  timetable, and all associated personal data. This action is
                  irreversible.
                </Text>
                <div style={{ marginTop: "8px" }}>
                  <Button
                    appearance="primary"
                    disabled={isDeleting}
                    onClick={handleDeleteAccount}
                    style={{
                      background: "var(--colorPaletteRedBackground3, #d13438)",
                      borderColor:
                        "var(--colorPaletteRedBorderActive, #a80000)",
                    }}
                  >
                    {isDeleting
                      ? "Deleting Account..."
                      : "Permanently Delete Account"}
                  </Button>
                </div>
                {deleteError && (
                  <Text
                    size={200}
                    style={{
                      display: "block",
                      marginTop: "8px",
                      color: "var(--colorPaletteRedForeground1, #c42b1c)",
                      fontWeight: 600,
                    }}
                  >
                    {deleteError}
                  </Text>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function AppContent() {
  const {
    user,
    signOut,
    completeOnboarding,
    hasCompletedOnboarding,
    loginWithUser,
  } = useAuth()

  const [accountDeletedMessage, setAccountDeletedMessage] =
    useState<string | null>(() => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search)
        if (params.get("deleted") === "true") {
          const newUrl = window.location.pathname
          window.history.replaceState({}, document.title, newUrl)
          return "Your SAGE account and all associated personal data have been permanently deleted."
        }
      }
      return null
    })

  if (typeof window !== "undefined" && window.location.pathname === "/dev/diagnostics") {
    return <DiagnosticsDashboard />
  }

  const [flow, setFlow] = useState<Flow>(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : ""
    const authUserStr =
      typeof window !== "undefined"
        ? window.localStorage.getItem(AUTH_STORAGE_KEY)
        : null
    const isAuth = Boolean(authUserStr)
    const onboardingDone =
      typeof window !== "undefined" &&
      window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true"

    if (isAuth) {
      if (path === "/calibration" || !onboardingDone) return "onboarding"
      return "app"
    }
    if (path === "/auth") return "auth"
    return "landing"
  })

  const [authMode, setAuthMode] = useState<"google" | "email">("email")
  const [email, setEmail] = useState(() => user?.email || "")
  const [authenticatedName, setAuthenticatedName] = useState(
    () => user?.name || "",
  )

  const [profile, setProfile] = useState<Profile>(() => {
    return (
      getUserItem<Profile>("sage-user-profile", user) || {
        name: user?.name || "",
        email: user?.email || "",
        college: "",
        course: "",
        year: "",
        timezone: "",
      }
    )
  })

  const [tasks, setTasks] = useState<Task[]>(() => {
    return getStoredLocalTasks(user)
  })

  useEffect(() => {
    let isMounted = true
    if (!user || !user.authenticated) {
      setTasks([])
      return
    }
    taskService
      .getTasks()
      .then((serverTasks) => {
        if (
          isMounted &&
          user?.authenticated &&
          Array.isArray(serverTasks) &&
          serverTasks.length > 0
        ) {
          setTasks(serverTasks)
        }
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [user?.id, user?.email, user?.authenticated])

  const [goals, setGoals] = useState<Goal[]>(() => {
    return getUserItem<Goal[]>("sage-goals", user) || []
  })

  const [events, setEvents] = useState<EventItem[]>(() => {
    const saved = getUserItem<EventItem[]>("sage-events", user)
    if (saved && Array.isArray(saved)) {
      return syncEventsToCurrentWeek(saved)
    }
    return []
  })

  useEffect(() => {
    const syncCurrent = () => {
      setEvents((current) => {
        const synced = syncEventsToCurrentWeek(current)
        if (JSON.stringify(synced) !== JSON.stringify(current)) {
          setUserItem("sage-events", synced, user)
          return synced
        }
        return current
      })
    }
    syncCurrent()
    const interval = setInterval(syncCurrent, 60000)
    window.addEventListener("focus", syncCurrent)
    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", syncCurrent)
    }
  }, [user])

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    return (
      getUserItem<UserPreferences>(USER_PREFERENCES_STORAGE_KEY, user) ||
      DEFAULT_USER_PREFERENCES
    )
  })

  const [notifications, setNotifications] = useState<NotificationPreferences>(
    () => {
      return (
        getUserItem<NotificationPreferences>(NOTIFICATIONS_STORAGE_KEY, user) ||
        DEFAULT_NOTIFICATION_PREFERENCES
      )
    },
  )

  const [platforms, setPlatforms] = useState<string[]>(() => {
    return getUserItem<string[]>(PLATFORMS_STORAGE_KEY, user) || []
  })

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    return loadSavedReminders(user)
  })

  const [focusSessions, setFocusSessions] = useState<FocusSessionRecord[]>(
    () => {
      return (
        getUserItem<FocusSessionRecord[]>(FOCUS_SESSIONS_STORAGE_KEY, user) ||
        []
      )
    },
  )

  const [timetable, setTimetable] = useState<TimetableEntry[]>(() => {
    const saved = loadSavedTimetable(user)
    if (saved && saved.length > 0) return saved
    return []
  })

  // Synchronize scoped state whenever user switches accounts
  useEffect(() => {
    if (!user) return
    setProfile(
      getUserItem<Profile>("sage-user-profile", user) || {
        name: user.name || "",
        email: user.email || "",
        college: "",
        course: "",
        year: "",
        timezone: "",
      },
    )
    setTasks(getStoredLocalTasks(user))
    setGoals(getUserItem<Goal[]>("sage-goals", user) || [])
    const savedEvents = getUserItem<EventItem[]>("sage-events", user)
    setEvents(
      savedEvents && Array.isArray(savedEvents)
        ? syncEventsToCurrentWeek(savedEvents)
        : [],
    )
    setPreferences(
      getUserItem<UserPreferences>(USER_PREFERENCES_STORAGE_KEY, user) ||
        DEFAULT_USER_PREFERENCES,
    )
    setNotifications(
      getUserItem<NotificationPreferences>(NOTIFICATIONS_STORAGE_KEY, user) ||
        DEFAULT_NOTIFICATION_PREFERENCES,
    )
    setPlatforms(getUserItem<string[]>(PLATFORMS_STORAGE_KEY, user) || [])
    setReminders(loadSavedReminders(user))
    if (user?.authenticated) {
      getBackendReminders()
        .then((serverReminders) => {
          if (serverReminders && Array.isArray(serverReminders) && serverReminders.length > 0) {
            setReminders((prev) => {
              const mapped = serverReminders.map(backendReminderToFrontend)
              const map = new Map<number, Reminder>()
              prev.forEach((r) => map.set(r.id, r))
              mapped.forEach((r) => map.set(r.id, { ...map.get(r.id), ...r }))
              const merged = Array.from(map.values())
              saveReminders(merged, user)
              return merged
            })
          }
        })
        .catch(() => {})
    }
    setFocusSessions(
      getUserItem<FocusSessionRecord[]>(FOCUS_SESSIONS_STORAGE_KEY, user) || [],
    )
    setTimetable(loadSavedTimetable(user) || [])
  }, [user?.id, user?.email])

  useEffect(() => {
    saveTimetable(timetable, user)
  }, [timetable, user])

  useEffect(() => {
    if (profile.email) {
      setUserItem("sage-user-profile", profile, user)
    }
  }, [profile, user])

  useEffect(() => {
    saveStoredLocalTasks(tasks, user)
  }, [tasks, user])

  useEffect(() => {
    setUserItem("sage-goals", goals, user)
  }, [goals, user])

  useEffect(() => {
    setUserItem("sage-events", events, user)
  }, [events, user])

  useEffect(() => {
    setUserItem(USER_PREFERENCES_STORAGE_KEY, preferences, user)
  }, [preferences, user])

  useEffect(() => {
    setUserItem(PLATFORMS_STORAGE_KEY, platforms, user)
  }, [platforms, user])

  useEffect(() => {
    setUserItem(NOTIFICATIONS_STORAGE_KEY, notifications, user)
  }, [notifications, user])

  useEffect(() => {
    saveReminders(reminders, user)
  }, [reminders, user])

  useEffect(() => {
    setUserItem(FOCUS_SESSIONS_STORAGE_KEY, focusSessions, user)
  }, [focusSessions, user])

  const navigateTo = (path: string) => {
    if (typeof window !== "undefined") {
      try {
        window.history.pushState({}, "", path)
      } catch {}
    }
    if (path === "/calibration") setFlow("onboarding")
    else if (path === "/home") setFlow("app")
    else if (path === "/auth") setFlow("auth")
    else setFlow("landing")
  }

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      const isAuth = Boolean(window.localStorage.getItem(AUTH_STORAGE_KEY))
      const onboardingDone =
        window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true"

      if (path === "/calibration") {
        setFlow(isAuth ? "onboarding" : "landing")
      } else if (path === "/home") {
        setFlow(isAuth ? "app" : "landing")
      } else if (path === "/auth") {
        setFlow("auth")
      } else {
        if (isAuth && onboardingDone) {
          setFlow("app")
        } else if (isAuth) {
          setFlow("onboarding")
        } else {
          setFlow("landing")
        }
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const authenticate = (mode: "google" | "email") => {
    setAuthMode(mode)
    navigateTo("/auth")
  }

  const handleAuthSuccess = (authUser: AuthUser) => {
    loginWithUser(authUser)
    setEmail(authUser.email)
    setAuthenticatedName(authUser.name)
    setProfile((prev) => ({
      ...prev,
      email: authUser.email,
      name: authUser.name || prev.name,
    }))

    const onboardingCompleted =
      hasCompletedOnboarding ||
      (typeof window !== "undefined" &&
        window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true")

    if (!onboardingCompleted) {
      navigateTo("/calibration")
    } else {
      navigateTo("/home")
    }
  }

  const handleSignOut = () => {
    signOut()
    disconnectGoogleCalendar()
    setTasks([])
    setGoals([])
    setEvents([])
    setReminders([])
    setTimetable([])
    setFocusSessions([])
    setPlatforms([])
    navigateTo("/")
  }

  const handleAccountDeleted = () => {
    disconnectGoogleCalendar()
    setTasks([])
    setGoals([])
    setEvents([])
    setReminders([])
    setTimetable([])
    setFocusSessions([])
    setPlatforms([])
    setEmail("")
    setAuthenticatedName("")
    setProfile({
      name: "",
      email: "",
      college: "",
      course: "",
      year: "",
      timezone: "",
    })
    setAccountDeletedMessage(
      "Your SAGE account and all associated personal data have been permanently deleted.",
    )
    navigateTo("/")
  }

  return (
    <>
      {accountDeletedMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            backgroundColor: "#dff6dd",
            color: "#107c41",
            padding: "12px 24px",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            border: "1px solid #92c353",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          <span>✓ {accountDeletedMessage}</span>
          <button
            onClick={() => setAccountDeletedMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "16px",
              color: "inherit",
            }}
          >
            ✕
          </button>
        </div>
      )}
      {flow === "landing" ? (
        <Landing start={authenticate} />
      ) : flow === "auth" ? (
        <Auth
          mode={authMode}
          back={() => navigateTo("/")}
          success={handleAuthSuccess}
        />
      ) : flow === "onboarding" ? (
        <Onboarding
          initialEmail={email || user?.email || ""}
          initialName={authenticatedName || user?.name || ""}
          initialTimetable={timetable}
          initialPreferences={preferences}
          initialNotifications={notifications}
          initialPlatforms={platforms}
          finish={(data) => {
            setProfile(data.profile)
            setUserItem("sage-user-profile", data.profile, user)
            const syncedEvents = syncEventsToCurrentWeek(data.events)
            setEvents(syncedEvents)
            setUserItem("sage-events", syncedEvents, user)
            setGoals(data.goals)
            setUserItem("sage-goals", data.goals, user)
            setPlatforms(data.platforms)
            setUserItem(PLATFORMS_STORAGE_KEY, data.platforms, user)
            setPreferences(data.preferences)
            setUserItem(USER_PREFERENCES_STORAGE_KEY, data.preferences, user)
            setNotifications(data.notifications)
            setUserItem(NOTIFICATIONS_STORAGE_KEY, data.notifications, user)
            if (data.reminders) {
              setReminders(data.reminders)
              saveReminders(data.reminders, user)
            }
            if (data.timetable) {
              setTimetable(data.timetable)
              saveTimetable(data.timetable, user)
            }
            completeOnboarding(data.profile)
            navigateTo("/home")
          }}
        />
      ) : (
        <Workspace
          profile={profile}
          setProfile={setProfile}
          tasks={tasks}
          setTasks={setTasks}
          goals={goals}
          setGoals={setGoals}
          events={events}
          setEvents={setEvents}
          reminders={reminders}
          setReminders={setReminders}
          platforms={platforms}
          setPlatforms={setPlatforms}
          timetable={timetable}
          setTimetable={setTimetable}
          preferences={preferences}
          setPreferences={setPreferences}
          notifications={notifications}
          setNotifications={setNotifications}
          focusSessions={focusSessions}
          setFocusSessions={setFocusSessions}
          signOut={handleSignOut}
          onAccountDeleted={handleAccountDeleted}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </FluentProvider>
  )
}
