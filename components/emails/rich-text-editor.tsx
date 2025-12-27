'use client'

import { useRef, useEffect, useCallback } from 'react'
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
  const isUpdatingRef = useRef(false)

  // Initialize editor with proper structure - only when truly empty
  const ensureStructure = useCallback(() => {
    if (!editorRef.current) return
    
    // Only add paragraph if editor is completely empty (no children, no text)
    const isEmpty = editorRef.current.children.length === 0 && 
                    (!editorRef.current.textContent || editorRef.current.textContent.trim() === '')
    
    if (isEmpty) {
      const p = document.createElement('p')
      p.style.margin = '0 0 1em 0'
      p.style.padding = '0'
      editorRef.current.appendChild(p)
      
      // Set cursor in the paragraph
      const range = document.createRange()
      range.setStart(p, 0)
      range.collapse(true)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }, [])

  useEffect(() => {
    if (!editorRef.current || isUpdatingRef.current) return
    
    const currentHtml = editorRef.current.innerHTML.trim()
    const normalizedValue = value || ''
    
    // Only update if value changed externally
    if (normalizedValue !== currentHtml) {
      isUpdatingRef.current = true
      
      if (normalizedValue) {
        editorRef.current.innerHTML = normalizedValue
        ensureStructure()
      } else {
        editorRef.current.innerHTML = ''
        ensureStructure()
      }
      
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }
  }, [value, ensureStructure])

  const normalizeHTML = useCallback((html: string): string => {
    if (!html) return ''
    
    // Convert <div> tags to <p> tags for better email compatibility
    html = html.replace(/<div([^>]*)>/gi, '<p$1>').replace(/<\/div>/gi, '</p>')
    
    // Ensure all paragraphs have proper margin styling
    html = html.replace(/<p([^>]*)>/gi, (match, attrs) => {
      if (attrs && attrs.includes('style=')) {
        // Has style attribute, ensure margin is set
        if (!attrs.includes('margin')) {
          return match.replace(/style="([^"]*)"/, 'style="$1; margin: 0 0 1em 0;"')
        }
        return match
      }
      // No style attribute, add it
      return '<p style="margin: 0 0 1em 0;">'
    })
    
    // Clean up multiple consecutive <br> tags
    html = html.replace(/(<br\s*\/?>){2,}/gi, '<br>')
    
    // Remove <br> tags after </p>
    html = html.replace(/<\/p>\s*<br\s*\/?>/gi, '</p>')
    
    // Remove <br> tags before <p>
    html = html.replace(/<br\s*\/?>\s*<p>/gi, '<p>')
    
    // Remove completely empty paragraphs
    html = html.replace(/<p[^>]*>\s*<\/p>/gi, '')
    
    return html.trim()
  }, [])

  const handleInput = useCallback(() => {
    if (!editorRef.current || isUpdatingRef.current) return
    
    // Save current selection to restore after update
    const selection = window.getSelection()
    let savedRange: Range | null = null
    if (selection && selection.rangeCount) {
      savedRange = selection.getRangeAt(0).cloneRange()
    }
    
    // Only ensure paragraphs have proper styling, don't restructure
    const paragraphs = editorRef.current.querySelectorAll('p')
    paragraphs.forEach((p) => {
      const el = p as HTMLElement
      if (!el.style.margin || el.style.margin === '0px') {
        el.style.margin = '0 0 1em 0'
      }
      el.style.padding = '0'
    })
    
    // Get HTML - minimal processing during editing to preserve structure
    let html = editorRef.current.innerHTML
    
    // Only convert divs to p tags (preserve all content)
    html = html.replace(/<div([^>]*)>/gi, '<p$1>').replace(/<\/div>/gi, '</p>')
    
    // Ensure paragraphs have margin style in HTML (but don't modify content)
    html = html.replace(/<p([^>]*)>/gi, (match, attrs) => {
      if (attrs && attrs.includes('style=')) {
        if (!attrs.includes('margin')) {
          return match.replace(/style="([^"]*)"/, 'style="$1; margin: 0 0 1em 0;"')
        }
        return match
      }
      return '<p style="margin: 0 0 1em 0;">'
    })
    
    onChange(html)
    
    // Restore selection if it was saved (helps with cyrillic)
    if (savedRange && selection) {
      try {
        // Try to restore the exact range
        selection.removeAllRanges()
        selection.addRange(savedRange)
      } catch (err) {
        // If restoration fails, try to restore approximate position
        const range = selection.getRangeAt(0)
        if (range && editorRef.current.contains(range.commonAncestorContainer)) {
          // Selection is still valid, keep it
        }
      }
    }
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      
      if (!editorRef.current) return
      
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      
      // Use a simpler, more reliable approach - let browser handle it, then fix structure
      // First, ensure we're in a paragraph
      const range = selection.getRangeAt(0)
      let currentP: HTMLElement | null = null
      
      // Find paragraph
      let node: Node | null = range.commonAncestorContainer
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'P') {
          currentP = node as HTMLElement
          break
        }
        node = node.parentNode
      }
      
      // If no paragraph, wrap content first
      if (!currentP) {
        // Check if we have unwrapped content
        const hasUnwrappedContent = Array.from(editorRef.current.childNodes).some(
          (child) => child.nodeType === Node.TEXT_NODE || 
                     (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName !== 'P')
        )
        
        if (hasUnwrappedContent) {
          // Wrap all content in a paragraph
          currentP = document.createElement('p')
          currentP.style.margin = '0 0 1em 0'
          currentP.style.padding = '0'
          
          // Collect all nodes to wrap
          const nodesToWrap: Node[] = []
          Array.from(editorRef.current.childNodes).forEach((child) => {
            nodesToWrap.push(child)
          })
          
          nodesToWrap.forEach((n) => currentP!.appendChild(n))
          editorRef.current.appendChild(currentP)
          
          // Restore cursor position
          const textContent = currentP.textContent || ''
          const cursorPos = Math.min(range.startOffset, textContent.length)
          
          const newRange = document.createRange()
          if (currentP.firstChild && currentP.firstChild.nodeType === Node.TEXT_NODE) {
            newRange.setStart(currentP.firstChild, cursorPos)
          } else {
            newRange.setStart(currentP, 0)
          }
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
        } else {
          ensureStructure()
          currentP = editorRef.current.querySelector('p') as HTMLElement
        }
      }
      
      if (!currentP) return
      
      // For cyrillic/unicode, use a more reliable approach
      // Save the exact cursor position using text content (works better with unicode)
      const paragraphText = currentP.textContent || ''
      let cursorOffset = 0
      
      // Calculate cursor offset by walking through text nodes
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer as Text
        // Count characters before cursor in this text node
        cursorOffset = range.startOffset
        
        // Count characters in previous siblings
        let node: Node | null = textNode.previousSibling
        while (node) {
          if (node.nodeType === Node.TEXT_NODE) {
            cursorOffset += (node as Text).textContent?.length || 0
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            cursorOffset += (node as HTMLElement).textContent?.length || 0
          }
          node = node.previousSibling
        }
      } else {
        // Cursor is in element node, count all text before it
        cursorOffset = paragraphText.length
      }
      
      // Create new paragraph
      const newP = document.createElement('p')
      newP.style.margin = '0 0 1em 0'
      newP.style.padding = '0'
      
      // Split content at cursor position using text content (more reliable for unicode)
      if (cursorOffset < paragraphText.length) {
        // We need to split - extract content after cursor
        const afterText = paragraphText.substring(cursorOffset)
        
        // Clear current paragraph and set text before cursor
        const beforeText = paragraphText.substring(0, cursorOffset)
        currentP.textContent = beforeText
        
        // Add text after cursor to new paragraph
        if (afterText) {
          newP.textContent = afterText
        }
      }
      
      // Insert new paragraph after current
      if (currentP.nextSibling) {
        currentP.parentNode?.insertBefore(newP, currentP.nextSibling)
      } else {
        currentP.parentNode?.appendChild(newP)
      }
      
      // Move cursor to start of new paragraph
      const newRange = document.createRange()
      if (newP.firstChild && newP.firstChild.nodeType === Node.TEXT_NODE) {
        newRange.setStart(newP.firstChild, 0)
      } else {
        // If no text node, create one
        const textNode = document.createTextNode('')
        newP.appendChild(textNode)
        newRange.setStart(textNode, 0)
      }
      newRange.collapse(true)
      
      selection.removeAllRanges()
      selection.addRange(newRange)
      
      // Update content - use setTimeout to ensure DOM is settled
      setTimeout(() => {
        handleInput()
      }, 0)
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter for line break
      e.preventDefault()
      document.execCommand('insertLineBreak', false)
      requestAnimationFrame(() => handleInput())
    }
  }, [handleInput, ensureStructure])

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
        onKeyDown={handleKeyDown}
        onBlur={handleInput}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          const selection = window.getSelection()
          if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0)
            range.deleteContents()
            const textNode = document.createTextNode(text)
            range.insertNode(textNode)
            range.setStartAfter(textNode)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
          }
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






