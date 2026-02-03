import { getTodoLists } from '@/app/actions/todo'
import { TodoPageClient } from './todo-page-client'

export default async function TodoPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; task?: string }>
}) {
  let initialLists: Awaited<ReturnType<typeof getTodoLists>> = []
  try {
    initialLists = await getTodoLists()
  } catch {
    initialLists = []
  }
  const params = await searchParams
  return (
    <TodoPageClient
      initialLists={initialLists}
      initialListId={params.list ?? null}
      initialTaskId={params.task ?? null}
    />
  )
}
