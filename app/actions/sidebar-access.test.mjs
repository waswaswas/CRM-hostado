/**
 * Loads getSidebarAccessBundle via TypeScript transpileModule + CommonJS Module
 * hooks, with mocked Supabase + assistants deps — no tsconfig changes.
 */
import assert from 'node:assert/strict'
import { describe, it, afterEach } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import Module from 'node:module'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const SIDEBAR_ABS = path.join(ROOT, 'app/actions/sidebar-access.ts')

const SIDEBAR_FEATURES = [
  'dashboard',
  'clients',
  'offers',
  'emails',
  'accounting',
  'reminders',
  'settings',
  'users',
  'todo',
]

/** @type {Map<string, unknown>} */
const mocks = new Map()
/** @type {Map<string, import('node:module').Module>} */
const tsCache = new Map()
let originalLoad = null

function resolveTsCandidate(request, parentFilename) {
  if (request.startsWith('@/')) {
    return path.join(ROOT, request.slice(2))
  }
  if (request.startsWith('.') && parentFilename) {
    return path.resolve(path.dirname(parentFilename), request)
  }
  return null
}

function findTsFile(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

function loadTsFile(absTsPath) {
  const normalized = path.resolve(absTsPath)
  if (tsCache.has(normalized)) return tsCache.get(normalized).exports

  const source = fs.readFileSync(normalized, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: normalized,
  })

  const mod = new Module(normalized)
  mod.filename = normalized
  mod.paths = Module._nodeModulePaths(path.dirname(normalized))
  tsCache.set(normalized, mod)
  mod._compile(outputText, normalized)
  return mod.exports
}

function installLoader() {
  if (originalLoad) return
  originalLoad = Module._load
  Module._load = function patchedLoad(request, parent, isMain) {
    if (mocks.has(request)) return mocks.get(request)

    const parentFilename = parent?.filename || ''
    const aliasOrRel = resolveTsCandidate(request, parentFilename)
    if (aliasOrRel) {
      const mockKey = request.startsWith('@/')
        ? request
        : path.resolve(path.dirname(parentFilename), request)
      // Also allow mocking by absolute/@ path variants
      if (mocks.has(mockKey)) return mocks.get(mockKey)

      const tsFile = findTsFile(aliasOrRel)
      if (tsFile) return loadTsFile(tsFile)
    }

    return originalLoad.apply(this, arguments)
  }
}

function uninstallLoader() {
  if (originalLoad) {
    Module._load = originalLoad
    originalLoad = null
  }
  mocks.clear()
  tsCache.clear()
  // Clear require cache entries we may have created for the TS files
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(ROOT) && (key.endsWith('.ts') || key.includes('sidebar-access'))) {
      delete require.cache[key]
    }
  }
}

/**
 * @param {object} opts
 * @param {{ id: string } | null} opts.user
 * @param {{ data: { role: string } | null, error: object | null }} opts.memberResult
 * @param {{ data: Array<{feature:string,has_access:boolean|null}> | null, error: object | null }} [opts.permissionsResult]
 * @param {object} [opts.assistants]
 */
function installMocks(opts) {
  const queries = []

  function createBuilder(table) {
    const q = {
      table,
      selectCols: null,
      eqs: [],
      terminal: null,
    }
    queries.push(q)

    const builder = {
      select(cols) {
        q.selectCols = cols
        return builder
      },
      eq(col, val) {
        q.eqs.push([col, val])
        return builder
      },
      single() {
        q.terminal = 'single'
        if (table === 'organization_members') {
          return Promise.resolve(opts.memberResult)
        }
        return Promise.resolve({ data: null, error: { message: 'unexpected single' } })
      },
      // Awaited without .single() for organization_permissions
      then(resolve, reject) {
        q.terminal = q.terminal || 'await'
        const result =
          table === 'organization_permissions'
            ? (opts.permissionsResult ?? { data: [], error: null })
            : { data: null, error: { message: `unexpected await on ${table}` } }
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return builder
  }

  let getUserCalls = 0
  const supabase = {
    auth: {
      async getUser() {
        getUserCalls += 1
        return { data: { user: opts.user }, error: null }
      },
    },
    from(table) {
      return createBuilder(table)
    },
  }

  let assistantsCalls = 0
  const assistantsState = opts.assistants ?? {
    canUseFeature: true,
    canManage: false,
    allowedBotIds: ['bot-1'],
    orgId: 'org-1',
  }

  mocks.set('@/lib/supabase/server', {
    createClient: async () => supabase,
  })
  mocks.set('@/app/actions/ai-assistants', {
    getAssistantsAccessState: async () => {
      assistantsCalls += 1
      return assistantsState
    },
  })

  return {
    queries,
    getUserCalls: () => getUserCalls,
    assistantsCalls: () => assistantsCalls,
  }
}

function loadSidebarAction() {
  installLoader()
  // Bust cache so mocks apply to a fresh module graph
  tsCache.clear()
  return loadTsFile(SIDEBAR_ABS)
}

const ORG_ID = 'org-aaa'
const USER_ID = 'user-bbb'

function memberQuery(queries) {
  return queries.filter((q) => q.table === 'organization_members')
}

function permissionsQuery(queries) {
  return queries.filter((q) => q.table === 'organization_permissions')
}

function assertMemberFilters(q) {
  assert.equal(q.selectCols, 'role')
  assert.deepEqual(q.eqs, [
    ['organization_id', ORG_ID],
    ['user_id', USER_ID],
    ['is_active', true],
  ])
  assert.equal(q.terminal, 'single')
}

function assertPermissionsFilters(q) {
  assert.equal(q.selectCols, 'feature, has_access')
  assert.deepEqual(q.eqs, [
    ['organization_id', ORG_ID],
    ['user_id', USER_ID],
  ])
  assert.equal(q.terminal, 'await')
}

function allFalse(permissions) {
  for (const f of SIDEBAR_FEATURES) assert.equal(permissions[f], false, f)
}

function allTrue(permissions) {
  for (const f of SIDEBAR_FEATURES) assert.equal(permissions[f], true, f)
}

describe('getSidebarAccessBundle (mocked Supabase)', () => {
  afterEach(() => {
    uninstallLoader()
  })

  it('owner: one auth, one active membership lookup, no permissions query; all features true', async () => {
    const probe = installMocks({
      user: { id: USER_ID },
      memberResult: { data: { role: 'owner' }, error: null },
    })
    const { getSidebarAccessBundle } = loadSidebarAction()
    const result = await getSidebarAccessBundle(ORG_ID)

    assert.equal(probe.getUserCalls(), 1)
    assert.equal(memberQuery(probe.queries).length, 1)
    assert.equal(permissionsQuery(probe.queries).length, 0)
    assert.equal(probe.assistantsCalls(), 1)
    assertMemberFilters(memberQuery(probe.queries)[0])
    allTrue(result.permissions)
    assert.equal(result.assistantsCanOpen, true)
    assert.equal(result.assistantsCanManage, false)
  })

  it('admin: same query shape as owner; all features true', async () => {
    const probe = installMocks({
      user: { id: USER_ID },
      memberResult: { data: { role: 'admin' }, error: null },
    })
    const { getSidebarAccessBundle } = loadSidebarAction()
    const result = await getSidebarAccessBundle(ORG_ID)

    assert.equal(probe.getUserCalls(), 1)
    assert.equal(memberQuery(probe.queries).length, 1)
    assert.equal(permissionsQuery(probe.queries).length, 0)
    assertMemberFilters(memberQuery(probe.queries)[0])
    allTrue(result.permissions)
  })

  it('viewer: explicit allow/deny + deny defaults; emails maps to email row', async () => {
    const probe = installMocks({
      user: { id: USER_ID },
      memberResult: { data: { role: 'member' }, error: null },
      permissionsResult: {
        data: [
          { feature: 'clients', has_access: true },
          { feature: 'offers', has_access: false },
          { feature: 'email', has_access: true },
        ],
        error: null,
      },
    })
    const { getSidebarAccessBundle } = loadSidebarAction()
    const result = await getSidebarAccessBundle(ORG_ID)

    assert.equal(probe.getUserCalls(), 1)
    assert.equal(memberQuery(probe.queries).length, 1)
    assert.equal(permissionsQuery(probe.queries).length, 1)
    assertMemberFilters(memberQuery(probe.queries)[0])
    assertPermissionsFilters(permissionsQuery(probe.queries)[0])

    assert.equal(result.permissions.clients, true)
    assert.equal(result.permissions.offers, false)
    assert.equal(result.permissions.emails, true)
    assert.equal(result.permissions.dashboard, false)
    assert.equal(result.permissions.settings, false)
  })

  it('inactive/non-member: membership .single empty → deny all; no permissions query', async () => {
    const probe = installMocks({
      user: { id: USER_ID },
      memberResult: { data: null, error: { code: 'PGRST116', message: 'not found' } },
    })
    const { getSidebarAccessBundle } = loadSidebarAction()
    const result = await getSidebarAccessBundle(ORG_ID)

    assert.equal(memberQuery(probe.queries).length, 1)
    assertMemberFilters(memberQuery(probe.queries)[0])
    assert.equal(permissionsQuery(probe.queries).length, 0)
    allFalse(result.permissions)
  })

  it('unauthenticated: no membership/permissions queries; deny all', async () => {
    const probe = installMocks({
      user: null,
      memberResult: { data: null, error: null },
    })
    const { getSidebarAccessBundle } = loadSidebarAction()
    const result = await getSidebarAccessBundle(ORG_ID)

    assert.equal(probe.getUserCalls(), 1)
    assert.equal(probe.queries.length, 0)
    assert.equal(probe.assistantsCalls(), 1)
    allFalse(result.permissions)
  })

  it('membership query failure (error, no row): deny all; no permissions query', async () => {
    const probe = installMocks({
      user: { id: USER_ID },
      memberResult: { data: null, error: { message: 'db down' } },
    })
    const { getSidebarAccessBundle } = loadSidebarAction()
    const result = await getSidebarAccessBundle(ORG_ID)

    assert.equal(memberQuery(probe.queries).length, 1)
    assert.equal(permissionsQuery(probe.queries).length, 0)
    allFalse(result.permissions)
  })

  it('permissions query failure for non-owner/admin: deny all', async () => {
    const probe = installMocks({
      user: { id: USER_ID },
      memberResult: { data: { role: 'viewer' }, error: null },
      permissionsResult: { data: null, error: { message: 'perm query failed' } },
    })
    const { getSidebarAccessBundle } = loadSidebarAction()
    const result = await getSidebarAccessBundle(ORG_ID)

    assert.equal(permissionsQuery(probe.queries).length, 1)
    assertPermissionsFilters(permissionsQuery(probe.queries)[0])
    allFalse(result.permissions)
  })

  it('email normalization: UI emails key only grants via DB feature=email', async () => {
    const probeWrong = installMocks({
      user: { id: USER_ID },
      memberResult: { data: { role: 'member' }, error: null },
      permissionsResult: {
        data: [{ feature: 'emails', has_access: true }],
        error: null,
      },
    })
    let { getSidebarAccessBundle } = loadSidebarAction()
    let result = await getSidebarAccessBundle(ORG_ID)
    assert.equal(result.permissions.emails, false)
    uninstallLoader()

    const probeRight = installMocks({
      user: { id: USER_ID },
      memberResult: { data: { role: 'member' }, error: null },
      permissionsResult: {
        data: [{ feature: 'email', has_access: true }],
        error: null,
      },
    })
    ;({ getSidebarAccessBundle } = loadSidebarAction())
    result = await getSidebarAccessBundle(ORG_ID)
    assert.equal(result.permissions.emails, true)
    assert.equal(probeRight.getUserCalls(), 1)
    assert.equal(permissionsQuery(probeRight.queries).length, 1)
  })

  it('assistants helper stays independent: failure falls back without affecting permissions', async () => {
    installMocks({
      user: { id: USER_ID },
      memberResult: { data: { role: 'owner' }, error: null },
    })
    mocks.set('@/app/actions/ai-assistants', {
      getAssistantsAccessState: async () => {
        throw new Error('assistants down')
      },
    })
    const { getSidebarAccessBundle } = loadSidebarAction()
    const result = await getSidebarAccessBundle(ORG_ID)
    allTrue(result.permissions)
    assert.equal(result.assistantsCanOpen, false)
    assert.equal(result.assistantsCanManage, false)
  })
})
