import type { SupabaseClient } from '@supabase/supabase-js'

export interface PracticeChange {
  change_date: string | null
  practice_name: string | null
  city: string | null
  zip: string | null
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  change_type: string | null
}

/**
 * Fetch recent practice changes for the given ZIP codes.
 * Joins practice_changes with practices to get practice_name, city, zip.
 */
export async function getRecentChanges(
  supabase: SupabaseClient,
  zipCodes: string[],
  limit = 50
): Promise<PracticeChange[]> {
  if (zipCodes.length === 0) return []

  // Supabase doesn't support cross-table joins easily in the REST API,
  // so we use an RPC or a view. For now, we'll query practice_changes
  // and then enrich with practice data.
  const { data: changes, error } = await supabase
    .from('practice_changes')
    .select(`
      change_date,
      field_changed,
      old_value,
      new_value,
      change_type,
      npi
    `)
    .order('change_date', { ascending: false })
    .limit(limit * 3) // over-fetch since we'll filter by ZIP

  if (error || !changes || changes.length === 0) return []

  // Get unique NPIs from changes
  const npis = [...new Set(changes.map(c => c.npi))]

  // Fetch practice info for those NPIs
  const { data: practices } = await supabase
    .from('practices')
    .select('npi, practice_name, city, zip')
    .in('npi', npis)
    .in('zip', zipCodes)

  if (!practices || practices.length === 0) return []

  const practiceMap = new Map(practices.map(p => [p.npi, p]))
  const zipSet = new Set(zipCodes)

  const results: PracticeChange[] = []
  for (const c of changes) {
    const p = practiceMap.get(c.npi)
    if (p && zipSet.has(p.zip)) {
      results.push({
        change_date: c.change_date,
        practice_name: p.practice_name,
        city: p.city,
        zip: p.zip,
        field_changed: c.field_changed,
        old_value: c.old_value,
        new_value: c.new_value,
        change_type: c.change_type,
      })
    }
    if (results.length >= limit) break
  }

  return results
}
