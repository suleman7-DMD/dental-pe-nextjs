import type { SupabaseClient } from '@supabase/supabase-js'

export interface ADABenchmark {
  id: number
  state: string
  career_stage: string
  pct_dso_affiliated: number
  data_year: number | string
}

export async function getADABenchmarks(supabase: SupabaseClient): Promise<ADABenchmark[]> {
  const { data, error } = await supabase
    .from('ada_hpi_benchmarks')
    .select('*')
    .order('state', { ascending: true })

  if (error) {
    console.error('Error fetching ADA benchmarks:', error)
    return []
  }

  return (data ?? []) as ADABenchmark[]
}
