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
  status: 'to_do' | 'in_progress' | 'blocked' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  due_date: string | null
  assignee_id: string | null
  tags: string[]
  completed: boolean
  created_at: string
  updated_at: string
  subtasks?: { id: string; title: string; done: boolean }[]
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

export async function getTodoLists(): Promise<TodoList[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) return []

  const role = await getCurrentUserOrgRole()
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  async function attachMembers(lists: TodoList[]): Promise<TodoList[]> {
    if (lists.length === 0) return lists
    const listIds = lists.map((l) => l.id)
    const { data: members } = await supabase
      .from('todo_list_members')
      .select('list_id, user_id, role')
      .in('list_id', listIds)
    const byList = new Map<string, { user_id: string; role: 'owner' | 'member' }[]>()
    for (const m of members || []) {
      const arr = byList.get(m.list_id) || []
      arr.push({ user_id: m.user_id, role: m.role })
      byList.set(m.list_id, arr)
    }
    return lists.map((list) => ({
      ...list,
      todo_list_members: byList.get(list.id) || [],
    }))
  }

  if (isOwnerOrAdmin) {
    const { data, error } = await supabase
      .from('todo_lists')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }
    return attachMembers((data || []) as TodoList[])
  }

  const { data: memberListIds } = await supabase
    .from('todo_list_members')
    .select('list_id')
    .eq('user_id', user.id)

  const listIds = (memberListIds || []).map((r: { list_id: string }) => r.list_id)
  if (listIds.length === 0) return []

  const { data, error } = await supabase
    .from('todo_lists')
    .select('*')
    .in('id', listIds)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return attachMembers((data || []) as TodoList[])
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
          .select('id, task_id, title, done')
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

  const subtasksByTask = new Map<string, { id: string; title: string; done: boolean }[]>()
  const commentsByTask = new Map<string, { id: string; content: string; created_at: string }[]>()
  const attachmentsByTask = new Map<string, { id: string; file_name: string; file_url: string }[]>()

  ;(subtasksResult.data || []).forEach((row: any) => {
    const list = subtasksByTask.get(row.task_id) || []
    list.push({ id: row.id, title: row.title, done: row.done })
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

export async function updateTodoList(listId: string, updates: { name?: string; color?: string }): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

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

  const { error } = await supabase
    .from('todo_lists')
    .delete()
    .eq('id', listId)

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
