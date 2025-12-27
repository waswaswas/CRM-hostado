/**
 * Parser for contact form inquiry emails
 * Handles emails with subject "Ново запитване от контактната форма"
 */

export interface ContactFormData {
  name: string
  firstName: string
  secondName?: string
  email: string
  phone?: string
  subject?: string
  message: string
}

/**
 * Extracts contact form data from email body
 */
export function parseContactFormEmail(emailBody: string): ContactFormData | null {
  // First, try to extract from HTML if present
  let textBody = emailBody
  
  // Remove HTML tags but preserve line breaks for better parsing
  textBody = emailBody
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  
  // Normalize whitespace but keep line breaks
  textBody = textBody
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()

  // Improved patterns with better matching
  const patterns = {
    // Name patterns - more flexible
    name: /(?:Вашето име|Име|Name|^|\n)\s*:?\s*([А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)*)/i,
    // Email patterns - more robust
    email: /(?:Имейл адрес|Email|E-mail|Email Address)\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // Phone patterns - handles various formats
    phone: /(?:Телефонен номер|Телефон|Phone|Phone Number)\s*:?\s*([0-9\s\+\-\(\)]+)/i,
    // Subject pattern
    subject: /Тема\s*:?\s*([^\n]+)/i,
  }

  // Extract name - try multiple approaches
  let name = ''
  let firstName = ''
  let secondName: string | undefined

  // Method 1: Look for labeled name field "Вашето име: [Name]"
  // Extract name, stopping at newline or before "Имейл адрес"
  // Example: "Вашето име: Ангел\nИмейл адрес:" or "Вашето име: Игнат Хасков\nИмейл адрес:"
  let nameMatch = textBody.match(/Вашето име\s*:\s*([А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)*?)(?:\s*\n|\s*Имейл\s+адрес|\s*Email|\s*Телефон|\s*Phone|$)/i)
  
  // If that didn't work, try matching up to newline only
  if (!nameMatch) {
    nameMatch = textBody.match(/Вашето име\s*:\s*([А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)*?)(?:\n|$)/i)
  }
  
  // If still not found, try a simpler pattern but be careful to clean it
  if (!nameMatch) {
    const fullMatch = textBody.match(/Вашето име\s*:\s*([^\n]+)/i)
    if (fullMatch && fullMatch[1]) {
      // Extract only the name part, stopping before "Имейл адрес"
      const namePart = fullMatch[1].split(/(?:Имейл\s+адрес|Имейл|Email)/i)[0].trim()
      if (namePart && namePart.match(/^[А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)*$/)) {
        nameMatch = [null, namePart]
      }
    }
  }
  
  // Method 2: If not found, look for name at the beginning (before email/phone)
  if (!nameMatch) {
    const beforeEmail = textBody.split(/(?:Имейл адрес|Имейл|Email)/i)[0]
    if (beforeEmail) {
      // Remove "Вашето име:" if present and get the name
      const cleanedBeforeEmail = beforeEmail.replace(/Вашето име\s*:\s*/i, '').trim()
      const nameInStart = cleanedBeforeEmail.match(/^([А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)*)/)
      if (nameInStart && nameInStart[1].trim().length > 1) {
        nameMatch = nameInStart
      }
    }
  }

  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim()
    
    // Remove any field labels that might have been captured (like "Имейл адрес", "Email address")
    name = name
      .replace(/\s*Имейл\s+адрес.*$/i, '')
      .replace(/\s*Email\s+address.*$/i, '')
      .replace(/\s*Имейл\s*адрес.*$/i, '')
      .replace(/\s*Email.*$/i, '')
      .replace(/\s*Имейл.*$/i, '')
      .trim()
    
    // Split name into first and second name, filtering out any field label words
    const nameParts = name
      .split(/\s+/)
      .filter((p) => {
        const part = p.trim()
        return part.length > 0 && 
               !part.match(/^(Имейл|Email|адрес|address|Address)$/i) &&
               !part.match(/^[a-z]+@[a-z]+\./i) // Not an email
      })
    
    if (nameParts.length > 0) {
      firstName = nameParts[0]
      if (nameParts.length > 1) {
        secondName = nameParts.slice(1).join(' ')
      }
      // Reconstruct name from cleaned parts
      name = nameParts.join(' ')
    } else {
      // If all parts were filtered out, something went wrong
      name = ''
    }
  }

  // Extract email - more robust pattern
  let email = ''
  const emailMatch = textBody.match(patterns.email)
  if (emailMatch && emailMatch[1]) {
    email = emailMatch[1].trim()
  } else {
    // Fallback: look for any email pattern
    const emailFallback = textBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
    if (emailFallback) {
      email = emailFallback[1].trim()
    }
  }

  // Extract phone - clean and format
  let phone: string | undefined
  const phoneMatch = textBody.match(patterns.phone)
  if (phoneMatch && phoneMatch[1]) {
    phone = phoneMatch[1]
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^\d\+]/g, '') // Keep only digits and +
    if (phone.length < 8) {
      phone = undefined // Too short to be a valid phone
    }
  }

  // Extract subject
  const subjectMatch = textBody.match(patterns.subject)
  const subject = subjectMatch ? subjectMatch[1].trim() : undefined

  // Extract message - specifically look for content after "Тема:"
  // The description should be everything after "Тема:" until metadata starts
  // Remove all boilerplate text including "Споделете с нас Вашето виждане и ние ще дадем всичко от себе си, за да го превърнем в реалност::"
  let message = ''
  
  // Primary method: Find content after "Тема:" (Subject)
  const temaIndex = textBody.search(/Тема\s*:?\s*/i)
  
  if (temaIndex !== -1) {
    // Get everything after "Тема:"
    let afterTema = textBody.substring(temaIndex)
    
    // Remove the "Тема:" label and subject line
    afterTema = afterTema.replace(/Тема\s*:?\s*[^\n]+?\n?/i, '')
    
    // Look for the boilerplate pattern and extract only what comes after it
    // Pattern: "Споделете с нас Вашето виждане и ние ще дадем всичко от себе си, за да го превърнем в реалност::"
    // Also handle variations like "апочване на проект Споделете с нас..."
    // Match the full boilerplate including any text before it up to "::"
    // This pattern will match everything from the start of any boilerplate text up to and including "::"
    const boilerplatePattern = /(?:[^\n]*?)?(?:апочване на проект\s*)?Споделете с нас[\s\S]*?превърнем в реалност\s*::\s*/i
    
    // Try to find and remove the full boilerplate pattern
    const boilerplateMatch = afterTema.match(boilerplatePattern)
    if (boilerplateMatch) {
      // Get everything after the boilerplate
      const boilerplateIndex = afterTema.indexOf(boilerplateMatch[0])
      const boilerplateEnd = boilerplateIndex + boilerplateMatch[0].length
      message = afterTema.substring(boilerplateEnd)
        .trim()
    } else {
      // Fallback: Look for "::" pattern and get content after it
      // But first check if there's text before "::" that looks like boilerplate
      const doubleColonIndex = afterTema.indexOf('::')
      if (doubleColonIndex !== -1) {
        // Check if the text before "::" contains boilerplate keywords
        const beforeDoubleColon = afterTema.substring(0, doubleColonIndex)
        if (beforeDoubleColon.includes('Споделете') || beforeDoubleColon.includes('превърнем в реалност')) {
          // This is likely boilerplate, extract only what's after "::"
          message = afterTema.substring(doubleColonIndex + 2) // +2 for "::"
            .trim()
        } else {
          // No obvious boilerplate, but still extract after "::" if it exists
          message = afterTema.substring(doubleColonIndex + 2)
            .trim()
        }
      }
    }
    
    // Clean up the extracted message
    if (message) {
      message = message
        // Remove any remaining field labels that might have been captured
        .replace(/^(?:Вашето име|Име|Name|Email|Телефон|Телефонен номер|Phone|Имейл адрес)[\s:]*.*$/gmi, '')
        // Remove any remaining boilerplate text (be aggressive about this)
        .replace(/.*?Споделете с нас.*?превърнем в реалност.*?/gi, '')
        .replace(/.*?апочване на проект.*?/gi, '')
        .replace(/.*?Вашето виждане.*?/gi, '')
        // Remove any text that starts with boilerplate keywords
        .replace(/^(?:апочване|Споделете|превърнем|Вашето виждане).*?::\s*/gi, '')
        // Remove date/time/URL metadata at the end
        .replace(/\s*--\s*Date:.*$/i, '')
        .replace(/\s*Date:\s*\d{2}\/\d{2}\/\d{4}.*$/i, '')
        .replace(/\s*Time:\s*\d{2}:\d{2}.*$/i, '')
        .replace(/\s*Page URL:.*$/i, '')
        .replace(/\s*URL:.*$/i, '')
        // Remove URLs (but preserve the message content before them)
        .split(/\s*(?:--\s*Date:|Date:|Time:|Page URL:|URL:)/i)[0]
        .replace(/https?:\/\/[^\s]+/gi, '') // Remove any remaining URLs
        .replace(/[?&](?:gad_source|gad_campaignid|gclid)=[^\s&]*/gi, '') // Remove tracking parameters
        .replace(/\s+/g, ' ') // Normalize multiple spaces but preserve sentence structure
        .trim()
    }
    
    // If message is still too short or contains unwanted text, try to get more content
    if (!message || message.length < 3 || message.match(/^(?:апочване|Споделете|превърнем)/i)) {
      // Get everything after subject, removing only field labels and boilerplate
      const lines = afterTema.split('\n')
      const filteredLines = lines.filter(line => {
        const lowerLine = line.toLowerCase().trim()
        return lowerLine.length > 0 &&
               !lowerLine.includes('имейл') && 
               !lowerLine.includes('email') && 
               !lowerLine.includes('телефон') && 
               !lowerLine.includes('phone') &&
               !lowerLine.includes('вашето име') &&
               !lowerLine.includes('споделете с нас') &&
               !lowerLine.includes('превърнем в реалност') &&
               !lowerLine.includes('апочване на проект') &&
               !lowerLine.match(/^date:\s*\d/) &&
               !lowerLine.match(/^time:\s*\d/) &&
               !lowerLine.match(/^page url:/) &&
               !lowerLine.startsWith('http') &&
               !lowerLine.match(/^[a-z]+@[a-z]+\./) // Not an email
      })
      
      message = filteredLines.join(' ')
        .replace(/.*?Споделете с нас.*?превърнем в реалност.*?/gi, '')
        .replace(/.*?апочване на проект.*?/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }
  
  // Fallback: If no "Тема:" found, try other patterns
  if (!message || message.length < 20) {
    const fallbackPatterns = [
      /Споделете с нас[\s\S]+?::\s*([\s\S]+?)(?:\n\n|--|Date:|$)/i,
      /(?:Споделете|Share with us)[\s\S]+?::\s*([\s\S]+)/i,
    ]
    
    for (const pattern of fallbackPatterns) {
      const match = textBody.match(pattern)
      if (match && match[1]) {
        message = match[1]
          .replace(/^(?:Вашето име|Име|Name|Email|Телефон|Тема|Subject)[\s:]*.*$/gmi, '')
          .replace(/\s*--\s*Date:.*$/i, '')
          .replace(/https?:\/\/[^\s]+/gi, '')
          .trim()
        if (message.length > 20) break
      }
    }
  }
  
  // Final fallback: Clean the entire body
  if (!message || message.length < 20) {
    let cleanedBody = textBody
    // Remove all field labels and their values
    if (name) cleanedBody = cleanedBody.replace(new RegExp(`.*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`, 'gi'), '')
    if (email) cleanedBody = cleanedBody.replace(new RegExp(`.*${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`, 'gi'), '')
    if (phone) cleanedBody = cleanedBody.replace(new RegExp(`.*${phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`, 'gi'), '')
    
    cleanedBody = cleanedBody
      .replace(/.*(?:Вашето име|Име|Name).*/gi, '')
      .replace(/.*(?:Имейл адрес|Email|E-mail|Email Address).*/gi, '')
      .replace(/.*(?:Телефонен номер|Телефон|Phone|Phone Number).*/gi, '')
      .replace(/.*Тема\s*:?.*/gi, '')
      .replace(/.*Споделете с нас.*/gi, '')
      .replace(/\s*--\s*Date:.*$/gmi, '')
      .replace(/https?:\/\/[^\s]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (cleanedBody.length > 20) {
      message = cleanedBody
    }
  }

  // Validate we have at least name and email
  if (!name || !email) {
    return null
  }

  return {
    name,
    firstName,
    secondName,
    email,
    phone,
    subject,
    message: message || textBody, // Fallback to full body if no message extracted
  }
}




