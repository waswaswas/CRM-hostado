'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId, getCurrentUserOrgRole } from './organizations'

export type TodoList = {
  id: string
  organization_id: string
  created_by: string
  name: string
  color: string
  invitation_code: string
  created_at: string
  updated_at: string
  todo_list_members?: { user_id: string; role: 'owner' | 'member' }[]
}

export type TodoProject = {
  id: string
  list_id: string
  created_by: string
  name: string
  description: string | null
  sort_order: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type TodoTask = {
  id: string
  list_id: string
  project_id: string | null
  created_by: string
  title: string
  description: string | null
  status: 'to_do' | 'in_progress' | 'blocked' | 'done' | 'info_needed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  due_date: string | null
  assignee_id: string | null
  tags: string[]
  completed: boolean
  created_at: string
  updated_at: string
  subtasks?: { id: string; title: string; done: boolean; due_date: string | null }[]
  comments?: { id: string; content: string; created_at: string }[]
  attachments?: { id: string; file_name: string; file_url: string }[]
}

/** Updates for a task; allows camelCase aliases (dueDate, assigneeId, projectId) from the UI */
export type TodoTaskUpdate = Partial<TodoTask> & {
  dueDate?: string | null
  assigneeId?: string | null
  projectId?: string | null
}

function generateInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

type TodoListRow = TodoList & {
  todo_list_members?: { user_id: string; role: 'owner' | 'member' }[] | null
}

export async function getTodoLists(): Promise<TodoList[]> {
  const supabase = await createClient()
  const [
    { data: { user } },
    organizationId,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentOrganizationId(),
  ])

  if (!user) {
    throw new Error('Unauthorized')
  }
  if (!organizationId) return []

  // Single role lookup (avoid getCurrentUserOrgRole which repeats getUser + getCurrentOrganizationId)
  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const role = (member?.role as 'owner' | 'admin' | 'moderator' | 'viewer') ?? null
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  // Single query with embedded members to avoid a second round-trip
  const selectWithMembers = '*, todo_list_members(user_id, role)'

  if (isOwnerOrAdmin) {
    const { data, error } = await supabase
      .from('todo_lists')
      .select(selectWithMembers)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }
    return (data || []).map((row: TodoListRow) => ({
      ...row,
      todo_list_members: row.todo_list_members ?? [],
    })) as TodoList[]
  }

  const { data: memberListIds } = await supabase
    .from('todo_list_members')
    .select('list_id')
    .eq('user_id', user.id)

  const listIds = (memberListIds || []).map((r: { list_id: string }) => r.list_id)
  if (listIds.length === 0) return []

  const { data, error } = await supabase
    .from('todo_lists')
    .select(selectWithMembers)
    .in('id', listIds)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((row: TodoListRow) => ({
    ...row,
    todo_list_members: row.todo_list_members ?? [],
  })) as TodoList[]
}

export async function getTodoProjects(listId: string): Promise<TodoProject[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('todo_projects')
    .select('*')
    .eq('list_id', listId)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return (data || []) as TodoProject[]
}

export async function createTodoProject(listId: string, input: { name: string; description?: string }): Promise<TodoProject> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: existing } = await supabase
    .from('todo_projects')
    .select('sort_order')
    .eq('list_id', listId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = existing?.sort_order != null ? existing.sort_order + 1 : 0

  const { data: project, error } = await supabase
    .from('todo_projects')
    .insert({
      list_id: listId,
      created_by: user.id,
      name: input.name,
      description: input.description ?? null,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error || !project) {
    throw new Error(error?.message || 'Failed to create project')
  }
  revalidatePath('/todo')
  return project as TodoProject
}

export async function updateTodoProject(
  projectId: string,
  updates: { name?: string; description?: string; is_archived?: boolean; sort_order?: number }
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.is_archived !== undefined) payload.is_archived = updates.is_archived
  if (updates.sort_order !== undefined) payload.sort_order = updates.sort_order

  const { error } = await supabase
    .from('todo_projects')
    .update(payload)
    .eq('id', projectId)

  if (error) {
    throw new Error(error.message)
  }
  revalidatePath('/todo')
}

export async function deleteTodoProject(projectId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('todo_projects')
    .delete()
    .eq('id', projectId)

  if (error) {
    throw new Error(error.message)
  }
  revalidatePath('/todo')
}

export async function getTodoTasks(listId: string, projectId?: string | null): Promise<TodoTask[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  let query = supabase
    .from('todo_tasks')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false })

  if (projectId != null && projectId !== '') {
    query = query.eq('project_id', projectId)
  }

  const { data: tasks, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const taskIds = (tasks || []).map((task: { id: string }) => task.id)

  const [subtasksResult, commentsResult, attachmentsResult] = await Promise.all([
    taskIds.length
      ? supabase
          .from('todo_task_subtasks')
          .select('id, task_id, title, done, due_date')
          .in('task_id', taskIds)
      : Promise.resolve({ data: [] as any[] }),
    taskIds.length
      ? supabase
          .from('todo_task_comments')
          .select('id, task_id, content, created_at')
          .in('task_id', taskIds)
      : Promise.resolve({ data: [] as any[] }),
    taskIds.length
      ? supabase
          .from('todo_task_attachments')
          .select('id, task_id, file_name, file_url')
          .in('task_id', taskIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const subtasksByTask = new Map<string, { id: string; title: string; done: boolean; due_date: string | null }[]>()
  const commentsByTask = new Map<string, { id: string; content: string; created_at: string }[]>()
  const attachmentsByTask = new Map<string, { id: string; file_name: string; file_url: string }[]>()

  ;(subtasksResult.data || []).forEach((row: any) => {
    const list = subtasksByTask.get(row.task_id) || []
    list.push({ id: row.id, title: row.title, done: row.done, due_date: row.due_date ?? null })
    subtasksByTask.set(row.task_id, list)
  })

  ;(commentsResult.data || []).forEach((row: any) => {
    const list = commentsByTask.get(row.task_id) || []
    list.push({ id: row.id, content: row.content, created_at: row.created_at })
    commentsByTask.set(row.task_id, list)
  })

  ;(attachmentsResult.data || []).forEach((row: any) => {
    const list = attachmentsByTask.get(row.task_id) || []
    list.push({ id: row.id, file_name: row.file_name, file_url: row.file_url })
    attachmentsByTask.set(row.task_id, list)
  })

  return (tasks || []).map((task: any) => ({
    ...task,
    tags: task.tags || [],
    subtasks: subtasksByTask.get(task.id) || [],
    comments: commentsByTask.get(task.id) || [],
    attachments: attachmentsByTask.get(task.id) || [],
  })) as TodoTask[]
}

/** Last 4 modified tasks across all lists the user has access to. */
export async function getRecentTodoTasks(): Promise<TodoTask[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data: tasks, error } = await supabase
    .from('todo_tasks')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(4)

  if (error) {
    return []
  }

  const taskIds = (tasks || []).map((task: { id: string }) => task.id)
  const [subtasksResult, commentsResult, attachmentsResult] = await Promise.all([
    taskIds.length
      ? supabase
          .from('todo_task_subtasks')
          .select('id, task_id, title, done, due_date')
          .in('task_id', taskIds)
      : Promise.resolve({ data: [] as any[] }),
    taskIds.length
      ? supabase
          .from('todo_task_comments')
          .select('id, task_id, content, created_at')
          .in('task_id', taskIds)
      : Promise.resolve({ data: [] as any[] }),
    taskIds.length
      ? supabase
          .from('todo_task_attachments')
          .select('id, task_id, file_name, file_url')
          .in('task_id', taskIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const subtasksByTask = new Map<string, { id: string; title: string; done: boolean; due_date: string | null }[]>()
  const commentsByTask = new Map<string, { id: string; content: string; created_at: string }[]>()
  const attachmentsByTask = new Map<string, { id: string; file_name: string; file_url: string }[]>()

  ;(subtasksResult.data || []).forEach((row: any) => {
    const list = subtasksByTask.get(row.task_id) || []
    list.push({ id: row.id, title: row.title, done: row.done, due_date: row.due_date ?? null })
    subtasksByTask.set(row.task_id, list)
  })
  ;(commentsResult.data || []).forEach((row: any) => {
    const list = commentsByTask.get(row.task_id) || []
    list.push({ id: row.id, content: row.content, created_at: row.created_at })
    commentsByTask.set(row.task_id, list)
  })
  ;(attachmentsResult.data || []).forEach((row: any) => {
    const list = attachmentsByTask.get(row.task_id) || []
    list.push({ id: row.id, file_name: row.file_name, file_url: row.file_url })
    attachmentsByTask.set(row.task_id, list)
  })

  return (tasks || []).map((task: any) => ({
    ...task,
    tags: task.tags || [],
    subtasks: subtasksByTask.get(task.id) || [],
    comments: commentsByTask.get(task.id) || [],
    attachments: attachmentsByTask.get(task.id) || [],
  })) as TodoTask[]
}

export async function createTodoList(input: { name: string; color?: string }): Promise<TodoList> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  let invitationCode = generateInviteCode()
  for (let i = 0; i < 3; i += 1) {
    const { data: existing } = await supabase
      .from('todo_lists')
      .select('id')
      .eq('invitation_code', invitationCode)
      .maybeSingle()
    if (!existing) break
    invitationCode = generateInviteCode()
  }

  const { data: list, error } = await supabase
    .from('todo_lists')
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      name: input.name,
      color: input.color || '#2563eb',
      invitation_code: invitationCode,
    })
    .select()
    .single()

  if (error || !list) {
    throw new Error(error?.message || 'Failed to create list')
  }

  await supabase.from('todo_list_members').insert({
    list_id: list.id,
    user_id: user.id,
    role: 'owner',
  })

  revalidatePath('/todo')
  return list as TodoList
}

export async function joinTodoListByCode(code: string): Promise<TodoList> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase.rpc('join_todo_list_by_code', { code })
  if (error) {
    throw new Error(error.message)
  }

  const listId = data as string
  const { data: list, error: listError } = await supabase
    .from('todo_lists')
    .select('*, todo_list_members(user_id, role)')
    .eq('id', listId)
    .single()

  if (listError || !list) {
    throw new Error(listError?.message || 'List not found')
  }

  revalidatePath('/todo')
  return list as TodoList
}

const LIST_OWNER_ONLY_MESSAGE = 'No permission to rename the list. Contact the owner if needed.'

export async function updateTodoList(listId: string, updates: { name?: string; color?: string }): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: list } = await supabase
    .from('todo_lists')
    .select('created_by')
    .eq('id', listId)
    .single()

  if (!list) throw new Error('List not found')
  if (list.created_by !== user.id) throw new Error(LIST_OWNER_ONLY_MESSAGE)

  const { error } = await supabase
    .from('todo_lists')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', listId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function deleteTodoList(listId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: list } = await supabase
    .from('todo_lists')
    .select('created_by')
    .eq('id', listId)
    .single()

  if (!list) throw new Error('List not found')
  if (list.created_by !== user.id) throw new Error('No permission to delete the list. Contact the owner if needed.')

  const { error } = await supabase
    .from('todo_lists')
    .delete()
    .eq('id', listId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export type TodoListMemberDetail = {
  user_id: string
  role: 'owner' | 'member'
  email: string | null
}

export async function getTodoListMemberDetails(listId: string): Promise<TodoListMemberDetail[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: members, error } = await supabase
    .from('todo_list_members')
    .select('user_id, role')
    .eq('list_id', listId)

  if (error || !members?.length) return []

  const userIds = members.map((m: { user_id: string; role: string }) => m.user_id)
  const emailsMap = new Map<string, string>()
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, email')
    .in('id', userIds)
  profiles?.forEach((p: { id: string; email: string }) => emailsMap.set(p.id, p.email))

  return members.map((m: { user_id: string; role: string }) => ({
    user_id: m.user_id,
    role: m.role,
    email: emailsMap.get(m.user_id) ?? null,
  }))
}

export async function removeTodoListMember(listId: string, memberUserId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: list } = await supabase
    .from('todo_lists')
    .select('created_by')
    .eq('id', listId)
    .single()

  if (!list) throw new Error('List not found')
  if (list.created_by === memberUserId) throw new Error('Cannot remove the list owner')

  const role = await getCurrentUserOrgRole()
  const isOrgAdmin = role === 'owner' || role === 'admin'
  if (list.created_by !== user.id && !isOrgAdmin) {
    throw new Error('Only the list owner or an organization admin can remove members')
  }

  const { error } = await supabase
    .from('todo_list_members')
    .delete()
    .eq('list_id', listId)
    .eq('user_id', memberUserId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function createTodoTask(listId: string, title: string, projectId?: string | null): Promise<TodoTask> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const payload: { list_id: string; created_by: string; title: string; project_id?: string | null } = {
    list_id: listId,
    created_by: user.id,
    title,
  }
  if (projectId != null && projectId !== '') {
    payload.project_id = projectId
  }

  const { data: task, error } = await supabase
    .from('todo_tasks')
    .insert(payload)
    .select()
    .single()

  if (error || !task) {
    throw new Error(error?.message || 'Failed to create task')
  }
  revalidatePath('/todo')
  return task as TodoTask
}

export async function updateTodoTask(taskId: string, updates: TodoTaskUpdate): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const newAssigneeId = updates.assignee_id ?? updates.assigneeId
  if (newAssigneeId !== undefined) {
    const { data: current } = await supabase
      .from('todo_tasks')
      .select('assignee_id, list_id, title')
      .eq('id', taskId)
      .single()
    if (current && current.assignee_id !== newAssigneeId && newAssigneeId) {
      try {
        const { createNotification } = await import('./notifications')
        const { getCurrentOrganizationId } = await import('./organizations')
        const orgId = (await getCurrentOrganizationId()) || (await getOrganizationIdFromListId(current.list_id))
        await createNotification({
          type: 'task_assigned',
          title: 'Task assigned to you',
          message: `You were assigned to "${current.title || 'a task'}"`,
          related_id: taskId,
          related_type: 'todo_task',
          metadata: { list_id: current.list_id },
          owner_id: newAssigneeId,
          organization_id: orgId,
        })
      } catch {
        // Don't fail task update if notification fails (e.g. RLS)
      }
    }
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.title !== undefined) updatePayload.title = updates.title
  if (updates.description !== undefined) updatePayload.description = updates.description
  if (updates.status !== undefined) updatePayload.status = updates.status
  if (updates.priority !== undefined) updatePayload.priority = updates.priority
  if (updates.due_date !== undefined) updatePayload.due_date = updates.due_date
  if (updates.dueDate !== undefined) updatePayload.due_date = updates.dueDate
  if (updates.assignee_id !== undefined) updatePayload.assignee_id = updates.assignee_id
  if (updates.assigneeId !== undefined) updatePayload.assignee_id = updates.assigneeId
  if (updates.project_id !== undefined) updatePayload.project_id = updates.project_id
  if (updates.projectId !== undefined) updatePayload.project_id = updates.projectId
  if (updates.tags !== undefined) updatePayload.tags = updates.tags
  if (updates.completed !== undefined) updatePayload.completed = updates.completed

  const { error } = await supabase
    .from('todo_tasks')
    .update(updatePayload)
    .eq('id', taskId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function deleteTodoTask(taskId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('todo_tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function createTodoSubtask(taskId: string, title: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('todo_task_subtasks')
    .insert({ task_id: taskId, title })

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function updateTodoSubtask(
  subtaskId: string,
  updates: { title?: string; due_date?: string | null }
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const payload: Record<string, unknown> = {}
  if (updates.title !== undefined) payload.title = updates.title
  if (updates.due_date !== undefined) payload.due_date = updates.due_date || null
  if (Object.keys(payload).length === 0) return

  const { error } = await supabase
    .from('todo_task_subtasks')
    .update(payload)
    .eq('id', subtaskId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function deleteTodoSubtask(subtaskId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('todo_task_subtasks')
    .delete()
    .eq('id', subtaskId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function toggleTodoSubtask(subtaskId: string, done: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('todo_task_subtasks')
    .update({ done })
    .eq('id', subtaskId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function createTodoComment(taskId: string, content: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('todo_task_comments')
    .insert({ task_id: taskId, user_id: user.id, content })

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

export async function createTodoAttachment(taskId: string, fileName: string, fileUrl: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('todo_task_attachments')
    .insert({ task_id: taskId, file_name: fileName, file_url: fileUrl })

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}

// ---- Time tracking ----

export type TodoTimeEntry = {
  id: string
  task_id: string
  user_id: string
  entry_type: 'timer' | 'manual' | 'correction'
  start_time: string | null
  end_time: string | null
  duration_minutes: number
  duration_seconds: number | null
  note: string | null
  corrected_entry_id: string | null
  created_at: string
  user_email?: string
}

export type TodoTimerSession = {
  id: string
  task_id: string
  user_id: string
  started_at: string
  stopped_at: string | null
  is_running: boolean
  created_at: string
}

async function getTaskListId(supabase: Awaited<ReturnType<typeof createClient>>, taskId: string): Promise<string> {
  const { data, error } = await supabase
    .from('todo_tasks')
    .select('list_id')
    .eq('id', taskId)
    .single()
  if (error || !data) throw new Error('Task not found')
  return data.list_id
}

async function logTodoTaskActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  taskId: string,
  action: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await supabase.from('todo_task_activity').insert({
    task_id: taskId,
    user_id: userId,
    action,
    metadata,
  })
}

export async function getRunningTimer(listId: string): Promise<TodoTimerSession | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: taskIds } = await supabase
    .from('todo_tasks')
    .select('id')
    .eq('list_id', listId)
  const ids = (taskIds || []).map((t: { id: string }) => t.id)
  if (ids.length === 0) return null
  const { data: session } = await supabase
    .from('todo_task_timer_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_running', true)
    .in('task_id', ids)
    .limit(1)
    .maybeSingle()
  if (!session) return null
  return session as TodoTimerSession
}

export async function startTimer(taskId: string): Promise<TodoTimerSession> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const listId = await getTaskListId(supabase, taskId)

  const { data: existing } = await supabase
    .from('todo_task_timer_sessions')
    .select('id, task_id, started_at')
    .eq('user_id', user.id)
    .eq('is_running', true)

  const listTaskIds = existing
    ? (await Promise.all(
        (existing as { id: string; task_id: string }[]).map(async (row) => {
          const lid = await getTaskListId(supabase, row.task_id)
          return lid === listId ? row.id : null
        })
      )).filter(Boolean) as string[]
    : []

  for (const sessionId of listTaskIds) {
    await supabase
      .from('todo_task_timer_sessions')
      .update({ is_running: false, stopped_at: new Date().toISOString() })
      .eq('id', sessionId)
  }

  const { data: session, error } = await supabase
    .from('todo_task_timer_sessions')
    .insert({
      task_id: taskId,
      user_id: user.id,
      started_at: new Date().toISOString(),
      is_running: true,
    })
    .select()
    .single()

  if (error || !session) throw new Error(error?.message || 'Failed to start timer')
  await logTodoTaskActivity(supabase, user.id, taskId, 'timer_started', { session_id: session.id })
  revalidatePath('/todo')
  return session as TodoTimerSession
}

export async function stopTimer(taskId: string): Promise<TodoTimeEntry> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: session, error: sessionError } = await supabase
    .from('todo_task_timer_sessions')
    .select('*')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .eq('is_running', true)
    .maybeSingle()

  if (sessionError || !session) throw new Error('No running timer for this task')

  const stoppedAt = new Date()
  const startedAt = new Date(session.started_at)
  const durationSeconds = Math.max(0, Math.floor((stoppedAt.getTime() - startedAt.getTime()) / 1000))
  const durationMinutes = Math.floor(durationSeconds / 60)

  await supabase
    .from('todo_task_timer_sessions')
    .update({ is_running: false, stopped_at: stoppedAt.toISOString() })
    .eq('id', session.id)

  const { data: entry, error: entryError } = await supabase
    .from('todo_task_time_entries')
    .insert({
      task_id: taskId,
      user_id: user.id,
      entry_type: 'timer',
      start_time: session.started_at,
      end_time: stoppedAt.toISOString(),
      duration_minutes: durationMinutes,
      duration_seconds: durationSeconds,
      note: null,
    })
    .select()
    .single()

  if (entryError || !entry) throw new Error(entryError?.message || 'Failed to save time entry')
  await logTodoTaskActivity(supabase, user.id, taskId, 'timer_stopped', {
    duration_seconds: durationSeconds,
    entry_id: entry.id,
  })
  revalidatePath('/todo')
  return entry as TodoTimeEntry
}

export async function addManualTimeEntry(
  taskId: string,
  durationMinutes: number,
  options?: { note?: string; date?: string }
): Promise<TodoTimeEntry> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  if (durationMinutes <= 0) throw new Error('Duration must be positive')

  const { data: entry, error } = await supabase
    .from('todo_task_time_entries')
    .insert({
      task_id: taskId,
      user_id: user.id,
      entry_type: 'manual',
      duration_minutes: durationMinutes,
      duration_seconds: durationMinutes * 60,
      note: options?.note ?? null,
      start_time: options?.date ?? null,
      end_time: null,
    })
    .select()
    .single()

  if (error || !entry) throw new Error(error?.message || 'Failed to add time entry')
  await logTodoTaskActivity(supabase, user.id, taskId, 'manual_time_added', {
    entry_id: entry.id,
    duration_minutes: durationMinutes,
  })
  revalidatePath('/todo')
  return entry as TodoTimeEntry
}

export async function correctTimeEntry(
  entryId: string,
  newDurationMinutes: number,
  note?: string
): Promise<TodoTimeEntry> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  if (newDurationMinutes < 0) throw new Error('Duration cannot be negative')

  const { data: original, error: fetchError } = await supabase
    .from('todo_task_time_entries')
    .select('id, task_id, user_id')
    .eq('id', entryId)
    .single()

  if (fetchError || !original) throw new Error('Time entry not found')
  if (original.user_id !== user.id) throw new Error('You can only correct your own entries')

  const { data: correction, error } = await supabase
    .from('todo_task_time_entries')
    .insert({
      task_id: original.task_id,
      user_id: user.id,
      entry_type: 'correction',
      duration_minutes: newDurationMinutes,
      duration_seconds: newDurationMinutes * 60,
      note: note ?? null,
      corrected_entry_id: entryId,
    })
    .select()
    .single()

  if (error || !correction) throw new Error(error?.message || 'Failed to create correction')
  await logTodoTaskActivity(supabase, user.id, original.task_id, 'time_corrected', {
    original_entry_id: entryId,
    correction_entry_id: correction.id,
    new_duration_minutes: newDurationMinutes,
  })
  revalidatePath('/todo')
  return correction as TodoTimeEntry
}

export async function getTimeEntries(taskId: string): Promise<TodoTimeEntry[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('todo_task_time_entries')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (error) return []
  const entries = (data || []) as TodoTimeEntry[]
  const userIds = Array.from(new Set(entries.map((e) => e.user_id)))
  const userEmailsMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds)
    profiles?.forEach((p: { id: string; email: string }) => userEmailsMap.set(p.id, p.email))
  }
  return entries.map((e) => ({
    ...e,
    user_email: userEmailsMap.get(e.user_id),
  }))
}

/** Effective duration in seconds for one entry: use duration_seconds, else minutes, else compute from start/end when stored duration is 0. */
function effectiveEntrySeconds(e: TodoTimeEntry): number {
  if (e.duration_seconds != null && e.duration_seconds > 0) return e.duration_seconds
  if (e.duration_minutes > 0) return e.duration_minutes * 60
  if (e.start_time && e.end_time) {
    const ms = new Date(e.end_time).getTime() - new Date(e.start_time).getTime()
    return Math.max(0, Math.floor(ms / 1000))
  }
  return 0
}

/** Total seconds for task: for each entry use latest correction if any, else original. Use duration_seconds when present, with fallback from start/end for old 0-minute entries. */
export async function getTotalSeconds(taskId: string): Promise<number> {
  const entries = await getTimeEntries(taskId)
  const effectiveByOriginalId = new Map<string, number>()
  for (const e of entries) {
    if (e.entry_type === 'correction') {
      const origId = e.corrected_entry_id!
      effectiveByOriginalId.set(origId, effectiveEntrySeconds(e))
    }
  }
  let total = 0
  for (const e of entries) {
    if (e.entry_type === 'correction') continue
    total += effectiveByOriginalId.get(e.id) ?? effectiveEntrySeconds(e)
  }
  return total
}

export async function getOrganizationIdFromListId(listId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('todo_lists')
    .select('organization_id')
    .eq('id', listId)
    .single()
  return data?.organization_id ?? null
}

export async function notifyTaskMention(taskId: string, mentionedUserId: string, taskTitle: string, listId: string): Promise<void> {
  const { createNotification } = await import('./notifications')
  const { getCurrentOrganizationId } = await import('./organizations')
  const orgId = (await getCurrentOrganizationId()) || (await getOrganizationIdFromListId(listId))
  await createNotification({
    type: 'task_mention',
    title: 'You were mentioned in a task',
    message: `You were tagged in "${taskTitle || 'a task'}"`,
    related_id: taskId,
    related_type: 'todo_task',
    metadata: { list_id: listId },
    owner_id: mentionedUserId,
    organization_id: orgId,
  })
}

export async function deleteTimeEntry(entryId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: row, error: fetchError } = await supabase
    .from('todo_task_time_entries')
    .select('id, user_id')
    .eq('id', entryId)
    .single()

  if (fetchError || !row) throw new Error('Time entry not found')
  if (row.user_id !== user.id) throw new Error('You can only delete your own entries')

  const { error } = await supabase
    .from('todo_task_time_entries')
    .delete()
    .eq('id', entryId)

  if (error) throw new Error(error.message)
  revalidatePath('/todo')
}
