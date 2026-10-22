import { useState, useEffect, useRef, useMemo, type KeyboardEvent, type ReactNode } from "react"
import { askSage, type SageContext } from "../services/sageService.ts"
import { taskService } from "../services/taskService.ts"
import { resolveCourseName, saveTimetable, type TimetableEntry } from "../timetable.ts"
import type { Task, EventItem } from "../decision/decisionTypes.ts"
import {
  type ChatMessage,
  type MessageRole,
  type MessageStatus,
  type ChatAttachment,
  type TaskCandidate,
  type TimetableCandidate,
  type SageActionPayload,
  DEFAULT_SUGGESTIONS,
  formatTime,
  buildTaskContext,
  validateAttachment,
  parseSageAction,
  detectTimetableConflicts,
} from "./chatbotTypes.ts"
import "./AskSageChatbot.css"

export type { ChatMessage, MessageRole, MessageStatus, ChatAttachment, TaskCandidate, TimetableCandidate, SageActionPayload }

type IconName =
  | "arrow"
  | "check"
  | "close"
  | "copy"
  | "history"
  | "image"
  | "mic"
  | "refresh"
  | "send"
  | "sparkle"
  | "trash"
  | "document"
  | "calendar"
  | "alert"
  | "plus"
  | "undo"

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    copy: (
      <>
        <rect width="13" height="13" x="9" y="9" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    image: (
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    mic: (
      <>
        <rect width="8" height="13" x="8" y="2" rx="4" />
        <path d="M4 10a8 8 0 0 0 16 0M12 18v4M8 22h8" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3-1.1 3.1A7.4 7.4 0 0 1 6.1 11L3 12l3.1 1.1a7.4 7.4 0 0 1 4.8 4.8L12 21l1.1-3.1a7.4 7.4 0 0 1 4.8-4.8L21 12l-3.1-1.1a7.4 7.4 0 0 1-4.8-4.8Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </>
    ),
    calendar: (
      <>
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    alert: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
    undo: (
      <>
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

export function SuggestionChips({
  onSelect,
}: {
  onSelect: (value: string) => void
}) {
  return (
    <div className="suggestions" aria-label="Suggested prompts">
      {DEFAULT_SUGGESTIONS.map((suggestion) => (
        <button
          className="suggestion-chip"
          key={suggestion}
          onClick={() => onSelect(suggestion)}
        >
          <span>{suggestion}</span>
          <Icon name="arrow" />
        </button>
      ))}
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="thinking" role="status" aria-label="SAGE is thinking">
      <span />
      <span />
      <span />
      <small>Thinking through it</small>
    </div>
  )
}

function renderFormattedMessage(text: string): ReactNode {
  const paragraphs = text.split(/\n{2,}/)
  return paragraphs.map((para, pIdx) => {
    const lines = para.split("\n")
    return (
      <p key={pIdx}>
        {lines.map((line, lIdx) => {
          const parts = line.split(/(\*\*.*?\*\*)/g)
          return (
            <span key={lIdx}>
              {parts.map((part, partIdx) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <strong key={partIdx}>{part.slice(2, -2)}</strong>
                  )
                }
                return part
              })}
              {lIdx < lines.length - 1 && <br />}
            </span>
          )
        })}
      </p>
    )
  })
}

function TaskCandidatesCard({
  payload,
  onTaskAdd,
  onTaskUndo,
}: {
  payload: SageActionPayload
  onTaskAdd: (task: TaskCandidate) => void
  onTaskUndo: (task: TaskCandidate) => void
}) {
  const tasks = payload.tasks || []
  if (tasks.length === 0) return null

  return (
    <div className="action-card" aria-label="Extracted task candidates">
      <div className="action-card-header">
        <div className="action-card-title">
          <Icon name="check" />
          <span>Extracted Task Candidates ({tasks.length})</span>
        </div>
      </div>

      {(payload.clarificationNeeded || tasks.some((t) => t.isAmbiguous)) && (
        <div className="ambiguity-alert" role="alert">
          <Icon name="alert" />
          <div>
            <strong>Deadline Ambiguity Detected:</strong>{" "}
            {payload.clarificationNeeded ||
              "One or more deadlines could not be resolved with 100% certainty. Please review carefully."}
          </div>
        </div>
      )}

      {tasks.map((task, idx) => {
        const isCreated = task.creationStatus === "created"
        return (
          <div className="candidate-item" key={task.id || idx}>
            <div className="candidate-top">
              <span className="candidate-title">{task.title}</span>
              <div className="candidate-badges">
                {task.priority && (
                  <span className={`badge badge--${task.priority.toLowerCase()}`}>
                    {task.priority}
                  </span>
                )}
                {task.confidence && (
                  <span className="badge badge--clean">
                    {task.confidence} confidence
                  </span>
                )}
              </div>
            </div>

            {task.description && (
              <p style={{ fontSize: "12px", color: "var(--ink-muted)", margin: "2px 0" }}>
                {task.description}
              </p>
            )}

            <div className="candidate-meta">
              {task.dueDate && (
                <span>
                  <Icon name="calendar" />
                  {task.dueDate} {task.dueTime ? `at ${task.dueTime}` : ""}
                </span>
              )}
              {task.category && <span>Category: {task.category}</span>}
            </div>

            {task.sourceSnippet && (
              <div className="candidate-snippet">
                “{task.sourceSnippet}”
              </div>
            )}

            <div className="candidate-actions">
              {isCreated ? (
                <>
                  <span className="action-btn action-btn--created">
                    <Icon name="check" /> Added (#{task.createdTaskId})
                  </span>
                  <button
                    className="action-btn action-btn--undo"
                    onClick={() => onTaskUndo(task)}
                    title="Remove from SAGE Tasks"
                  >
                    <Icon name="undo" /> Undo
                  </button>
                </>
              ) : (
                <button
                  className="action-btn action-btn--primary"
                  onClick={() => onTaskAdd(task)}
                >
                  <Icon name="plus" /> Add to Tasks
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TimetablePreviewCard({
  payload,
  existingTimetable = [],
  onImport,
}: {
  payload: SageActionPayload
  existingTimetable?: TimetableEntry[]
  onImport: (cleanEntries: TimetableCandidate[]) => void
}) {
  const [imported, setImported] = useState(false)
  const candidates = useMemo(() => {
    return detectTimetableConflicts(payload.timetable || [], existingTimetable)
  }, [payload.timetable, existingTimetable])

  if (candidates.length === 0) return null

  const cleanCount = candidates.filter((c) => !c.isDuplicate && !c.isConflict).length
  const conflictCount = candidates.filter((c) => c.isConflict).length
  const duplicateCount = candidates.filter((c) => c.isDuplicate).length

  return (
    <div className="action-card" aria-label="Extracted timetable preview">
      <div className="action-card-header">
        <div className="action-card-title">
          <Icon name="calendar" />
          <span>Extracted Timetable Preview ({candidates.length} periods)</span>
        </div>
        <div style={{ fontSize: "11px", color: "var(--ink-faint)" }}>
          {cleanCount} new · {conflictCount} conflicts · {duplicateCount} duplicates
        </div>
      </div>

      {conflictCount > 0 && (
        <div className="ambiguity-alert" role="alert">
          <Icon name="alert" />
          <div>
            <strong>Schedule Conflicts Detected:</strong> Some extracted classes overlap with your existing timetable entries.
          </div>
        </div>
      )}

      <table className="timetable-preview-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Time</th>
            <th>Course</th>
            <th>Room</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((cand, idx) => (
            <tr key={cand.id || idx}>
              <td><strong>{cand.dayName}</strong></td>
              <td>{cand.startTime}–{cand.endTime}</td>
              <td>
                <div>{cand.courseCode}</div>
                {cand.courseName && cand.courseName !== cand.courseCode && (
                  <small style={{ color: "var(--ink-faint)" }}>{cand.courseName}</small>
                )}
              </td>
              <td>{cand.location || "—"}</td>
              <td>
                {cand.isDuplicate ? (
                  <span className="badge badge--duplicate">Already added</span>
                ) : cand.isConflict ? (
                  <span className="badge badge--conflict" title={cand.conflictReason}>
                    Conflict
                  </span>
                ) : (
                  <span className="badge badge--clean">Ready</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="candidate-actions">
        {imported ? (
          <span className="action-btn action-btn--created">
            <Icon name="check" /> Imported into your academic schedule
          </span>
        ) : (
          <button
            className="action-btn action-btn--primary"
            disabled={cleanCount === 0}
            onClick={() => {
              const clean = candidates.filter((c) => !c.isDuplicate)
              onImport(clean)
              setImported(true)
            }}
          >
            <Icon name="plus" /> Import {cleanCount} Classes into Timetable
          </button>
        )}
      </div>
    </div>
  )
}

export function MessageBubble({
  message,
  existingTimetable = [],
  onRetry,
  onTaskAdd,
  onTaskUndo,
  onTimetableImport,
}: {
  message: ChatMessage
  existingTimetable?: TimetableEntry[]
  onRetry?: (message: ChatMessage) => void
  onTaskAdd?: (task: TaskCandidate) => void
  onTaskUndo?: (task: TaskCandidate) => void
  onTimetableImport?: (entries: TimetableCandidate[]) => void
}) {
  const [copied, setCopied] = useState(false)

  async function copyResponse() {
    const rawText =
      typeof message.content === "string"
        ? message.content
        : (message.errorMessage ?? "")
    if (!rawText) return
    try {
      await navigator.clipboard.writeText(rawText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  return (
    <article
      className={`message message--${message.role}`}
      aria-label={`${message.role} message`}
    >
      {message.role === "assistant" && (
        <div className="assistant-mark" aria-hidden="true">
          <Icon name="sparkle" />
        </div>
      )}
      <div className="message-body">
        {message.attachment && (
          <div className="message-attachment-card">
            {message.attachment.type.startsWith("image/") ? (
              <img
                src={message.attachment.dataUrl}
                alt={message.attachment.name}
                className="message-attachment-thumb"
                onClick={() => window.open(message.attachment?.dataUrl, "_blank")}
              />
            ) : null}
            <div className="message-attachment-meta">
              <Icon name={message.attachment.isPdf ? "document" : "image"} />
              <span>{message.attachment.name}</span>
              <small>({(message.attachment.size / 1024).toFixed(0)} KB)</small>
            </div>
          </div>
        )}

        {message.status === "thinking" ? (
          <ThinkingIndicator />
        ) : message.status === "error" ? (
          <div className="error-message" role="alert">
            <strong>That response didn’t come through.</strong>
            <p>
              {message.errorMessage ?? "Check your connection and try again."}
            </p>
            <button
              className="retry-button"
              onClick={() => onRetry?.(message)}
            >
              <Icon name="refresh" />
              Try again
            </button>
          </div>
        ) : (
          <div className="message-content">
            {typeof message.content === "string"
              ? renderFormattedMessage(message.content)
              : message.content}

            {message.actionPayload?.type === "tasks" && onTaskAdd && onTaskUndo && (
              <TaskCandidatesCard
                payload={message.actionPayload}
                onTaskAdd={onTaskAdd}
                onTaskUndo={onTaskUndo}
              />
            )}

            {message.actionPayload?.type === "timetable" && onTimetableImport && (
              <TimetablePreviewCard
                payload={message.actionPayload}
                existingTimetable={existingTimetable}
                onImport={onTimetableImport}
              />
            )}
          </div>
        )}

        <div className="message-meta">
          {message.timestamp && <time>{message.timestamp}</time>}
          {message.role === "assistant" &&
            message.status !== "thinking" &&
            message.status !== "error" && (
              <button
                className="message-action"
                onClick={copyResponse}
                aria-label="Copy response"
              >
                <Icon name={copied ? "check" : "copy"} />
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
        </div>
      </div>
    </article>
  )
}

export function MessageList({
  messages,
  existingTimetable = [],
  onRetry,
  onTaskAdd,
  onTaskUndo,
  onTimetableImport,
}: {
  messages: ChatMessage[]
  existingTimetable?: TimetableEntry[]
  onRetry?: (message: ChatMessage) => void
  onTaskAdd?: (task: TaskCandidate) => void
  onTaskUndo?: (task: TaskCandidate) => void
  onTimetableImport?: (entries: TimetableCandidate[]) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  return (
    <div className="message-list" aria-live="polite">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          existingTimetable={existingTimetable}
          onRetry={onRetry}
          onTaskAdd={onTaskAdd}
          onTaskUndo={onTaskUndo}
          onTimetableImport={onTimetableImport}
        />
      ))}
      <div ref={endRef} />
    </div>
  )
}

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  attachment,
  isRecording,
  attachmentError,
  onFileSelected,
  onRemoveAttachment,
  onVoiceClick,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  attachment?: ChatAttachment | null
  isRecording?: boolean
  attachmentError?: string | null
  onFileSelected?: (file: File) => void
  onRemoveAttachment?: () => void
  onVoiceClick?: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if ((value.trim() || attachment) && !disabled) {
        onSend()
      }
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && onFileSelected) {
      onFileSelected(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const canSend = !disabled && (value.trim().length > 0 || Boolean(attachment))

  return (
    <div className="composer-shell">
      {attachmentError && (
        <div className="attachment-error-banner" role="alert">
          <Icon name="alert" />
          <span>{attachmentError}</span>
        </div>
      )}

      {attachment && (
        <div className="composer-attachment-bar">
          <div className="composer-attachment-info">
            {attachment.type.startsWith("image/") ? (
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="composer-attachment-thumb"
              />
            ) : (
              <div className="composer-attachment-icon">PDF</div>
            )}
            <div className="composer-attachment-text">
              <strong>{attachment.name}</strong>
              <small>{(attachment.size / 1024).toFixed(0)} KB ready to send</small>
            </div>
          </div>
          <button
            className="composer-attachment-remove"
            onClick={onRemoveAttachment}
            aria-label="Remove attached file"
          >
            <Icon name="close" />
          </button>
        </div>
      )}

      <div className="composer">
        <label className="sr-only" htmlFor="sage-message">
          Message Ask SAGE
        </label>
        <textarea
          id="sage-message"
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask about studies, paste forwarded notices, or attach syllabus/timetable…"
        />
        <div className="composer-footer">
          <div className="composer-tools">
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={handleFileInputChange}
            />
            <button
              className="tool-button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach an image or PDF timetable"
              title="Attach an image or PDF timetable"
              disabled={disabled}
            >
              <Icon name="image" />
            </button>
            <button
              className={`tool-button ${isRecording ? "tool-button--recording" : ""}`}
              onClick={onVoiceClick}
              aria-label={
                isRecording ? "Stop voice recording" : "Start voice recording"
              }
              aria-pressed={isRecording}
              disabled={disabled}
            >
              <Icon name="mic" />
              {isRecording && <span>Listening</span>}
            </button>
            <span className="shortcut">
              <kbd>Enter</kbd> to send · <kbd>Shift Enter</kbd> for a new line
            </span>
          </div>
          <button
            className="send-button"
            onClick={onSend}
            disabled={!canSend}
            aria-label={disabled ? "Sending message" : "Send message"}
          >
            {disabled ? (
              <span className="send-spinner" />
            ) : (
              <Icon name="send" />
            )}
          </button>
        </div>
      </div>
      <p className="disclaimer">
        SAGE can make mistakes. Verify important study information.
      </p>
    </div>
  )
}

const SAGE_CHAT_STORAGE_KEY = "sage_figma_chat_history_v2"
const SAGE_CONVERSATION_ID_KEY = "sage_figma_conversation_id_v2"
const SAGE_AUTO_MODE_KEY = "sage_auto_create_tasks_v1"

export type AskSageChatbotProps = {
  tasks?: Task[]
  events?: EventItem[]
  timetable?: TimetableEntry[]
  onTaskCreated?: (task: Task) => void
  onTimetableImported?: (entries: TimetableEntry[]) => void
  onEventsCreated?: (events: EventItem[]) => void
  onFocusTask?: (task: any) => void
  className?: string
}

export function AskSageChatbot({
  tasks = [],
  events = [],
  timetable = [],
  onTaskCreated,
  onTimetableImported,
  onEventsCreated,
  className = "",
}: AskSageChatbotProps) {
  const [value, setValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null)

  const [autoMode, setAutoMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return window.sessionStorage.getItem(SAGE_AUTO_MODE_KEY) === "true"
    } catch {
      return false
    }
  })

  const [conversationId, setConversationId] = useState<string | undefined>(
    () => {
      if (typeof window === "undefined") return undefined
      try {
        return (
          window.sessionStorage.getItem(SAGE_CONVERSATION_ID_KEY) || undefined
        )
      } catch {
        return undefined
      }
    },
  )

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = window.sessionStorage.getItem(SAGE_CHAT_STORAGE_KEY)
      return stored ? (JSON.parse(stored) as ChatMessage[]) : []
    } catch {
      return []
    }
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  // Persist messages to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (messages.length > 0) {
        window.sessionStorage.setItem(
          SAGE_CHAT_STORAGE_KEY,
          JSON.stringify(messages),
        )
      } else {
        window.sessionStorage.removeItem(SAGE_CHAT_STORAGE_KEY)
      }
    } catch {}
  }, [messages])

  // Persist conversationId
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (conversationId) {
        window.sessionStorage.setItem(SAGE_CONVERSATION_ID_KEY, conversationId)
      } else {
        window.sessionStorage.removeItem(SAGE_CONVERSATION_ID_KEY)
      }
    } catch {}
  }, [conversationId])

  // Persist autoMode
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.sessionStorage.setItem(SAGE_AUTO_MODE_KEY, String(autoMode))
    } catch {}
  }, [autoMode])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const handleFileSelected = (file: File) => {
    const val = validateAttachment(file)
    if (!val.valid) {
      setAttachmentError(val.error || "Invalid file.")
      window.setTimeout(() => setAttachmentError(null), 4500)
      return
    }

    setAttachmentError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setAttachment({
        id: `att-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: result,
        isPdf: file.type === "application/pdf",
      })
    }
    reader.onerror = () => {
      setAttachmentError("Failed to read the selected file.")
      window.setTimeout(() => setAttachmentError(null), 4500)
    }
    reader.readAsDataURL(file)
  }

  const handleCreateSingleTask = async (candidate: TaskCandidate, messageId?: string) => {
    try {
      const priorityFormatted =
        candidate.priority === "HIGH" ? "High" : candidate.priority === "LOW" ? "Low" : "Medium"

      const created = await taskService.createTask({
        title: candidate.title,
        description: candidate.description,
        dueDate: candidate.dueDate,
        dueTime: candidate.dueTime,
        priority: priorityFormatted,
        category: candidate.category || "Academic",
        status: "open",
      })

      if (created && created.id) {
        onTaskCreated?.(created)

        // Update the message's action payload state
        setMessages((prev) =>
          prev.map((msg) => {
            if (messageId && msg.id !== messageId) return msg
            if (msg.actionPayload?.type === "tasks" && msg.actionPayload.tasks) {
              const updatedTasks = msg.actionPayload.tasks.map((t) => {
                if (t.title === candidate.title) {
                  return {
                    ...t,
                    creationStatus: "created" as const,
                    createdTaskId: created.id,
                  }
                }
                return t
              })
              return {
                ...msg,
                actionPayload: { ...msg.actionPayload, tasks: updatedTasks },
              }
            }
            return msg
          }),
        )
      }
    } catch (err) {
      console.error("Failed to create task from candidate:", err)
    }
  }

  const handleUndoTask = async (candidate: TaskCandidate, messageId?: string) => {
    if (!candidate.createdTaskId) return
    try {
      await taskService.deleteTask(candidate.createdTaskId)

      setMessages((prev) =>
        prev.map((msg) => {
          if (messageId && msg.id !== messageId) return msg
          if (msg.actionPayload?.type === "tasks" && msg.actionPayload.tasks) {
            const updatedTasks = msg.actionPayload.tasks.map((t) => {
              if (t.createdTaskId === candidate.createdTaskId) {
                return {
                  ...t,
                  creationStatus: "pending" as const,
                  createdTaskId: undefined,
                }
              }
              return t
            })
            return {
              ...msg,
              actionPayload: { ...msg.actionPayload, tasks: updatedTasks },
            }
          }
          return msg
        }),
      )
    } catch (err) {
      console.error("Failed to undo task creation:", err)
    }
  }

  const handleImportTimetable = (cleanCandidates: TimetableCandidate[]) => {
    if (cleanCandidates.length === 0) return

    const newTimetableEntries: TimetableEntry[] = cleanCandidates.map((c, idx) => {
      const cleanCode = (c.courseCode || "").trim().toUpperCase()
      const resolved = resolveCourseName(cleanCode)
      return {
        id: `tt-import-${Date.now()}-${idx}`,
        dayOfWeek: Number(c.dayOfWeek) || 1,
        dayName: c.dayName || "Monday",
        courseCode: cleanCode,
        courseName: c.courseName || resolved.name,
        isKnownCourse: resolved.isKnown,
        startTime: c.startTime,
        endTime: c.endTime,
        startPeriod: 1,
        endPeriod: 2,
        location: c.location,
        faculty: c.faculty,
        recurring: true,
      }
    })

    const mergedTimetable = [...timetable, ...newTimetableEntries]
    saveTimetable(mergedTimetable)
    onTimetableImported?.(newTimetableEntries)

    // Generate corresponding calendar events
    const today = new Date().toISOString().slice(0, 10)
    const newEvents: EventItem[] = newTimetableEntries.map((entry, idx) => ({
      id: Date.now() + idx + 1000,
      title: `${entry.courseName} (${entry.courseCode})`,
      type: "Class",
      date: today,
      time: entry.startTime,
      endTime: entry.endTime,
      source: "sage" as const,
      dayOfWeek: entry.dayOfWeek,
      isRecurring: true,
    }))
    onEventsCreated?.(newEvents)
  }

  const handleSend = async (textToSend: string, isRetry = false) => {
    const cleanText = textToSend.trim()
    const currentAttachment = attachment
    if ((!cleanText && !currentAttachment) || isLoading) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const nowFormatted = formatTime()

    if (!isRetry) {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: cleanText || "Please analyze this attached document/image.",
        timestamp: nowFormatted,
        status: "sent",
        attachment: currentAttachment || undefined,
      }
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: `thinking-${Date.now()}`,
          role: "assistant",
          status: "thinking",
        },
      ])
      setValue("")
      setAttachment(null)
    } else {
      setMessages((prev) => [
        ...prev.filter((m) => m.status !== "error"),
        {
          id: `thinking-${Date.now()}`,
          role: "assistant",
          status: "thinking",
        },
      ])
    }

    setIsLoading(true)
    setLastFailedPrompt(null)

    const context: SageContext = buildTaskContext(tasks, events)

    const sageAttachment = currentAttachment
      ? {
          mimeType: currentAttachment.type,
          data: currentAttachment.dataUrl,
          name: currentAttachment.name,
        }
      : undefined

    try {
      const response = await askSage(
        {
          message: cleanText,
          conversationId,
          context,
          attachment: sageAttachment,
        },
        controller.signal,
      )

      if (response.conversationId) {
        setConversationId(response.conversationId)
      }

      // Parse structured action block if present
      const { displayText, actionPayload } = parseSageAction(response.message)
      const assistantMessageId = response.responseId || `sage-${Date.now()}`

      // If Auto-mode is active, automatically create high-confidence unambiguous tasks
      if (autoMode && actionPayload?.type === "tasks" && actionPayload.tasks) {
        actionPayload.tasks.forEach((candidate) => {
          if (candidate.confidence === "high" && !candidate.isAmbiguous) {
            handleCreateSingleTask(candidate, assistantMessageId)
          }
        })
      }

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: displayText,
        timestamp: formatTime(),
        status: "sent",
        actionPayload,
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.status !== "thinking"),
        assistantMessage,
      ])
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return
      }

      const errorText =
        err instanceof Error && err.message
          ? err.message
          : "SAGE couldn't respond right now. Please try again."

      setLastFailedPrompt(cleanText)
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        status: "error",
        errorMessage: errorText,
        timestamp: formatTime(),
      }
      setMessages((prev) => [
        ...prev.filter((m) => m.status !== "thinking"),
        errorMessage,
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = () => {
    if (lastFailedPrompt) {
      handleSend(lastFailedPrompt, true)
    }
  }

  const handleClear = () => {
    setMessages([])
    setConversationId(undefined)
    setLastFailedPrompt(null)
    setAttachment(null)
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(SAGE_CHAT_STORAGE_KEY)
        window.sessionStorage.removeItem(SAGE_CONVERSATION_ID_KEY)
      } catch {}
    }
  }

  return (
    <div className={`sage-chatbot-root ${className}`}>
      <main className="app-shell">
        <header className="header">
          <div className="brand">
            <div className="brand-mark">
              <Icon name="sparkle" />
            </div>
            <div>
              <span className="eyebrow">Ask SAGE Copilot</span>
              <h2>Multimodal Assistant</h2>
            </div>
          </div>
          <div className="header-actions">
            <button
              className={`auto-mode-toggle ${autoMode ? "auto-mode-toggle--active" : ""}`}
              onClick={() => setAutoMode((prev) => !prev)}
              title={
                autoMode
                  ? "Auto-create active: High-confidence tasks are saved directly. Click for review mode."
                  : "Review mode active: Previews tasks before saving. Click to enable auto-create."
              }
            >
              <span>Auto-create tasks</span>
              <span className="auto-mode-pill">{autoMode ? "Auto" : "Review"}</span>
            </button>
            <span className="powered" aria-hidden="true">
              Gemini Multimodal
            </span>
            <button
              className="clear-button"
              onClick={() => setShowHistory(true)}
              aria-label="Open conversation history"
            >
              <Icon name="history" />
              <span>History</span>
            </button>
            <button
              className="clear-button"
              onClick={handleClear}
              disabled={messages.length === 0}
              aria-label="Clear current conversation"
            >
              <Icon name="trash" />
              <span>Clear chat</span>
            </button>
          </div>
        </header>

        <section
          className="conversation"
          aria-label="Conversation with Ask SAGE"
        >
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="orb" aria-hidden="true">
                <Icon name="sparkle" />
              </div>
              <p className="empty-kicker">MULTIMODAL STUDY COPILOT</p>
              <h1>What should we work on today?</h1>
              <p className="empty-subtitle">
                Forward course announcements, upload photos of your timetable, or ask
                questions. SAGE automatically extracts tasks and schedules directly into your workspace.
              </p>
              <SuggestionChips onSelect={(prompt) => handleSend(prompt)} />
            </div>
          ) : (
            <MessageList
              messages={messages}
              existingTimetable={timetable}
              onRetry={handleRetry}
              onTaskAdd={handleCreateSingleTask}
              onTaskUndo={handleUndoTask}
              onTimetableImport={handleImportTimetable}
            />
          )}
        </section>

        <Composer
          value={value}
          onChange={setValue}
          onSend={() => handleSend(value)}
          disabled={isLoading}
          attachment={attachment}
          attachmentError={attachmentError}
          isRecording={isRecording}
          onFileSelected={handleFileSelected}
          onRemoveAttachment={() => setAttachment(null)}
          onVoiceClick={() => setIsRecording((current) => !current)}
        />
      </main>

      {showHistory && (
        <div
          className="history-backdrop"
          onClick={() => setShowHistory(false)}
        >
          <aside
            className="history-panel"
            aria-label="Chat history and sessions"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="history-header">
              <div>
                <span className="eyebrow">ASK SAGE</span>
                <h2>History</h2>
              </div>
              <button
                className="tool-button"
                onClick={() => setShowHistory(false)}
                aria-label="Close history"
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="history-caption">
              Review current session details or return to your earlier study
              plans.
            </p>
            <div className="history-day">ACTIVE SESSION</div>
            <button className="history-item history-item--active">
              <span>Current SAGE Dialogue</span>
              <small>
                {conversationId
                  ? `ID: ${conversationId.slice(0, 16)}...`
                  : "Active Context"}{" "}
                · {messages.length} messages
              </small>
            </button>
            <div className="history-day">SAMPLE PROMPTS</div>
            {DEFAULT_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                className="history-item"
                onClick={() => {
                  setShowHistory(false)
                  handleSend(s)
                }}
              >
                <span>{s}</span>
                <small>Quick start template</small>
              </button>
            ))}
            <div className="version-note">
              <Icon name="check" />
              <div>
                <strong>Grounded Multimodal AI Assistant</strong>
                <p>
                  Connected to Google Gemini with image, document, and timetable parsing.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
export default AskSageChatbot
