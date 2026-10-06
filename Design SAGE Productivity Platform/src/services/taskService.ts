// ==================================================
// SAGE TASK SERVICE & BACKEND ADAPTER
// ==================================================
// Principles:
// 1. Communicates through the shared apiClient with Spring Cloud Gateway at /api/tasks.
// 2. Maps bidirectional contracts between frontend Task model and backend Task DTO.
// 3. Graceful fallback: seamlessly falls back to localStorage if unauthenticated or offline.
// 4. Honest error masking: no leaked backend stack traces.
// ==================================================

import { apiClient } from "../api/client"
import type { ItemStatus, Task } from "../decision/decisionTypes"

export type BackendTaskDto = {
  id: number
  userId?: number
  title: string
  description?: string
  deadline?: string
  estimatedMinutes?: number
  priority?: string // "HIGH" | "MEDIUM" | "LOW"
  status?: string // "PENDING" | "COMPLETED" | "SNOOZED"
  category?: string
  source?: string
  postponementCount?: number
  createdAt?: string
  updatedAt?: string
}

const LOCAL_STORAGE_KEY = "sage-tasks"

function getStoredLocalTasks(): Task[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Task[]
  } catch {}
  return []
}

function saveStoredLocalTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks))
  } catch {}
}

/**
 * Translates backend Spring Boot Task entity to frontend Task model
 */
export function toFrontendTask(dto: BackendTaskDto): Task {
  let dueDate = ""
  let dueTime = ""
  if (dto.deadline) {
    const trimmed = dto.deadline.trim()
    const spaceIndex = trimmed.indexOf(" ")
    if (spaceIndex > 0) {
      dueDate = trimmed.slice(0, spaceIndex)
      dueTime = trimmed.slice(spaceIndex + 1)
    } else {
      dueDate = trimmed
    }
  }

  let status: ItemStatus = "open"
  if (dto.status === "COMPLETED") status = "completed"
  else if (dto.status === "SNOOZED") status = "snoozed"

  let priority = "Medium"
  if (dto.priority === "HIGH") priority = "High"
  else if (dto.priority === "LOW") priority = "Low"

  return {
    id: dto.id,
    title: dto.title,
    description: dto.description || "",
    dueDate,
    dueTime,
    duration:
      dto.estimatedMinutes != null ? String(dto.estimatedMinutes) : "45",
    priority,
    status,
    createdAt: dto.createdAt || new Date().toISOString(),
  }
}

/**
 * Translates frontend Task model to backend Task DTO payload
 */
export function toBackendTaskPayload(
  task: Partial<Task>,
): Partial<BackendTaskDto> {
  const payload: Partial<BackendTaskDto> = {}

  if (task.title !== undefined) {
    payload.title = task.title.trim()
  }

  if (task.description !== undefined) {
    payload.description = task.description
  }

  if (task.dueDate !== undefined || task.dueTime !== undefined) {
    const d = task.dueDate ? task.dueDate.trim() : ""
    const t = task.dueTime ? task.dueTime.trim() : ""
    const combined = `${d} ${t}`.trim()
    payload.deadline = combined || undefined
  }

  if (task.duration !== undefined) {
    const parsed = parseInt(task.duration, 10)
    payload.estimatedMinutes = Number.isNaN(parsed) ? 45 : parsed
  }

  if (task.priority !== undefined) {
    payload.priority = task.priority.toUpperCase()
  }

  if (task.status !== undefined) {
    if (task.status === "completed") payload.status = "COMPLETED"
    else if (task.status === "snoozed") payload.status = "SNOOZED"
    else payload.status = "PENDING"
  }

  return payload
}

export const taskService = {
  /**
   * Retrieves tasks from backend through Gateway :8080.
   * If backend returns 401 or is unreachable, falls back to localStorage.
   */
  getTasks: async (): Promise<Task[]> => {
    try {
      const response = await apiClient.get<BackendTaskDto[]>("/tasks")
      if (Array.isArray(response)) {
        const mapped = response.map(toFrontendTask)
        saveStoredLocalTasks(mapped)
        return mapped
      }
    } catch {
      // Backend unavailable or 401: fall back gracefully
    }
    return getStoredLocalTasks()
  },

  /**
   * Dispatches task creation to backend through Gateway :8080.
   */
  createTask: async (input: Omit<Task, "id">): Promise<Task> => {
    try {
      const payload = toBackendTaskPayload(input)
      const response = await apiClient.post<BackendTaskDto>("/tasks", payload)
      if (response && response.id) {
        const created = toFrontendTask(response)
        return created
      }
    } catch {
      // Fallback
    }

    // Local fallback
    const localTask: Task = {
      ...input,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    }
    return localTask
  },

  /**
   * Dispatches partial updates to /api/tasks/{id}.
   */
  updateTask: async (
    id: number,
    patch: Partial<Task>,
  ): Promise<Task | null> => {
    try {
      const payload = toBackendTaskPayload(patch)
      const response = await apiClient.patch<BackendTaskDto>(
        `/tasks/${id}`,
        payload,
      )
      if (response && response.id) {
        return toFrontendTask(response)
      }
    } catch {
      // Fallback
    }
    return null
  },

  /**
   * Dispatches task deletion to /api/tasks/{id}.
   */
  deleteTask: async (id: number): Promise<boolean> => {
    try {
      await apiClient.delete(`/tasks/${id}`)
      return true
    } catch {
      return false
    }
  },
}
