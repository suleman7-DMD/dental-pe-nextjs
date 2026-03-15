import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  })

  const results: Record<string, unknown> = {
    env_key_type: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? 'service_role'
      : 'anon',
  }

  // Test 1: Simple count
  try {
    const { count, error } = await supabase
      .from('practices')
      .select('*', { count: 'exact', head: true })
    results.total_practices = { count, error: error?.message ?? null }
  } catch (e) {
    results.total_practices = { exception: String(e) }
  }

  // Test 2: entity_classification filter
  try {
    const { count, error } = await supabase
      .from('practices')
      .select('*', { count: 'exact', head: true })
      .in('entity_classification', [
        'solo_established',
        'solo_new',
        'solo_inactive',
        'solo_high_volume',
        'family_practice',
        'small_group',
        'large_group',
      ])
    results.independent_count = { count, error: error?.message ?? null }
  } catch (e) {
    results.independent_count = { exception: String(e) }
  }

  // Test 3: Retirement risk (the problematic query)
  try {
    const { count, error } = await supabase
      .from('practices')
      .select('*', { count: 'exact', head: true })
      .in('entity_classification', [
        'solo_established',
        'solo_new',
        'solo_inactive',
        'solo_high_volume',
        'family_practice',
        'small_group',
        'large_group',
      ])
      .lt('year_established', 1995)
    results.retirement_risk = { count, error: error?.message ?? null }
  } catch (e) {
    results.retirement_risk = { exception: String(e) }
  }

  // Test 4: Buyability targets
  try {
    const { count, error } = await supabase
      .from('practices')
      .select('*', { count: 'exact', head: true })
      .gte('buyability_score', 50)
      .in('entity_classification', [
        'solo_established',
        'solo_new',
        'solo_inactive',
        'solo_high_volume',
        'family_practice',
        'small_group',
        'large_group',
      ])
    results.buyability_targets = { count, error: error?.message ?? null }
  } catch (e) {
    results.buyability_targets = { exception: String(e) }
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
