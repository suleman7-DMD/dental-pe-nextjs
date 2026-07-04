import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { searchPracticeLocations } from "@/lib/supabase/queries/practice-locations"

export const dynamic = "force-dynamic"

/**
 * Global practice search: name / city / ZIP → practice records.
 * Results carry the census ownership fields so the picker can render truth
 * badges (tier + PE) — never detector ownership.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  if (q.trim().length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const supabase = getSupabaseServerClient()
    const rows = await searchPracticeLocations(supabase, q, 20)
    return NextResponse.json({
      results: rows.map((row) => ({
        locationId: row.location_id,
        name: row.doing_business_as ?? row.practice_name ?? "Unnamed practice",
        address: row.normalized_address,
        city: row.city,
        zip: row.zip,
        ownershipTier: row.ownership_tier,
        peBacked: row.pe_backed,
        networkId: row.network_id,
      })),
    })
  } catch (error) {
    console.error("practice-search failed", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
