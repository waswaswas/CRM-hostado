'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOrganization } from '@/lib/organization-context'
import { useFeaturePermissions } from '@/lib/hooks/use-feature-permissions'
import { getUserRole } from '@/app/actions/organizations'
import {
  addManualTimeEntry,
  correctTimeEntry,
  createTodoAttachment,
  createTodoComment,
  createTodoList,
  createTodoProject,
  createTodoSubtask,
  createTodoTask,
  deleteTodoList,
  deleteTodoSubtask,
  deleteTodoTask,
  getRunningTimer,
  getTimeEntries,
  getTodoLists,
  getTodoProjects,
  getTodoTasks,
  getTotalMinutes,
  joinTodoListByCode,
  startTimer,
  stopTimer,
  toggleTodoSubtask,
  updateTodoList,
  updateTodoSubtask,
  updateTodoTask,
} from '@/app/actions/todo'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toaster'
import { Archive, Calendar, Check, Clock, Copy, FolderOpen, Pencil, Plus, Search, Settings, Square, Trash2, Users } from 'lucide-react'

type UserRole = 'owner' | 'admin' | 'moderator' | 'viewer'
type TaskStatus = 'to_do' | 'in_progress' | 'blocked' | 'done'
type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

type TodoListMember = {
  userId: string
  role: 'owner' | 'member'
}

type TodoList = {
  id: string
  name: string
  color: string
  createdBy: string
  createdAt: string
  members: TodoListMember[]
  invitationCode: string
}

type TodoProject = {
  id: string
  listId: string
  name: string
  description: string | null
  sortOrder: number
  isArchived: boolean
  createdAt: string
}

type TodoTask = {
  id: string
  listId: string
  projectId: string | null
  title: string
  description: string
  completed: boolean
  priority: TaskPriority
  dueDate: string | null
  status: TaskStatus
  assigneeId: string | null
  tags: string[]
  subtasks: { id: string; title: string; done: boolean; dueDate: string | null }[]
  comments: { id: string; text: string; createdAt: string }[]
  attachments: { id: string; name: string; url: string }[]
  updatedAt: string
}

const COLORS = ['#2563eb', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#0ea5e9']
const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

function mapListFromDb(list: any): TodoList {
  return {
    id: list.id,
    name: list.name,
    color: list.color,
    createdBy: list.created_by,
    createdAt: list.created_at,
    invitationCode: list.invitation_code,
    members: (list.todo_list_members || []).map((member: any) => ({
      userId: member.user_id,
      role: member.role,
    })),
  }
}

function mapProjectFromDb(p: any): TodoProject {
  return {
    id: p.id,
    listId: p.list_id,
    name: p.name,
    description: p.description ?? null,
    sortOrder: p.sort_order ?? 0,
    isArchived: p.is_archived ?? false,
    createdAt: p.created_at,
  }
}

function mapTaskFromDb(task: any): TodoTask {
  return {
    id: task.id,
    listId: task.list_id,
    projectId: task.project_id ?? null,
    title: task.title,
    description: task.description || '',
    completed: task.completed ?? false,
    priority: task.priority,
    dueDate: task.due_date || null,
    status: task.status,
    assigneeId: task.assignee_id || null,
    tags: task.tags || [],
    subtasks: (task.subtasks || []).map((subtask: any) => ({
      id: subtask.id,
      title: subtask.title,
      done: subtask.done,
      dueDate: subtask.due_date ?? null,
    })),
    comments: (task.comments || []).map((comment: any) => ({
      id: comment.id,
      text: comment.content,
      createdAt: comment.created_at,
    })),
    attachments: (task.attachments || []).map((attachment: any) => ({
      id: attachment.id,
      name: attachment.file_name,
      url: attachment.file_url,
    })),
    updatedAt: task.updated_at,
  }
}

export default function TodoPage() {
  const { currentOrganization } = useOrganization()
  const { permissions, loading: permissionsLoading } = useFeaturePermissions()
  const { toast } = useToast()
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('viewer')
  const [lists, setLists] = useState<TodoList[]>([])
  const [projects, setProjects] = useState<TodoProject[]>([])
  const [tasks, setTasks] = useState<TodoTask[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [inviteCodeInput, setInviteCodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [dueFilter, setDueFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('due_date')
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newComment, setNewComment] = useState('')
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('')
  const [loadingLists, setLoadingLists] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [timeEntries, setTimeEntries] = useState<Array<{ id: string; entry_type: string; duration_minutes: number; note: string | null; created_at: string; corrected_entry_id: string | null }>>([])
  const [timeTotalMinutes, setTimeTotalMinutes] = useState(0)
  const [runningTimer, setRunningTimer] = useState<{ id: string; task_id: string; started_at: string } | null>(null)
  const [manualTimeMinutes, setManualTimeMinutes] = useState('')
  const [manualTimeNote, setManualTimeNote] = useState('')
  const [correctingEntryId, setCorrectingEntryId] = useState<string | null>(null)
  const [correctDuration, setCorrectDuration] = useState('')
  const [timerLoading, setTimerLoading] = useState(false)

  useEffect(() => {
    async function loadUserContext() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      setUserId(data.user?.id ?? null)
      if (currentOrganization?.id) {
        const role = await getUserRole(currentOrganization.id)
        if (role) {
          setUserRole(role)
        }
      }
    }
    loadUserContext()
  }, [currentOrganization?.id])

  useEffect(() => {
    if (!currentOrganization?.id || permissionsLoading) return
    if (!permissions.todo) return
    async function loadLists() {
      setLoadingLists(true)
      try {
        const data = await getTodoLists()
        setLists(data.map(mapListFromDb))
      } finally {
        setLoadingLists(false)
      }
    }
    loadLists()
  }, [currentOrganization?.id, permissions.todo, permissionsLoading])

  useEffect(() => {
    if (!activeListId) {
      setProjects([])
      setTasks([])
      setActiveProjectId(null)
      return
    }
    setActiveProjectId(null)
    const listId = activeListId
    async function loadProjects() {
      try {
        const data = await getTodoProjects(listId)
        setProjects(data.map(mapProjectFromDb))
      } catch {
        setProjects([])
      }
    }
    loadProjects()
  }, [activeListId])

  useEffect(() => {
    if (!activeListId) {
      setTasks([])
      return
    }
    const listId = activeListId
    const projectId = activeProjectId
    async function loadTasks() {
      setLoadingTasks(true)
      try {
        const data = await getTodoTasks(listId, projectId ?? undefined)
        setTasks(data.map(mapTaskFromDb))
      } finally {
        setLoadingTasks(false)
      }
    }
    loadTasks()
  }, [activeListId, activeProjectId])

  const visibleLists = useMemo(() => {
    if (!userId) return []
    if (userRole === 'owner' || userRole === 'admin') {
      return lists
    }
    return lists.filter((list) => list.members.some((member) => member.userId === userId))
  }, [lists, userId, userRole])

  useEffect(() => {
    if (!activeListId) return
    if (!visibleLists.some((list) => list.id === activeListId)) {
      setActiveListId(null)
      setActiveTaskId(null)
    }
  }, [activeListId, visibleLists])

  const activeList = lists.find((list) => list.id === activeListId) || null
  const listTasks = tasks.filter((task) => task.listId === activeListId)

  const filteredTasks = useMemo(() => {
    return listTasks
      .filter((task) => {
        const matchesSearch =
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
        const matchesAssignee =
          assigneeFilter === 'all' ||
          (assigneeFilter === 'unassigned' && !task.assigneeId) ||
          (assigneeFilter === 'me' && task.assigneeId === userId)
        const now = new Date()
        const dueDate = task.dueDate ? new Date(task.dueDate) : null
        const matchesDue =
          dueFilter === 'all' ||
          (dueFilter === 'overdue' && dueDate && dueDate < now) ||
          (dueFilter === 'next_7_days' &&
            dueDate &&
            dueDate >= now &&
            dueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))
        return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesDue
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const order: TaskPriority[] = ['critical', 'high', 'medium', 'low']
          return order.indexOf(a.priority) - order.indexOf(b.priority)
        }
        if (sortBy === 'updated') {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        }
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
        return dateA - dateB
      })
  }, [listTasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, dueFilter, sortBy, userId])

  const selectedTasks = filteredTasks.filter((task) => selectedTaskIds.has(task.id))
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null

  const isFirstTime = visibleLists.length === 0
  const hasAccess = permissions.todo

  useEffect(() => {
    setNewSubtaskTitle('')
    setNewComment('')
    setNewAttachmentUrl('')
  }, [activeTaskId])

  useEffect(() => {
    if (!activeTaskId || !activeListId) {
      setTimeEntries([])
      setTimeTotalMinutes(0)
      setRunningTimer(null)
      return
    }
    async function loadTime() {
      try {
        const [entries, total, running] = await Promise.all([
          getTimeEntries(activeTaskId),
          getTotalMinutes(activeTaskId),
          getRunningTimer(activeListId),
        ])
        setTimeEntries(entries)
        setTimeTotalMinutes(total)
        setRunningTimer(running && running.is_running ? { id: running.id, task_id: running.task_id, started_at: running.started_at } : null)
      } catch {
        setTimeEntries([])
        setTimeTotalMinutes(0)
        setRunningTimer(null)
      }
    }
    loadTime()
  }, [activeTaskId, activeListId])

  async function refreshLists() {
    const data = await getTodoLists()
    setLists(data.map(mapListFromDb))
  }

  async function refreshProjects(listId: string) {
    const data = await getTodoProjects(listId)
    setProjects(data.map(mapProjectFromDb))
  }

  async function refreshTasks(listId: string, projectId?: string | null) {
    const data = await getTodoTasks(listId, projectId ?? undefined)
    setTasks(data.map(mapTaskFromDb))
  }

  async function handleCreateList(data: { name: string; color: string }) {
    if (!userId) return
    const newList = await createTodoList({ name: data.name, color: data.color })
    await refreshLists()
    setActiveListId(newList.id)
    setShowCreateDialog(false)
  }

  async function handleJoinList() {
    if (!inviteCodeInput.trim()) return
    const list = await joinTodoListByCode(inviteCodeInput.trim().toUpperCase())
    setInviteCodeInput('')
    await refreshLists()
    setActiveListId(list.id)
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) {
      toast({ title: 'Enter a task title', variant: 'destructive' })
      return
    }
    if (!activeListId) return
    setAddingTask(true)
    try {
      await createTodoTask(activeListId, newTaskTitle.trim(), activeProjectId ?? undefined)
      setNewTaskTitle('')
      await refreshTasks(activeListId, activeProjectId)
    } catch (err) {
      toast({
        title: 'Could not create task',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setAddingTask(false)
    }
  }

  async function handleCreateProject(name: string) {
    if (!activeListId || !name.trim()) return
    await createTodoProject(activeListId, { name: name.trim() })
    await refreshProjects(activeListId)
    setShowCreateProjectDialog(false)
  }

  async function handleUpdateTask(taskId: string, updates: Partial<TodoTask>) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
      )
    )
    try {
      await updateTodoTask(taskId, updates as any)
    } catch (error) {
      if (activeListId) {
        await refreshTasks(activeListId, activeProjectId)
      }
    }
  }

  async function handleDeleteTask(taskId: string) {
    await deleteTodoTask(taskId)
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }

  async function handleBulkDelete() {
    await Promise.all(Array.from(selectedTaskIds).map((taskId) => deleteTodoTask(taskId)))
    setSelectedTaskIds(new Set())
    if (activeListId) {
      await refreshTasks(activeListId, activeProjectId)
    }
  }

  async function handleDuplicateTask(task: TodoTask) {
    if (!activeListId) return
    const newTask = await createTodoTask(activeListId, `${task.title} (copy)`, task.projectId ?? undefined)
    await updateTodoTask(newTask.id, {
      description: task.description,
      priority: task.priority,
      status: 'to_do',
      completed: false,
      dueDate: task.dueDate,
      assigneeId: task.assigneeId,
      tags: task.tags,
    } as any)
    await refreshTasks(activeListId, activeProjectId)
  }

  async function handleArchiveTask(taskId: string) {
    await updateTodoTask(taskId, { status: 'done', completed: true } as any)
    if (activeListId) {
      await refreshTasks(activeListId, activeProjectId)
    }
  }

  async function handleDeleteList() {
    if (!activeList || !userId) return
    const canDelete = activeList.createdBy === userId || userRole === 'owner'
    if (!canDelete) return
    await deleteTodoList(activeList.id)
    await refreshLists()
    setActiveListId(null)
    setActiveTaskId(null)
    setShowSettingsDialog(false)
  }

  if (!hasAccess && !permissionsLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <p>You don’t have access to To-Do Lists.</p>
            <p>Ask your organization owner to enable this feature for your account.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activeListId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">To-Do Lists</h1>
            <p className="text-sm text-muted-foreground">Organized, list-first task management.</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create list
          </Button>
        </div>

        {loadingLists ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading lists...
            </CardContent>
          </Card>
        ) : isFirstTime ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <h2 className="text-xl font-semibold">Welcome to To-Do Lists</h2>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Create a list for your team or join an existing list with an invitation code.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => setShowCreateDialog(true)}>
                  Create new list
                </Button>
                <div className="flex gap-2">
                  <Input
                    placeholder="Invitation code"
                    value={inviteCodeInput}
                    onChange={(event) => setInviteCodeInput(event.target.value)}
                    className="w-48"
                  />
                  <Button variant="outline" onClick={handleJoinList}>
                    Join
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Lists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleLists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: list.color }}
                    />
                    <div>
                      <p className="font-medium">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(list.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {list.members.length} members
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => setActiveListId(list.id)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <CreateListDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreate={handleCreateList}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-52 shrink-0 space-y-2 lg:border-r lg:pr-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks</p>
        <Button
          variant={activeProjectId === null ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start"
          onClick={() => setActiveProjectId(null)}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          All tasks
        </Button>
        {projects.map((project) => (
          <Button
            key={project.id}
            variant={activeProjectId === project.id ? 'secondary' : 'ghost'}
            size="sm"
            className="w-full justify-start truncate"
            onClick={() => setActiveProjectId(project.id)}
          >
            <FolderOpen className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">{project.name}</span>
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => setShowCreateProjectDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create project
        </Button>
      </div>
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex flex-col gap-3">
          <Button variant="outline" size="sm" onClick={() => setActiveListId(null)}>
            Back to lists
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: activeList?.color }} />
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold truncate">{activeList?.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {activeList?.members.length} members • Created {activeList ? new Date(activeList.createdAt).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowSettingsDialog(true)} className="shrink-0">
              <Settings className="h-4 w-4 mr-2" />
              List settings
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-[140px]">
            <option value="all">All status</option>
            <option value="to_do">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </Select>
          <Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="min-w-[140px]">
            <option value="all">All priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
          <Select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="min-w-[140px]">
            <option value="all">All assignees</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </Select>
          <Select value={dueFilter} onChange={(event) => setDueFilter(event.target.value)} className="min-w-[140px]">
            <option value="all">All due dates</option>
            <option value="overdue">Overdue</option>
            <option value="next_7_days">Next 7 days</option>
          </Select>
          <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="min-w-[160px]">
            <option value="due_date">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="updated">Sort: Last updated</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Enter a task name and press enter"
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddTask()
              }
            }}
          />
          <Button onClick={handleAddTask} disabled={addingTask}>
            <Plus className="h-4 w-4 mr-2" />
            {addingTask ? 'Adding…' : 'Add'}
          </Button>
        </div>

        {selectedTaskIds.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border px-4 py-2 bg-muted/40">
            <span className="text-sm">{selectedTaskIds.size} selected</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedTaskIds(new Set())}>
                Clear
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {loadingTasks ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Loading tasks...
              </CardContent>
            </Card>
          ) : filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No tasks match your filters.
              </CardContent>
            </Card>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`border rounded-lg px-3 py-2 flex items-center gap-3 ${
                  activeTaskId === task.id ? 'border-primary/50 bg-muted/30' : 'hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTaskIds.has(task.id)}
                  onChange={() => {
                    setSelectedTaskIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(task.id)) {
                        next.delete(task.id)
                      } else {
                        next.add(task.id)
                      }
                      return next
                    })
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleUpdateTask(task.id, { completed: !task.completed })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  {editingTaskId === task.id ? (
                    <Input
                      value={task.title}
                      onChange={(event) => handleUpdateTask(task.id, { title: event.target.value })}
                      onBlur={() => setEditingTaskId(null)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          setEditingTaskId(null)
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button className="text-left w-full" onClick={() => setActiveTaskId(task.id)}>
                      <p className={`font-medium truncate ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </p>
                    </button>
                  )}
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="secondary">{PRIORITY_LABELS[task.priority]}</Badge>
                    <span>{STATUS_LABELS[task.status]}</span>
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? 'text-red-500' : ''}`}>
                        <Calendar className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <Badge variant="outline">
                  {task.assigneeId
                    ? task.assigneeId === userId
                      ? 'ME'
                      : 'Member'
                    : 'Unassigned'}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditingTaskId(task.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDuplicateTask(task)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleArchiveTask(task.id)}>
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="lg:w-[360px] w-full">
        {activeTask ? (
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={activeTask.title}
                  onChange={(event) => handleUpdateTask(activeTask.id, { title: event.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={activeTask.description}
                  onChange={(event) => handleUpdateTask(activeTask.id, { description: event.target.value })}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={activeTask.status}
                    onChange={(event) => handleUpdateTask(activeTask.id, { status: event.target.value as TaskStatus })}
                  >
                    <option value="to_do">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={activeTask.priority}
                    onChange={(event) => handleUpdateTask(activeTask.id, { priority: event.target.value as TaskPriority })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Assignee</label>
                <Select
                  value={activeTask.assigneeId || ''}
                  onChange={(event) =>
                    handleUpdateTask(activeTask.id, { assigneeId: event.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {userId && <option value={userId}>Me</option>}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Project</label>
                <Select
                  value={activeTask.projectId || ''}
                  onChange={(event) =>
                    handleUpdateTask(activeTask.id, { projectId: event.target.value || null })
                  }
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Due date</label>
                <Input
                  type="date"
                  value={activeTask.dueDate || ''}
                  onChange={(event) =>
                    handleUpdateTask(activeTask.id, { dueDate: event.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tags</label>
                <Input
                  placeholder="Comma-separated tags"
                  value={activeTask.tags.join(', ')}
                  onChange={(event) =>
                    handleUpdateTask(
                      activeTask.id,
                      { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) }
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time tracking
                </label>
                <p className="text-xs text-muted-foreground">Total: {timeTotalMinutes} min</p>
                <div className="flex flex-wrap items-center gap-2">
                  {runningTimer ? (
                    runningTimer.task_id === activeTask.id ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={timerLoading}
                        onClick={async () => {
                          setTimerLoading(true)
                          try {
                            await stopTimer(activeTask.id)
                            const [entries, total, running] = await Promise.all([
                              getTimeEntries(activeTask.id),
                              getTotalMinutes(activeTask.id),
                              getRunningTimer(activeTask.listId),
                            ])
                            setTimeEntries(entries)
                            setTimeTotalMinutes(total)
                            setRunningTimer(running && running.is_running ? { id: running.id, task_id: running.task_id, started_at: running.started_at } : null)
                          } finally {
                            setTimerLoading(false)
                          }
                        }}
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Stop timer
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Timer running on another task. Stop it there first.</span>
                    )
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={timerLoading}
                      onClick={async () => {
                        setTimerLoading(true)
                        try {
                          await startTimer(activeTask.id)
                          const running = await getRunningTimer(activeTask.listId)
                          setRunningTimer(running && running.is_running ? { id: running.id, task_id: running.task_id, started_at: running.started_at } : null)
                        } finally {
                          setTimerLoading(false)
                        }
                      }}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Start timer
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Min"
                    value={manualTimeMinutes}
                    onChange={(e) => setManualTimeMinutes(e.target.value)}
                    className="w-20"
                  />
                  <Input
                    placeholder="Note (optional)"
                    value={manualTimeNote}
                    onChange={(e) => setManualTimeNote(e.target.value)}
                    className="flex-1 min-w-0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const min = parseInt(manualTimeMinutes, 10)
                      if (!min || min < 1) return
                      await addManualTimeEntry(activeTask.id, min, { note: manualTimeNote.trim() || undefined })
                      setManualTimeMinutes('')
                      setManualTimeNote('')
                      const [entries, total] = await Promise.all([getTimeEntries(activeTask.id), getTotalMinutes(activeTask.id)])
                      setTimeEntries(entries)
                      setTimeTotalMinutes(total)
                    }}
                  >
                    Add time
                  </Button>
                </div>
                {timeEntries.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <p className="text-xs font-medium text-muted-foreground">Entries</p>
                    {timeEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm">
                        <span className="capitalize">{entry.entry_type}</span>
                        <span>{entry.duration_minutes} min</span>
                        {entry.note && <span className="truncate text-muted-foreground">{entry.note}</span>}
                        {entry.entry_type !== 'correction' && (
                          correctingEntryId === entry.id ? (
                            <div className="flex gap-1 items-center">
                              <Input
                                type="number"
                                min={0}
                                value={correctDuration}
                                onChange={(e) => setCorrectDuration(e.target.value)}
                                className="w-16 h-8 text-xs"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={async () => {
                                  const min = parseInt(correctDuration, 10)
                                  if (min < 0) return
                                  await correctTimeEntry(entry.id, min)
                                  setCorrectingEntryId(null)
                                  setCorrectDuration('')
                                  const [entries, total] = await Promise.all([getTimeEntries(activeTask.id), getTotalMinutes(activeTask.id)])
                                  setTimeEntries(entries)
                                  setTimeTotalMinutes(total)
                                }}
                              >
                                Save
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8" onClick={() => { setCorrectingEntryId(null); setCorrectDuration('') }}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCorrectingEntryId(entry.id); setCorrectDuration(String(entry.duration_minutes)) }}>
                              Correct
                            </Button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subtasks</label>
                {(activeTask.subtasks || []).map((subtask) => (
                  <SubtaskRow
                    key={subtask.id}
                    subtask={subtask}
                    onToggle={async (done) => {
                      await toggleTodoSubtask(subtask.id, done)
                      await refreshTasks(activeTask.listId, activeProjectId)
                    }}
                    onRename={async (title) => {
                      await updateTodoSubtask(subtask.id, { title })
                      await refreshTasks(activeTask.listId, activeProjectId)
                    }}
                    onDueDateChange={async (dueDate) => {
                      await updateTodoSubtask(subtask.id, { due_date: dueDate || null })
                      await refreshTasks(activeTask.listId, activeProjectId)
                    }}
                    onDelete={async () => {
                      await deleteTodoSubtask(subtask.id)
                      await refreshTasks(activeTask.listId, activeProjectId)
                    }}
                  />
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add subtask"
                    value={newSubtaskTitle}
                    onChange={(event) => setNewSubtaskTitle(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!newSubtaskTitle.trim()) return
                      await createTodoSubtask(activeTask.id, newSubtaskTitle.trim())
                      setNewSubtaskTitle('')
                      await refreshTasks(activeTask.listId, activeProjectId)
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Comments</label>
                {(activeTask.comments || []).map((comment) => (
                  <div key={comment.id} className="text-sm text-muted-foreground border rounded-md p-2">
                    {comment.text}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Write a comment"
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!newComment.trim()) return
                      await createTodoComment(activeTask.id, newComment.trim())
                      setNewComment('')
                      await refreshTasks(activeTask.listId, activeProjectId)
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Attachments</label>
                {(activeTask.attachments || []).map((attachment) => (
                  <div key={attachment.id} className="text-sm text-muted-foreground">
                    {attachment.name}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste attachment URL"
                    value={newAttachmentUrl}
                    onChange={(event) => setNewAttachmentUrl(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!newAttachmentUrl.trim()) return
                      const value = newAttachmentUrl.trim()
                      await createTodoAttachment(activeTask.id, value, value)
                      setNewAttachmentUrl('')
                      await refreshTasks(activeTask.listId, activeProjectId)
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Activity history</p>
                <p>Last updated: {new Date(activeTask.updatedAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="sticky top-6">
            <CardContent className="py-10 text-center text-muted-foreground">
              Select a task to see details.
            </CardContent>
          </Card>
        )}
      </div>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={handleCreateList}
      />
      <CreateProjectDialog
        open={showCreateProjectDialog}
        onOpenChange={setShowCreateProjectDialog}
        onCreate={handleCreateProject}
      />
      <ListSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        list={activeList}
        userId={userId}
        userRole={userRole}
        onSave={async (updates) => {
          if (!activeList) return
          await updateTodoList(activeList.id, updates)
          await refreshLists()
        }}
        onDelete={handleDeleteList}
      />
    </div>
  )
}

function SubtaskRow({
  subtask,
  onToggle,
  onRename,
  onDueDateChange,
  onDelete,
}: {
  subtask: { id: string; title: string; done: boolean; dueDate: string | null }
  onToggle: (done: boolean) => Promise<void>
  onRename: (title: string) => Promise<void>
  onDueDateChange: (dueDate: string | null) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(subtask.title)

  useEffect(() => {
    setEditTitle(subtask.title)
  }, [subtask.title])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-transparent hover:border-border px-2 py-1.5 group">
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={() => onToggle(!subtask.done)}
        className="h-4 w-4 rounded border-gray-300 shrink-0"
      />
      {editing ? (
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={() => {
            const t = editTitle.trim()
            if (t && t !== subtask.title) onRename(t)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const t = editTitle.trim()
              if (t && t !== subtask.title) onRename(t)
              setEditing(false)
            }
          }}
          className="h-8 flex-1 min-w-0 text-sm"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`text-sm text-left flex-1 min-w-0 truncate ${subtask.done ? 'line-through text-muted-foreground' : ''}`}
        >
          {subtask.title || 'Untitled'}
        </button>
      )}
      <Input
        type="date"
        value={subtask.dueDate || ''}
        onChange={(e) => onDueDateChange(e.target.value || null)}
        className="h-8 w-[130px] text-xs shrink-0"
      />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-70 hover:opacity-100" onClick={onDelete} aria-label="Delete subtask">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )
}

function CreateListDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: { name: string; color: string }) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])

  useEffect(() => {
    if (!open) {
      setName('')
      setColor(COLORS[0])
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create To-Do List</DialogTitle>
          <DialogDescription>Give your list a clear name and a color.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">List name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Accent color</label>
            <div className="flex gap-2 mt-2">
              {COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`h-8 w-8 rounded-full border ${color === option ? 'border-primary' : 'border-transparent'}`}
                  style={{ backgroundColor: option }}
                  onClick={() => setColor(option)}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!name.trim()) return
                onCreate({ name: name.trim(), color })
              }}
            >
              Create list
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) setName('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>Add a project to group tasks in this list.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Project name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sprint 1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!name.trim()) return
                onCreate(name.trim())
                onOpenChange(false)
              }}
            >
              Create project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ListSettingsDialog({
  open,
  onOpenChange,
  list,
  userId,
  userRole,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  list: TodoList | null
  userId: string | null
  userRole: UserRole
  onSave: (updates: Partial<TodoList>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!list) return
    setName(list.name)
    setColor(list.color)
  }, [list])

  if (!list) return null

  const canDelete = userId === list.createdBy || userRole === 'owner'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>List Settings</DialogTitle>
          <DialogDescription>Manage list details and sharing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2 mt-2">
              {COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`h-8 w-8 rounded-full border ${color === option ? 'border-primary' : 'border-transparent'}`}
                  style={{ backgroundColor: option }}
                  onClick={() => setColor(option)}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Invitation code</p>
              <p className="text-xs text-muted-foreground">{list.invitationCode}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(list.invitationCode)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Members</p>
            </div>
            <div className="text-xs text-muted-foreground">
              {list.members.length} members
            </div>
          </div>
          <div className="rounded-lg border p-3 text-xs text-muted-foreground">
            <p>Created by: {list.createdBy}</p>
            <p>Created on: {new Date(list.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex justify-between gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                onSave({ name: name.trim() || list.name, color })
                onOpenChange(false)
              }}
            >
              Save changes
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={!canDelete}>
              Delete list
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
