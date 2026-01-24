'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOrganization } from '@/lib/organization-context'
import { useFeaturePermissions } from '@/lib/hooks/use-feature-permissions'
import { getUserRole } from '@/app/actions/organizations'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Archive, Calendar, Check, Copy, Pencil, Plus, Search, Settings, Trash2, Users } from 'lucide-react'

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

type TodoTask = {
  id: string
  listId: string
  title: string
  description: string
  completed: boolean
  priority: TaskPriority
  dueDate: string | null
  status: TaskStatus
  assigneeId: string | null
  tags: string[]
  subtasks: { id: string; title: string; done: boolean }[]
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

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function TodoPage() {
  const { currentOrganization } = useOrganization()
  const { permissions, loading: permissionsLoading } = useFeaturePermissions()
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('viewer')
  const [lists, setLists] = useState<TodoList[]>([])
  const [tasks, setTasks] = useState<TodoTask[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
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

  const storageKey = currentOrganization?.id ? `todo_lists_${currentOrganization.id}` : null
  const taskStorageKey = currentOrganization?.id ? `todo_tasks_${currentOrganization.id}` : null

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
    if (!storageKey || !taskStorageKey) return
    const storedLists = localStorage.getItem(storageKey)
    const storedTasks = localStorage.getItem(taskStorageKey)
    setLists(storedLists ? JSON.parse(storedLists) : [])
    setTasks(storedTasks ? JSON.parse(storedTasks) : [])
  }, [storageKey, taskStorageKey])

  useEffect(() => {
    if (!storageKey || !taskStorageKey) return
    localStorage.setItem(storageKey, JSON.stringify(lists))
    localStorage.setItem(taskStorageKey, JSON.stringify(tasks))
  }, [lists, tasks, storageKey, taskStorageKey])

  const visibleLists = useMemo(() => {
    if (!userId) return []
    if (userRole === 'owner' || userRole === 'admin') {
      return lists
    }
    return lists.filter((list) => list.members.some((member) => member.userId === userId))
  }, [lists, userId, userRole])

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
  }, [listTasks, searchQuery, statusFilter, priorityFilter, sortBy])

  const selectedTasks = filteredTasks.filter((task) => selectedTaskIds.has(task.id))
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null

  const isFirstTime = visibleLists.length === 0
  const hasAccess = permissions.todo

  useEffect(() => {
    setNewSubtaskTitle('')
    setNewComment('')
    setNewAttachmentUrl('')
  }, [activeTaskId])

  function handleCreateList(data: { name: string; color: string }) {
    if (!userId) return
    const newList: TodoList = {
      id: generateId('list'),
      name: data.name,
      color: data.color,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      members: [{ userId, role: 'owner' }],
      invitationCode: generateInviteCode(),
    }
    setLists((prev) => [newList, ...prev])
    setActiveListId(newList.id)
    setShowCreateDialog(false)
  }

  function handleJoinList() {
    if (!userId || !inviteCodeInput.trim()) return
    const list = lists.find((item) => item.invitationCode === inviteCodeInput.trim().toUpperCase())
    if (!list) {
      return
    }
    if (!list.members.some((member) => member.userId === userId)) {
      const updated = lists.map((item) =>
        item.id === list.id
          ? { ...item, members: [...item.members, { userId, role: 'member' }] }
          : item
      )
      setLists(updated)
    }
    setActiveListId(list.id)
    setInviteCodeInput('')
  }

  function handleAddTask() {
    if (!newTaskTitle.trim() || !activeListId) return
    const task: TodoTask = {
      id: generateId('task'),
      listId: activeListId,
      title: newTaskTitle.trim(),
      description: '',
      completed: false,
      priority: 'medium',
      dueDate: null,
      status: 'to_do',
      assigneeId: null,
      tags: [],
      subtasks: [],
      comments: [],
      attachments: [],
      updatedAt: new Date().toISOString(),
    }
    setTasks((prev) => [task, ...prev])
    setNewTaskTitle('')
  }

  function handleUpdateTask(taskId: string, updates: Partial<TodoTask>) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
      )
    )
  }

  function handleDeleteTask(taskId: string) {
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }

  function handleBulkDelete() {
    setTasks((prev) => prev.filter((task) => !selectedTaskIds.has(task.id)))
    setSelectedTaskIds(new Set())
  }

  function handleDuplicateTask(task: TodoTask) {
    const duplicated: TodoTask = {
      ...task,
      id: generateId('task'),
      title: `${task.title} (copy)`,
      completed: false,
      status: 'to_do',
      updatedAt: new Date().toISOString(),
    }
    setTasks((prev) => [duplicated, ...prev])
  }

  function handleArchiveTask(taskId: string) {
    handleUpdateTask(taskId, { status: 'done', completed: true })
  }

  function handleDeleteList() {
    if (!activeList || !userId) return
    const canDelete = activeList.createdBy === userId || userRole === 'owner'
    if (!canDelete) return
    setLists((prev) => prev.filter((list) => list.id !== activeList.id))
    setTasks((prev) => prev.filter((task) => task.listId !== activeList.id))
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

        {isFirstTime ? (
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
      <div className="flex-1 space-y-4">
        <div className="flex flex-col gap-3">
          <Button variant="outline" size="sm" onClick={() => setActiveListId(null)}>
            Back to lists
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activeList?.color }} />
              <div>
                <h1 className="text-2xl font-semibold">{activeList?.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {activeList?.members.length} members • Created {activeList ? new Date(activeList.createdAt).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
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
            placeholder="Add a task and press Enter"
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddTask()
              }
            }}
          />
          <Button onClick={handleAddTask}>
            <Plus className="h-4 w-4 mr-2" />
            Add
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
          {filteredTasks.length === 0 ? (
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
                <label className="text-sm font-medium">Subtasks</label>
                {(activeTask.subtasks || []).map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      onChange={() => {
                        const next = (activeTask.subtasks || []).map((item) =>
                          item.id === subtask.id ? { ...item, done: !item.done } : item
                        )
                        handleUpdateTask(activeTask.id, { subtasks: next })
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className={`text-sm ${subtask.done ? 'line-through text-muted-foreground' : ''}`}>
                      {subtask.title}
                    </span>
                  </div>
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
                    onClick={() => {
                      if (!newSubtaskTitle.trim()) return
                      const next = [
                        ...(activeTask.subtasks || []),
                        { id: generateId('subtask'), title: newSubtaskTitle.trim(), done: false },
                      ]
                      handleUpdateTask(activeTask.id, { subtasks: next })
                      setNewSubtaskTitle('')
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
                    onClick={() => {
                      if (!newComment.trim()) return
                      const next = [
                        ...(activeTask.comments || []),
                        { id: generateId('comment'), text: newComment.trim(), createdAt: new Date().toISOString() },
                      ]
                      handleUpdateTask(activeTask.id, { comments: next })
                      setNewComment('')
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
                    onClick={() => {
                      if (!newAttachmentUrl.trim()) return
                      const next = [
                        ...(activeTask.attachments || []),
                        {
                          id: generateId('attach'),
                          name: newAttachmentUrl.trim(),
                          url: newAttachmentUrl.trim(),
                        },
                      ]
                      handleUpdateTask(activeTask.id, { attachments: next })
                      setNewAttachmentUrl('')
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
      <ListSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        list={activeList}
        userId={userId}
        userRole={userRole}
        onSave={(updates) => {
          if (!activeList) return
          setLists((prev) =>
            prev.map((list) =>
              list.id === activeList.id ? { ...list, ...updates } : list
            )
          )
        }}
        onDelete={handleDeleteList}
      />
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
