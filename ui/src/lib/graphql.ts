export interface GraphQLPresentation {
  detected: boolean
  transport: 'json' | 'raw'
  operationName: string
  query: string
  formattedQuery: string
  variablesText: string
  extensionsText: string
  bodyText: string
  bodyChanged: boolean
  errors: string[]
}

interface ParsedPacket {
  head: string
  separator: string
  body: string
  headers: Record<string, string>
}

const GRAPHQL_OPERATION_START = /^\s*(query|mutation|subscription|fragment)\b/
const GRAPHQL_SELECTION_START = /^\s*\{\s*[_A-Za-z]/

export function detectGraphQLBody(bodyText: string, headersJSON?: string): GraphQLPresentation | null {
  const contentType = getContentTypeFromJSON(headersJSON)
  return parseGraphQLBody(bodyText, contentType)
}

export function detectGraphQLPacket(rawPacket: string): GraphQLPresentation | null {
  const packet = splitRawHttpPacket(rawPacket)
  return parseGraphQLBody(packet.body, packet.headers['content-type'] || '')
}

export function updateGraphQLPacket(rawPacket: string, patch: {
  query?: string
  variablesText?: string
  operationName?: string
  extensionsText?: string
}): { raw: string; error?: string } {
  const packet = splitRawHttpPacket(rawPacket)
  const parsed = parseGraphQLBody(packet.body, packet.headers['content-type'] || '')
  if (!parsed) return { raw: rawPacket, error: 'Current packet body is not GraphQL' }

  let nextBody = packet.body
  if (parsed.transport === 'json') {
    try {
      const payload = JSON.parse(packet.body || '{}') as Record<string, unknown> | unknown[]
      const target = Array.isArray(payload) ? payload[0] : payload
      if (!target || typeof target !== 'object') {
        return { raw: rawPacket, error: 'GraphQL JSON payload must be an object' }
      }
      const targetPayload = target as Record<string, unknown>
      if (patch.query !== undefined) targetPayload.query = patch.query
      if (patch.operationName !== undefined) {
        if (patch.operationName.trim()) targetPayload.operationName = patch.operationName.trim()
        else delete targetPayload.operationName
      }
      if (patch.variablesText !== undefined) {
        if (patch.variablesText.trim()) targetPayload.variables = JSON.parse(patch.variablesText)
        else delete targetPayload.variables
      }
      if (patch.extensionsText !== undefined) {
        if (patch.extensionsText.trim()) targetPayload.extensions = JSON.parse(patch.extensionsText)
        else delete targetPayload.extensions
      }
      nextBody = JSON.stringify(payload, null, 2)
    } catch (error) {
      return {
        raw: rawPacket,
        error: error instanceof Error ? error.message : 'Invalid GraphQL JSON payload',
      }
    }
  } else {
    nextBody = patch.query ?? packet.body
  }

  return { raw: `${packet.head}${packet.separator}${nextBody}` }
}

function parseGraphQLBody(bodyText: string, contentType: string): GraphQLPresentation | null {
  const trimmed = bodyText.trim()
  if (!trimmed) return null

  const lowerContentType = contentType.toLowerCase()
  const errors: string[] = []

  if (isGraphQLContentType(lowerContentType) && !looksLikeJson(trimmed)) {
    return {
      detected: true,
      transport: 'raw',
      operationName: extractOperationName(trimmed),
      query: bodyText,
      formattedQuery: formatGraphQLQuery(bodyText),
      variablesText: '',
      extensionsText: '',
      bodyText,
      bodyChanged: false,
      errors,
    }
  }

  if (looksLikeJson(trimmed)) {
    try {
      const payload = JSON.parse(trimmed)
      const gqlPayload = Array.isArray(payload) ? payload[0] : payload
      if (!gqlPayload || typeof gqlPayload !== 'object') return null

      const query = typeof gqlPayload.query === 'string' ? gqlPayload.query : ''
      const hasGraphQLShape = typeof gqlPayload.query === 'string' ||
        (isGraphQLContentType(lowerContentType) && (
          Object.prototype.hasOwnProperty.call(gqlPayload, 'operationName') ||
          Object.prototype.hasOwnProperty.call(gqlPayload, 'variables') ||
          Object.prototype.hasOwnProperty.call(gqlPayload, 'extensions')
        ))

      if (!hasGraphQLShape || (query && !looksLikeGraphQLQuery(query))) return null

      const bodyTextFormatted = JSON.stringify(payload, null, 2)
      return {
        detected: true,
        transport: 'json',
        operationName: typeof gqlPayload.operationName === 'string'
          ? gqlPayload.operationName
          : extractOperationName(query),
        query,
        formattedQuery: formatGraphQLQuery(query),
        variablesText: gqlPayload.variables == null ? '' : JSON.stringify(gqlPayload.variables, null, 2),
        extensionsText: gqlPayload.extensions == null ? '' : JSON.stringify(gqlPayload.extensions, null, 2),
        bodyText: bodyTextFormatted,
        bodyChanged: bodyTextFormatted !== bodyText,
        errors,
      }
    } catch {
      return null
    }
  }

  if (looksLikeRawGraphQLDocument(trimmed)) {
    return {
      detected: true,
      transport: 'raw',
      operationName: extractOperationName(trimmed),
      query: bodyText,
      formattedQuery: formatGraphQLQuery(bodyText),
      variablesText: '',
      extensionsText: '',
      bodyText,
      bodyChanged: false,
      errors,
    }
  }

  return null
}

export function formatGraphQLQuery(source: string): string {
  const input = source.trim()
  if (!input) return ''

  const out: string[] = []
  let indent = 0
  let current = ''
  let inString = false
  let stringQuote = ''
  let escaped = false
  let blockString = false

  const flush = () => {
    const line = current.trim()
    if (line) out.push(`${'  '.repeat(Math.max(indent, 0))}${line}`)
    current = ''
  }

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]
    const next3 = input.slice(i, i + 3)

    if (inString) {
      current += ch
      if (blockString && next3 === '"""') {
        current += '""'
        i += 2
        inString = false
        blockString = false
        continue
      }
      if (!blockString && escaped) {
        escaped = false
        continue
      }
      if (!blockString && ch === '\\') {
        escaped = true
        continue
      }
      if (!blockString && ch === stringQuote) inString = false
      continue
    }

    if (next3 === '"""') {
      current += next3
      i += 2
      inString = true
      blockString = true
      stringQuote = '"'
      continue
    }

    if (ch === '"' || ch === "'") {
      current += ch
      inString = true
      stringQuote = ch
      continue
    }

    if (ch === '{' || ch === '[' || ch === '(') {
      current += ch
      flush()
      indent += 1
      continue
    }

    if (ch === '}' || ch === ']' || ch === ')') {
      flush()
      indent -= 1
      out.push(`${'  '.repeat(Math.max(indent, 0))}${ch}`)
      continue
    }

    if (ch === ',') {
      current += ch
      flush()
      continue
    }

    if (/\s/.test(ch)) {
      if (current && !/\s$/.test(current)) current += ' '
      continue
    }

    current += ch
  }

  flush()
  return out.join('\n')
}

function splitRawHttpPacket(raw: string): ParsedPacket {
  const separator = raw.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n'
  const idx = raw.indexOf(separator)
  const head = idx >= 0 ? raw.slice(0, idx) : raw
  const body = idx >= 0 ? raw.slice(idx + separator.length) : ''
  const headers: Record<string, string> = {}
  for (const line of head.split(/\r?\n/).slice(1)) {
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim()
  }
  return { head, separator, body, headers }
}

function getContentTypeFromJSON(headersJSON?: string): string {
  if (!headersJSON) return ''
  try {
    const parsed = JSON.parse(headersJSON) as Record<string, string[] | string>
    for (const [name, value] of Object.entries(parsed)) {
      if (name.toLowerCase() !== 'content-type') continue
      return Array.isArray(value) ? value.join(', ') : String(value)
    }
  } catch {
    return ''
  }
  return ''
}

function looksLikeJson(value: string): boolean {
  return (value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))
}

function looksLikeGraphQLQuery(value: string): boolean {
  const trimmed = value.trim()
  return GRAPHQL_OPERATION_START.test(trimmed) || GRAPHQL_SELECTION_START.test(trimmed)
}

function looksLikeRawGraphQLDocument(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.startsWith('<')) return false
  return looksLikeGraphQLQuery(trimmed)
}

function isGraphQLContentType(contentType: string): boolean {
  return contentType.includes('graphql')
}

function extractOperationName(query: string): string {
  const match = query.match(/\b(query|mutation|subscription)\s+([_A-Za-z][_0-9A-Za-z]*)/)
  return match?.[2] ?? ''
}
