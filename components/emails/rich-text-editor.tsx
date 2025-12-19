'use client'

import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const execCommand = (command: string, value: string | boolean = false) => {
    document.execCommand(command, false, value as string)
    if (editorRef.current) {
      editorRef.current.focus()
      onChange(editorRef.current.innerHTML)
    }
  }

  const ToolbarButton = ({ 
    onClick, 
    icon: Icon, 
    title, 
    disabled = false 
  }: { 
    onClick: () => void
    icon: any
    title: string
    disabled?: boolean
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8 p-0"
    >
      <Icon className="h-4 w-4" />
    </Button>
  )

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/50 flex-wrap">
        <ToolbarButton
          onClick={() => execCommand('bold')}
          icon={Bold}
          title="Bold"
        />
        <ToolbarButton
          onClick={() => execCommand('italic')}
          icon={Italic}
          title="Italic"
        />
        <ToolbarButton
          onClick={() => execCommand('underline')}
          icon={Underline}
          title="Underline"
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ToolbarButton
          onClick={() => execCommand('insertUnorderedList')}
          icon={List}
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => execCommand('insertOrderedList')}
          icon={ListOrdered}
          title="Numbered List"
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ToolbarButton
          onClick={() => execCommand('justifyLeft')}
          icon={AlignLeft}
          title="Align Left"
        />
        <ToolbarButton
          onClick={() => execCommand('justifyCenter')}
          icon={AlignCenter}
          title="Align Center"
        />
        <ToolbarButton
          onClick={() => execCommand('justifyRight')}
          icon={AlignRight}
          title="Align Right"
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ToolbarButton
          onClick={() => execCommand('undo')}
          icon={Undo}
          title="Undo"
        />
        <ToolbarButton
          onClick={() => execCommand('redo')}
          icon={Redo}
          title="Redo"
        />
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, text)
        }}
        className="min-h-[300px] p-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-background"
        style={{
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          lineHeight: '1.6',
        }}
        data-placeholder={placeholder || 'Start typing...'}
        suppressContentEditableWarning
      />
    </div>
  )
}
