'use client'

import { useCallback, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type ClientMentionOption = { id: string; label: string }

interface ClientMentionTextareaProps {
  value: string
  onChange: (value: string) => void
  onMention: (clientId: string) => void
  options: ClientMentionOption[]
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
  /** Enter (without Shift) sends when the @ suggestion list is closed. */
  onSubmitHotkey?: () => void
}

type DropdownCoords = {
  top: number
  left: number
  width: number
  maxHeight: number
}

const PREFERRED_MAX_PX = 22 * 16 // ~352px — ~6–8 rows

function measureDropdownPosition(el: HTMLTextAreaElement): DropdownCoords {
  const r = el.getBoundingClientRect()
  const gap = 6
  const margin = 12
  const spaceBelow = window.innerHeight - r.bottom - margin
  const spaceAbove = r.top - margin

  const openBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove
  let maxHeight: number
  let top: number

  if (openBelow) {
    maxHeight = Math.min(PREFERRED_MAX_PX, Math.max(200, spaceBelow))
    top = r.bottom + gap
  } else {
    maxHeight = Math.min(PREFERRED_MAX_PX, Math.max(200, spaceAbove))
    top = Math.max(margin, r.top - gap - maxHeight)
  }

  return {
    top,
    left: r.left,
    width: Math.max(r.width, 220),
    maxHeight,
  }
}

export function ClientMentionTextarea({
  value,
  onChange,
  onMention,
  options,
  placeholder,
  rows = 4,
  className,
  disabled,
  onSubmitHotkey,
}: ClientMentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState('')
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [dropdownCoords, setDropdownCoords] = useState<DropdownCoords | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(suggestionQuery.toLowerCase())
  )

  const updateDropdownPosition = useCallback(() => {
    const el = textareaRef.current
    if (!el || !showSuggestions) return
    setDropdownCoords(measureDropdownPosition(el))
  }, [showSuggestions])

  useLayoutEffect(() => {
    if (!showSuggestions || filteredOptions.length === 0) {
      setDropdownCoords(null)
      return
    }
    updateDropdownPosition()
  }, [showSuggestions, filteredOptions.length, updateDropdownPosition, value])

  useEffect(() => {
    if (!showSuggestions || filteredOptions.length === 0) return
    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true)
      window.removeEventListener('resize', updateDropdownPosition)
    }
  }, [showSuggestions, filteredOptions.length, updateDropdownPosition])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value
      onChange(v)

      const cursor = e.target.selectionStart ?? v.length
      const beforeCursor = v.slice(0, cursor)
      const lastAt = beforeCursor.lastIndexOf('@')

      if (lastAt >= 0 && (lastAt === 0 || /\s/.test(beforeCursor[lastAt - 1]!))) {
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
    (opt: ClientMentionOption) => {
      if (mentionStart == null || !textareaRef.current) return
      const display = opt.label
      const before = value.slice(0, mentionStart)
      const after = value.slice(textareaRef.current.selectionStart ?? value.length)
      const newValue = `${before}@${display} ${after}`
      onChange(newValue)
      setShowSuggestions(false)
      setMentionStart(null)
      setDropdownCoords(null)
      onMention(opt.id)
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
      if (showSuggestions && filteredOptions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSuggestionIndex((i) => (i + 1) % filteredOptions.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSuggestionIndex((i) => (i - 1 + filteredOptions.length) % filteredOptions.length)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          insertMention(filteredOptions[suggestionIndex]!)
          return
        }
        if (e.key === 'Escape') {
          setShowSuggestions(false)
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey && onSubmitHotkey) {
        e.preventDefault()
        onSubmitHotkey()
      }
    },
    [
      showSuggestions,
      filteredOptions,
      suggestionIndex,
      insertMention,
      onSubmitHotkey,
    ]
  )

  useEffect(() => {
    if (filteredOptions.length > 0 && suggestionIndex >= filteredOptions.length) {
      setSuggestionIndex(0)
    }
  }, [filteredOptions.length, suggestionIndex])

  const dropdown =
    mounted &&
    showSuggestions &&
    filteredOptions.length > 0 &&
    dropdownCoords &&
    createPortal(
      <div
        className="fixed z-[300] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 shadow-lg"
        style={{
          top: dropdownCoords.top,
          left: dropdownCoords.left,
          width: dropdownCoords.width,
          maxHeight: dropdownCoords.maxHeight,
        }}
        role="listbox"
      >
        {filteredOptions.map((opt, i) => (
          <button
            key={opt.id}
            type="button"
            role="option"
            aria-selected={i === suggestionIndex}
            className={cn(
              'w-full rounded px-2 py-2.5 text-left text-sm leading-snug min-h-[44px] flex items-start',
              i === suggestionIndex ? 'bg-accent' : 'hover:bg-accent/50'
            )}
            onClick={() => insertMention(opt)}
          >
            {opt.label}
          </button>
        ))}
      </div>,
      document.body
    )

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
      {dropdown}
    </div>
  )
}
