import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAdminToken } from '@/lib/auth/admin-token'

export async function POST(req: NextRequest) {
  try {
    const authFailure = requireAdminToken(req)
    if (authFailure) return authFailure

    const body = await req.json()

    const zipCode = body.zip_code?.trim()
    if (!zipCode || zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json(
        { error: 'Valid 5-digit ZIP code is required.' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Check if ZIP already exists
    const { data: existing } = await supabase
      .from('watched_zips')
      .select('zip_code')
      .eq('zip_code', zipCode)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `ZIP ${zipCode} is already on the watch list.` },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('watched_zips')
      .insert({
        zip_code: zipCode,
        city: body.city || null,
        state: body.state || null,
        metro_area: body.metro_area || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, watchedZip: data })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
