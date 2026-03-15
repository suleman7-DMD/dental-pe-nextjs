import type { SupabaseClient } from '@supabase/supabase-js'

export interface ADABenchmark {
  id: number
  state: string
  career_stage: string
  pct_dso_affiliated: number
  data_year: number | string
}

export async function getADABenchmarks(supabase: SupabaseClient): Promise<ADABenchmark[]> {
  // Paginate to handle 918+ rows (approaching Supabase 1000-row default limit)
  const allRows: ADABenchmark[] = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('ada_hpi_benchmarks')
      .select('*')
      .order('state', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('Error fetching ADA benchmarks:', error)
      return allRows
    }

    const batch = (data ?? []) as ADABenchmark[]
    allRows.push(...batch)
    if (batch.length < pageSize) break
    offset += batch.length
  }

  return allRows
}
