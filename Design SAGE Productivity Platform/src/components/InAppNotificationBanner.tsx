import React, { useEffect, useState } from "react"
import { Alert20Regular } from "@fluentui/react-icons/svg/alert"
import { Clock20Regular } from "@fluentui/react-icons/svg/clock"
import { Code20Regular } from "@fluentui/react-icons/svg/code"
import { Dismiss20Regular } from "@fluentui/react-icons/svg/dismiss"
import { CalendarLtr20Regular } from "@fluentui/react-icons/svg/calendar-ltr"
import { Button } from "@fluentui/react-button"
import { Text } from "@fluentui/react-text"
import { Badge } from "@fluentui/react-badge"
import type { Reminder } from "../notifications.ts"

export type InAppNotificationBannerProps = {
  alert: Reminder | null
  onDismiss: () => void
  onSnooze: (id: number) => void
  onView: (alert: Reminder) => void
}

export default function InAppNotificationBanner({
  alert,
  onDismiss,
  onSnooze,
  onView,
}: InAppNotificationBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (alert) {
      setVisible(true)
      // Auto-dismiss after 12 seconds if untouched
      const timer = setTimeout(() => {
        setVisible(false)
        onDismiss()
      }, 12000)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [alert])

  if (!alert || !visible) return null

  const isContest = alert.targetType === "contest"
  const isTask = alert.targetType === "task"
  const isExam = alert.targetType === "exam"

  const categoryLabel = isContest
    ? "UPCOMING CONTEST"
    : isTask
      ? "TASK DEADLINE"
      : isExam
        ? "EXAM SCHEDULED"
        : "REMINDER DUE"

  const icon = isContest ? (
    <Code20Regular style={{ color: "#38bdf8" }} />
  ) : isTask ? (
    <CalendarLtr20Regular style={{ color: "#f59e0b" }} />
  ) : isExam ? (
    <Clock20Regular style={{ color: "#ec4899" }} />
  ) : (
    <Alert20Regular style={{ color: "#60a5fa" }} />
  )

  const accentBorderColor = isContest
    ? "rgba(56, 189, 248, 0.45)"
    : isTask
      ? "rgba(245, 158, 11, 0.45)"
      : isExam
        ? "rgba(236, 72, 153, 0.45)"
        : "rgba(96, 165, 250, 0.45)"

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: "20px",
        right: "24px",
        zIndex: 99999,
        maxWidth: "460px",
        width: "calc(100vw - 48px)",
        background: "rgba(10, 20, 50, 0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: "14px",
        border: `1.5px solid ${accentBorderColor}`,
        boxShadow: "0 16px 36px rgba(0, 0, 0, 0.65), 0 0 20px rgba(59, 130, 246, 0.2)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        animation: "slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "3px",
            }}
          >
            <Badge
              appearance="filled"
              style={{
                fontSize: "10px",
                letterSpacing: "0.06em",
                fontWeight: 700,
                padding: "2px 6px",
                backgroundColor: isContest
                  ? "#0284c7"
                  : isTask
                    ? "#d97706"
                    : "#2563eb",
                color: "#ffffff",
              }}
            >
              {categoryLabel}
            </Badge>
            <span
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              🔔 In-App + ✉️ Email
            </span>
          </div>
          <Text
            as="div"
            weight="semibold"
            size={300}
            style={{
              color: "#f8fafc",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {alert.title}
          </Text>
          {(alert.eventStartTime || alert.time) && (
            <div
              style={{
                fontSize: "12px",
                color: "#38bdf8",
                marginTop: "3px",
                fontWeight: 500,
              }}
            >
              Scheduled: {alert.eventStartTime || `${alert.date} at ${alert.time}`}
            </div>
          )}
        </div>
        <Button
          appearance="subtle"
          size="small"
          icon={<Dismiss20Regular />}
          onClick={() => {
            setVisible(false)
            onDismiss()
          }}
          aria-label="Dismiss alert"
          style={{
            color: "#94a3b8",
            padding: "4px",
            minWidth: "auto",
            marginTop: "-2px",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "8px",
          marginTop: "4px",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          paddingTop: "10px",
        }}
      >
        <Button
          appearance="subtle"
          size="small"
          onClick={() => {
            onSnooze(alert.id)
            setVisible(false)
          }}
          style={{ color: "#cbd5e1" }}
        >
          Snooze 1h
        </Button>
        <Button
          appearance="primary"
          size="small"
          onClick={() => {
            onView(alert)
            setVisible(false)
          }}
          style={{
            backgroundColor: "#2563eb",
            fontWeight: 600,
          }}
        >
          {isContest ? "View Contest" : isTask ? "View Task" : "View Reminders"}
        </Button>
      </div>
    </div>
  )
}
