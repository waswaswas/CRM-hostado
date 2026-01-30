import { getTodoLists } from '@/app/actions/todo'
import { TodoPageClient } from './todo-page-client'

export default async function TodoPage() {
  let initialLists: Awaited<ReturnType<typeof getTodoLists>> = []
  try {
    initialLists = await getTodoLists()
  } catch {
    initialLists = []
  }
  return <TodoPageClient initialLists={initialLists} />
}
