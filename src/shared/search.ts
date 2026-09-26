import type { LeadCandidate, SearchConfig, SearchSession } from './types'
import { GitsError } from './errors'

export const defaultConfig: SearchConfig = {
  niche: '',
  location: '',
  keywords: [],
  targetLeadCount: 50,
  filters: {
    withoutWebsite: false,
    activeBusiness: true,
    fewReviews: false,
    incompleteProfile: false,
    withoutPhone: false,
  },
  decisionLimit: 100,
  engine: 'jev',
}
export function validateConfig(config: SearchConfig) {
  if (
    !config
    || typeof config.niche !== 'string'
    || typeof config.location !== 'string'
    || !config.niche.trim()
    || !config.location.trim()
    || config.niche.length > 120
    || config.location.length > 180
    || !Array.isArray(config.keywords)
    || config.keywords.length > 8
    || config.keywords.some(k => typeof k !== 'string' || k.length > 80)
    || !Number.isInteger(config.targetLeadCount)
    || config.targetLeadCount < 1
    || config.targetLeadCount > 50
    || !Number.isInteger(config.decisionLimit)
    || config.decisionLimit < 1
    || config.decisionLimit > 1000
    || !['jev', 'mock'].includes(config.engine)
    || !config.filters
    || typeof config.filters.withoutWebsite !== 'boolean'
    || typeof config.filters.activeBusiness !== 'boolean'
    || typeof config.filters.fewReviews !== 'boolean'
    || typeof config.filters.incompleteProfile !== 'boolean'
    || typeof config.filters.withoutPhone !== 'boolean'
    || (config.filters.minimumRating !== undefined
      && (!Number.isFinite(config.filters.minimumRating)
        || config.filters.minimumRating < 0
        || config.filters.minimumRating > 5))
  ) {
    throw new GitsError(
      'invalid_config',
      'Enter a niche, location, valid lead target (1–50), and decision limit (1–1000).',
    )
  }
}
export function createSession(config: SearchConfig): SearchSession {
  validateConfig(config)
  const queries = [
    ...new Set(
      ['', ...config.keywords, 'terdekat', 'sekitar', 'terbaik', 'rekomendasi']
        .map(keyword => `${config.niche} ${keyword.trim()} ${config.location}`.replace(/\s+/g, ' ').trim()),
    ),
  ].slice(0, 5)
  return {
    ...structuredClone(config),
    id: crypto.randomUUID(),
    controlVersion: 0,
    status: 'running',
    phase: 'searching',
    queries,
    queryIndex: 0,
    pending: [],
    seen: [],
    leads: [],
    activity: [],
    analyzedCount: 0,
    qualifiedCount: 0,
    jevDecisionCount: 0,
    mockDecisionCount: 0,
    emptyScrolls: 0,
    cache: {},
    message: 'Preparing Google Maps…',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
export function filterCandidate(
  candidate: LeadCandidate,
  config: SearchConfig,
  seen: string[],
): string | null {
  if (!candidate.id || !candidate.name.trim())
    return 'Incomplete business record'
  if (seen.includes(candidate.id))
    return 'Duplicate business'
  if (config.filters.withoutWebsite && candidate.website)
    return 'Website listed'
  if (config.filters.withoutWebsite && candidate.website === undefined)
    return 'Website status could not be verified'
  if (
    config.filters.fewReviews
    && candidate.reviewCount !== undefined && candidate.reviewCount > 10
  ) {
    return 'More than 10 reviews'
  }
  if (
    config.filters.incompleteProfile
    && candidate.category
    && candidate.address
    && candidate.rating !== undefined
    && candidate.reviewCount !== undefined
  ) {
    return 'Google Maps profile is complete'
  }
  if (config.filters.withoutPhone && candidate.phone)
    return 'Phone listed'
  if (
    config.filters.minimumRating !== undefined
    && (candidate.rating === undefined
      || candidate.rating < config.filters.minimumRating)
  ) {
    return 'Below minimum rating or rating unavailable'
  }
  if (config.filters.activeBusiness && candidate.businessStatus !== 'active') {
    return candidate.businessStatus === 'closed'
      ? 'Business marked closed'
      : 'Business activity could not be verified'
  }
  return null
}

export function unverifiedFilters(candidate: LeadCandidate, config: SearchConfig): string | null {
  if (config.filters.fewReviews && candidate.reviewCount === undefined)
    return 'Review count unavailable; cannot verify the 10-review limit'
  if (config.filters.withoutPhone && candidate.phone === undefined)
    return 'Phone status unavailable'
  return null
}
