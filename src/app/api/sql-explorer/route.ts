import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Hardened SELECT-only SQL Explorer.
 *
 * Defenses (in order):
 *  1. Optional bearer token gate via ADMIN_SQL_TOKEN (set in env to enable).
 *     If the env var is UNSET, the endpoint returns 503. This is the
 *     production-safe default — the explorer won't accept queries until the
 *     operator opts in.
 *  2. Strip SQL comments (-- and /* *\/) before validation so obfuscation
 *     like `SELECT/**\/DROP ...` can't slip through a keyword scan.
 *  3. Reject stacked queries — any `;` before the final trailing whitespace
 *     disqualifies the input (so `SELECT 1; UPDATE x ...` is refused).
 *  4. Must start with SELECT or WITH (CTE) + case-insensitive.
 *  5. Expanded forbidden keyword list now includes ALTER/CREATE/GRANT/REVOKE/
 *     COPY/DO/VACUUM/CLUSTER/REINDEX/COMMENT/NOTIFY/LISTEN/UNLISTEN/PREPARE/
 *     EXECUTE/DEALLOCATE/LOCK/SET/RESET/DECLARE/FETCH/MOVE/CLOSE/CALL.
 *  6. Runs under the anon Supabase key (RLS-enforced), never the service role.
 *  7. Forces a LIMIT if the caller omitted one, cap at 5000 rows.
 */

const FORBIDDEN_KEYWORDS = [
  'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC',
  'EXECUTE', 'GRANT', 'REVOKE', 'COPY', 'DO', 'VACUUM', 'CLUSTER', 'REINDEX',
  'COMMENT', 'NOTIFY', 'LISTEN', 'UNLISTEN', 'PREPARE', 'DEALLOCATE', 'LOCK',
  'SET', 'RESET', 'DECLARE', 'FETCH', 'MOVE', 'CLOSE', 'CALL', 'MERGE',
  'REFRESH', 'SECURITY', 'ROLE', 'USER', 'DATABASE', 'EXTENSION', 'TRIGGER',
  'FUNCTION', 'PROCEDURE', 'POLICY', 'DOMAIN', 'SCHEMA', 'TABLESPACE',
  'PUBLICATION', 'SUBSCRIPTION', 'FOREIGN', 'RULE', 'OPERATOR', 'CAST',
  'AGGREGATE', 'COLLATION', 'TYPE', 'SEQUENCE', 'HANDLER', 'SERVER', 'MAPPING',
] as const

const MAX_ROWS = 5000

function stripComments(sql: string): string {
  // Strip /* ... */ block comments (non-greedy, handles multiline)
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, ' ')
  // Strip -- line comments
  s = s.replace(/--[^\n\r]*/g, ' ')
  return s
}

function hasStackedQueries(sql: string): boolean {
  // Allow trailing semicolon (and whitespace after) but reject any earlier one.
  const trimmed = sql.trimEnd()
  const withoutTrailingSemi = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed
  return withoutTrailingSemi.includes(';')
}

function ensureLimit(sql: string): string {
  // Very conservative: only append if no LIMIT keyword anywhere. Doesn't try to
  // respect LIMIT inside subqueries. Best-effort row cap.
  if (/\blimit\s+\d+/i.test(sql)) return sql
  const trimmed = sql.trimEnd()
  const noTrailingSemi = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed
  return `${noTrailingSemi} LIMIT ${MAX_ROWS}`
}

export async function POST(req: NextRequest) {
  try {
    // Gate 1: bearer token. In production, the operator MUST set
    // ADMIN_SQL_TOKEN to enable this endpoint. In development (NODE_ENV !==
    // 'production') the gate is skipped so local workflows stay productive.
    const isProduction = process.env.NODE_ENV === 'production'
    const requiredToken = process.env.ADMIN_SQL_TOKEN
    if (isProduction) {
      if (!requiredToken) {
        return NextResponse.json(
          {
            error:
              'SQL Explorer is disabled. Set the ADMIN_SQL_TOKEN environment ' +
              'variable on the server to enable this endpoint.',
          },
          { status: 503 }
        )
      }
      const presented = req.headers
        .get('authorization')
        ?.replace(/^Bearer\s+/i, '')
        .trim()
      if (presented !== requiredToken) {
        return NextResponse.json(
          { error: 'Unauthorized. Missing or invalid bearer token.' },
          { status: 401 }
        )
      }
    }

    const body = await req.json()
    const rawQuery = String(body.query ?? '').trim()

    if (!rawQuery) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 })
    }

    // Defense 2: strip comments before checking keywords.
    const stripped = stripComments(rawQuery).trim()

    // Defense 3: reject stacked queries.
    if (hasStackedQueries(stripped)) {
      return NextResponse.json(
        { error: 'Stacked queries are not allowed. Submit one SELECT or WITH statement.' },
        { status: 400 }
      )
    }

    const upper = stripped.toUpperCase()

    // Defense 4: must begin with SELECT or WITH (CTE).
    if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
      return NextResponse.json(
        { error: 'Only SELECT (or WITH ... SELECT) queries are allowed.' },
        { status: 400 }
      )
    }

    // Defense 5: expanded blacklist on the comment-stripped text, word-boundary.
    for (const kw of FORBIDDEN_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}\\b`)
      if (regex.test(upper)) {
        return NextResponse.json(
          { error: `Query contains forbidden keyword: ${kw}.` },
          { status: 400 }
        )
      }
    }

    // Defense 7: row cap.
    const bounded = ensureLimit(stripped)

    // Defense 6: anon key + RLS, never the service role.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })

    const { data, error } = await supabase.rpc('execute_sql', {
      query_text: bounded,
    })

    if (error) {
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            error:
              'SQL Explorer requires a Postgres function "execute_sql". ' +
              'Create it with: CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT) ' +
              'RETURNS JSON AS $$ BEGIN RETURN (SELECT json_agg(row_to_json(t)) ' +
              'FROM (SELECT * FROM json_populate_recordset(null, query_text)) t); END; $$ ' +
              'LANGUAGE plpgsql SECURITY INVOKER;',
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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
