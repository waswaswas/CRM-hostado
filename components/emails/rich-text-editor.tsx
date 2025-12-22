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

  const normalizeHTML = (html: string): string => {
    if (!html) return ''
    
    // Convert <div> tags to <p> tags for better email compatibility
    html = html.replace(/<div>/gi, '<p>').replace(/<\/div>/gi, '</p>')
    
    // Remove empty paragraphs (they will be handled by spacing)
    html = html.replace(/<p>\s*<\/p>/gi, '')
    
    // Normalize <p> tags - if they don't have style, add it
    html = html.replace(/<p(?![^>]*style)/gi, '<p style="margin: 0 0 1em 0;"')
    
    // Clean up multiple consecutive <br> tags - keep only one
    html = html.replace(/(<br\s*\/?>){2,}/gi, '<br>')
    
    // Remove <br> tags that are immediately after closing </p> tags (spacing is handled by margin)
    html = html.replace(/<\/p>\s*<br\s*\/?>/gi, '</p>')
    
    // Remove <br> tags that are immediately before opening <p> tags
    html = html.replace(/<br\s*\/?>\s*<p>/gi, '<p>')
    
    // Clean up any remaining empty tags
    html = html.replace(/<p[^>]*>\s*<\/p>/gi, '')
    
    return html.trim()
  }

  const handleInput = () => {
    if (editorRef.current) {
      const html = normalizeHTML(editorRef.current.innerHTML)
      onChange(html)
    }
  }

  const execCommand = (command: string, value: string | boolean = false) => {
    document.execCommand(command, false, value as string)
    if (editorRef.current) {
      editorRef.current.focus()
      handleInput()
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
          handleInput()
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



