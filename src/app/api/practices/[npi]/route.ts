import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> }
) {
  try {
    const { npi } = await params
    const body = await req.json()

    if (!npi || npi.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit NPI is required.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    // First, find the current practice to get old values
    const { data: existing, error: findError } = await supabase
      .from('practices')
      .select('ownership_status, affiliated_dso, affiliated_pe_sponsor')
      .eq('npi', npi)
      .single()

    if (findError || !existing) {
      return NextResponse.json({ error: 'NPI not found.' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (body.ownership_status) {
      updates.ownership_status = body.ownership_status
    }
    if (body.affiliated_dso !== undefined) {
      updates.affiliated_dso = body.affiliated_dso
    }
    if (body.affiliated_pe_sponsor !== undefined) {
      updates.affiliated_pe_sponsor = body.affiliated_pe_sponsor
    }
    if (body.entity_classification !== undefined) {
      updates.entity_classification = body.entity_classification
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
    }

    // Update practice
    const { error: updateError } = await supabase
      .from('practices')
      .update(updates)
      .eq('npi', npi)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log to practice_changes
    if (body.ownership_status && body.ownership_status !== existing.ownership_status) {
      await supabase.from('practice_changes').insert({
        npi,
        change_date: new Date().toISOString().slice(0, 10),
        field_changed: 'ownership_status',
        old_value: existing.ownership_status,
        new_value: body.ownership_status,
        change_type: 'acquisition',
        notes: body.notes || 'Manual update via dashboard',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
