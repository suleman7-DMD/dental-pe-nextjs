import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_FIELDS = new Set([
  'practice_name',
  'owner_doctor_or_group',
  'operating_doctors',
  'provider_count',
  'employee_count',
  'website',
  'general_note',
])

const FIELD_LABELS: Record<string, string> = {
  practice_name: 'Practice name',
  owner_doctor_or_group: 'Owner doctor / group',
  operating_doctors: 'Operating doctors',
  provider_count: 'Provider count',
  employee_count: 'Employee count',
  website: 'Website',
  general_note: 'General note',
}

function cleanText(value: unknown, max = 1200): string | null {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, max)
}

function cleanUrl(value: unknown): string | null {
  const text = cleanText(value, 500)
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const locationId = cleanText(body.location_id, 80)
    if (!locationId) {
      return NextResponse.json({ error: 'location_id is required.' }, { status: 400 })
    }

    const corrections = body.corrections
    if (!corrections || typeof corrections !== 'object' || Array.isArray(corrections)) {
      return NextResponse.json({ error: 'corrections object is required.' }, { status: 400 })
    }

    const oldValues =
      body.old_values && typeof body.old_values === 'object' && !Array.isArray(body.old_values)
        ? (body.old_values as Record<string, unknown>)
        : {}

    const sourceUrl = cleanUrl(body.source_url)
    const notes = cleanText(body.notes, 1500)
    const practiceName = cleanText(body.practice_name, 300)
    const submittedBy = cleanText(body.submitted_by, 120) ?? 'live_app'
    const npi = cleanText(body.npi, 40)

    const rows = Object.entries(corrections as Record<string, unknown>)
      .map(([fieldKey, value]) => {
        if (!ALLOWED_FIELDS.has(fieldKey)) return null
        const suggested = cleanText(value, fieldKey === 'general_note' ? 1500 : 800)
        if (!suggested) return null
        return {
          location_id: locationId,
          npi,
          practice_name: practiceName,
          field_key: fieldKey,
          old_value: cleanText(oldValues[fieldKey], 800),
          suggested_value: suggested,
          source_url: sourceUrl,
          notes,
          submitted_by: submittedBy,
          status: 'queued',
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No supported correction fields were provided.' },
        { status: 400 },
      )
    }

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('practice_manual_corrections')
      .insert(rows)
      .select('id, field_key, created_at')

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          fallback:
            'The correction was not written to Supabase. The UI can still save it locally for later review.',
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      queued: (data ?? []).map((row) => ({
        id: row.id,
        field: FIELD_LABELS[row.field_key] ?? row.field_key,
        created_at: row.created_at,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}
