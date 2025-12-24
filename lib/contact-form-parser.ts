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
  let nameMatch = textBody.match(/(?:Вашето име|Име|Name)\s*:\s*([А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)*)/i)
  
  // Method 2: If not found, look for name at the beginning (before email/phone)
  if (!nameMatch) {
    const beforeEmail = textBody.split(/(?:Имейл адрес|Имейл|Email)/i)[0]
    if (beforeEmail) {
      const nameInStart = beforeEmail.match(/^([А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)*)/)
      if (nameInStart && nameInStart[1].trim().length > 1) {
        nameMatch = nameInStart
      }
    }
  }

  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim()
    // Split name into first and second name
    const nameParts = name.split(/\s+/).filter((p) => p.length > 0)
    if (nameParts.length > 0) {
      firstName = nameParts[0]
      if (nameParts.length > 1) {
        secondName = nameParts.slice(1).join(' ')
      }
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
  let message = ''
  
  // Primary method: Find content after "Тема:" (Subject)
  const temaIndex = textBody.search(/Тема\s*:?\s*/i)
  
  if (temaIndex !== -1) {
    // Get everything after "Тема:"
    let afterTema = textBody.substring(temaIndex)
    
    // Remove the "Тема:" label and subject line
    afterTema = afterTema.replace(/Тема\s*:?\s*[^\n]+?\n?/i, '')
    
    // Look for the actual message content
    // Pattern: "Споделете с нас Вашето виждане и ние ще дадем всичко от себе си, за да го превърнем в реалност:: [MESSAGE]"
    // The message starts after "::" and continues until metadata or end
    const doubleColonIndex = afterTema.indexOf('::')
    
    if (doubleColonIndex !== -1) {
      // Get everything after "::"
      message = afterTema.substring(doubleColonIndex + 2) // +2 for "::"
        .trim()
        // Remove any remaining field labels that might have been captured
        .replace(/^(?:Вашето име|Име|Name|Email|Телефон|Телефонен номер|Phone|Имейл адрес)[\s:]*.*$/gmi, '')
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
    } else {
      // Fallback: Look for "Споделете с нас" pattern and get content after it
      const sharePattern = /Споделете с нас[\s\S]+?::\s*/i
      const shareMatch = afterTema.match(sharePattern)
      if (shareMatch && shareMatch[0]) {
        const shareIndex = afterTema.indexOf(shareMatch[0])
        message = afterTema.substring(shareIndex + shareMatch[0].length)
          .replace(/^(?:Вашето име|Име|Name|Email|Телефон|Телефонен номер|Phone|Имейл адрес)[\s:]*.*$/gmi, '')
          .split(/\s*(?:--\s*Date:|Date:|Time:|Page URL:|URL:)/i)[0]
          .replace(/https?:\/\/[^\s]+/gi, '')
          .replace(/[?&](?:gad_source|gad_campaignid|gclid)=[^\s&]*/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
      }
    }
    
    // If message is still too short, try to get more content
    if (!message || message.length < 20) {
      // Get everything after subject, removing only field labels
      const lines = afterTema.split('\n')
      const filteredLines = lines.filter(line => {
        const lowerLine = line.toLowerCase().trim()
        return lowerLine.length > 0 &&
               !lowerLine.includes('имейл') && 
               !lowerLine.includes('email') && 
               !lowerLine.includes('телефон') && 
               !lowerLine.includes('phone') &&
               !lowerLine.includes('вашето име') &&
               !lowerLine.match(/^date:\s*\d/) &&
               !lowerLine.match(/^time:\s*\d/) &&
               !lowerLine.match(/^page url:/) &&
               !lowerLine.startsWith('http') &&
               !lowerLine.match(/^[a-z]+@[a-z]+\./) // Not an email
      })
      
      message = filteredLines.join(' ')
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
