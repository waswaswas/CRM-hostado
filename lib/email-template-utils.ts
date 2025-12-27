export interface TemplateVariables {
  [key: string]: string | number | null
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  let rendered = template

  Object.keys(variables).forEach((key) => {
    const value = variables[key]
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    rendered = rendered.replace(regex, value !== null && value !== undefined ? String(value) : '')
  })

  return rendered
}













