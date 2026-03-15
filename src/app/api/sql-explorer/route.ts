import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const FORBIDDEN_KEYWORDS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'EXEC',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const query = (body.query ?? '').trim()

    if (!query) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 })
    }

    // Validate: must start with SELECT
    if (!query.toUpperCase().startsWith('SELECT')) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed.' },
        { status: 400 }
      )
    }

    // Validate: must not contain forbidden keywords
    const upper = query.toUpperCase()
    for (const kw of FORBIDDEN_KEYWORDS) {
      // Use word boundary check to avoid false positives
      // e.g. "SELECT deleted_at" should not be blocked by "DELETE"
      const regex = new RegExp(`\\b${kw}\\b`)
      if (regex.test(upper)) {
        return NextResponse.json(
          { error: `Query contains forbidden keyword: ${kw}. Only SELECT queries are allowed.` },
          { status: 400 }
        )
      }
    }

    // Execute query using Supabase's rpc or direct Postgres connection
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    // Use Supabase's built-in RPC for executing raw SQL
    // This requires a Postgres function. We'll use a simpler approach:
    // attempt to use the `rpc` call with a function named `execute_sql`.
    // If that doesn't exist, we fall back to the Supabase REST approach.
    const { data, error } = await supabase.rpc('execute_sql', {
      query_text: query,
    })

    if (error) {
      // If the function doesn't exist, provide helpful error
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            error:
              'SQL Explorer requires a Postgres function "execute_sql". ' +
              'Create it with: CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT) ' +
              'RETURNS JSON AS $$ BEGIN RETURN (SELECT json_agg(row_to_json(t)) ' +
              'FROM (SELECT * FROM json_populate_recordset(null, query_text)) t); END; $$ ' +
              'LANGUAGE plpgsql SECURITY DEFINER;',
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Parse results
    const rows = Array.isArray(data) ? data : data ? [data] : []
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    return NextResponse.json({
      columns,
      rows,
      rowCount: rows.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
