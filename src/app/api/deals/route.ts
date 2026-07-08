import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAdminToken } from '@/lib/auth/admin-token'

export async function POST(req: NextRequest) {
  try {
    const authFailure = requireAdminToken(req)
    if (authFailure) return authFailure

    const body = await req.json()

    // Validate required fields
    if (!body.platform_company?.trim()) {
      return NextResponse.json(
        { error: 'platform_company is required.' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('deals')
      .insert({
        deal_date: body.deal_date || null,
        platform_company: body.platform_company.trim(),
        pe_sponsor: body.pe_sponsor || null,
        target_name: body.target_name || null,
        target_state: body.target_state || null,
        deal_type: body.deal_type || 'other',
        specialty: body.specialty || 'general',
        deal_size_mm: body.deal_size_mm || null,
        source: body.source || 'manual',
        notes: body.notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deal: data })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
