/**
 * Shared feature-name mapping and batch resolution used by sidebar access.
 * Mirrors hasFeaturePermission semantics (deny defaults, owner/admin all-true,
 * emails → email).
 */

const FEATURE_NAME_MAP: Record<string, string> = {
  emails: 'email',
}

export type PermissionRow = {
  feature: string
  has_access: boolean | null
}

export function normalizeFeatureName(feature: string): string {
  return FEATURE_NAME_MAP[feature] || feature
}

export type FeatureAccessFetchOutcome = {
  authenticated: boolean
  memberRole: string | null
  membershipQueryFailed?: boolean
  permissionsQueryFailed?: boolean
  permissionRows?: PermissionRow[] | null
}

/**
 * Build a feature→boolean map with the same semantics as calling
 * hasFeaturePermission once per feature name.
 */
export function resolveFeatureAccessBundle(
  features: readonly string[],
  outcome: FeatureAccessFetchOutcome
): Record<string, boolean> {
  const denyAll = (): Record<string, boolean> =>
    Object.fromEntries(features.map((f) => [f, false]))

  if (!outcome.authenticated) return denyAll()
  if (outcome.membershipQueryFailed) return denyAll()
  if (!outcome.memberRole) return denyAll()

  if (outcome.memberRole === 'owner' || outcome.memberRole === 'admin') {
    return Object.fromEntries(features.map((f) => [f, true]))
  }

  if (outcome.permissionsQueryFailed) return denyAll()

  const byDbFeature = new Map<string, boolean>()
  for (const row of outcome.permissionRows ?? []) {
    // Same truthiness as hasFeaturePermission: permission?.has_access || false
    byDbFeature.set(row.feature, Boolean(row.has_access))
  }

  return Object.fromEntries(
    features.map((feature) => {
      const dbName = normalizeFeatureName(feature)
      return [feature, byDbFeature.get(dbName) === true]
    })
  )
}
