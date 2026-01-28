'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId } from './organizations'

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

export type TodoTask = {
  id: string
  list_id: string
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

/** Updates for a task; allows camelCase aliases (dueDate, assigneeId) from the UI */
export type TodoTaskUpdate = Partial<TodoTask> & {
  dueDate?: string | null
  assigneeId?: string | null
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

  const { data, error } = await supabase
    .from('todo_lists')
    .select('*, todo_list_members(user_id, role)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data as TodoList[]
}

export async function getTodoTasks(listId: string): Promise<TodoTask[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: tasks, error } = await supabase
    .from('todo_tasks')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false })

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

export async function createTodoTask(listId: string, title: string): Promise<TodoTask> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: task, error } = await supabase
    .from('todo_tasks')
    .insert({
      list_id: listId,
      created_by: user.id,
      title,
    })
    .select()
    .single()

  if (error || !task) throw new Error(error?.message || 'Failed to create task')
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
