import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const zipCode = body.zip_code?.trim()
    if (!zipCode || zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json(
        { error: 'Valid 5-digit ZIP code is required.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

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
