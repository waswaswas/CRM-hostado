'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type MentionOption = { user_id: string; email: string | null }

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  onMention?: (userId: string) => void
  options: MentionOption[]
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
}

export function MentionTextarea({
  value,
  onChange,
  onMention,
  options,
  placeholder,
  rows = 4,
  className,
  disabled,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState('')
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)

  const filteredOptions = options.filter((o) =>
    (o.email ?? o.user_id).toLowerCase().includes(suggestionQuery.toLowerCase())
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value
      onChange(v)

      const cursor = e.target.selectionStart ?? v.length
      const beforeCursor = v.slice(0, cursor)
      const lastAt = beforeCursor.lastIndexOf('@')

      if (lastAt >= 0 && (lastAt === 0 || /\s/.test(beforeCursor[lastAt - 1]))) {
        const query = beforeCursor.slice(lastAt + 1)
        if (!query.includes(' ')) {
          setShowSuggestions(true)
          setSuggestionQuery(query)
          setSuggestionIndex(0)
          setMentionStart(lastAt)
          return
        }
      }
      setShowSuggestions(false)
      setMentionStart(null)
    },
    [onChange]
  )

  const insertMention = useCallback(
    (opt: MentionOption) => {
      if (mentionStart == null || !textareaRef.current) return
      const display = opt.email ?? opt.user_id.slice(0, 8)
      const before = value.slice(0, mentionStart)
      const after = value.slice(textareaRef.current.selectionStart ?? value.length)
      const newValue = `${before}@${display} ${after}`
      onChange(newValue)
      setShowSuggestions(false)
      setMentionStart(null)
      onMention?.(opt.user_id)
      setTimeout(() => {
        textareaRef.current?.focus()
        const pos = before.length + display.length + 2
        textareaRef.current?.setSelectionRange(pos, pos)
      }, 0)
    },
    [value, mentionStart, onChange, onMention]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions || filteredOptions.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggestionIndex((i) => (i + 1) % filteredOptions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggestionIndex((i) => (i - 1 + filteredOptions.length) % filteredOptions.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredOptions[suggestionIndex])
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
    },
    [showSuggestions, filteredOptions, suggestionIndex, insertMention]
  )

  useEffect(() => {
    if (filteredOptions.length > 0 && suggestionIndex >= filteredOptions.length) {
      setSuggestionIndex(0)
    }
  }, [filteredOptions.length, suggestionIndex])

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
      />
      {showSuggestions && filteredOptions.length > 0 && (
        <div
          className="absolute z-50 mt-1 max-h-40 overflow-auto rounded-md border bg-popover p-1 shadow-md"
          style={{ minWidth: 180 }}
        >
          {filteredOptions.map((opt, i) => (
            <button
              key={opt.user_id}
              type="button"
              className={cn(
                'w-full rounded px-2 py-1.5 text-left text-sm',
                i === suggestionIndex ? 'bg-accent' : 'hover:bg-accent/50'
              )}
              onClick={() => insertMention(opt)}
            >
              {opt.email ?? opt.user_id.slice(0, 8)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
