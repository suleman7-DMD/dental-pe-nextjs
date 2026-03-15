'use client'

import { useMemo, useEffect, useRef } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { MapContainer } from '@/components/maps/map-container'
import { DataTable } from '@/components/data-display/data-table'
import type { Deal } from '@/lib/supabase/queries/deals'

interface StateChoroplethProps {
  deals: Deal[]
}

// US state FIPS codes for GeoJSON matching
const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10',
  DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19',
  KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27',
  MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35',
  NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44',
  SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53',
  WV: '54', WI: '55', WY: '56',
}

export function StateChoropleth({ deals }: StateChoroplethProps) {
  const mapRef = useRef<HTMLDivElement>(null)

  const stateDeals = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of deals) {
      if (d.target_state) {
        counts.set(d.target_state, (counts.get(d.target_state) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([state, count]) => ({ state, deals: count }))
  }, [deals])

  const top15 = useMemo(() => stateDeals.slice(0, 15), [stateDeals])

  const maxDeals = useMemo(() => {
    if (stateDeals.length === 0) return 1
    return stateDeals[0].deals
  }, [stateDeals])

  // Mapbox choropleth
  useEffect(() => {
    if (!mapRef.current || stateDeals.length === 0) return

    let map: mapboxgl.Map | null = null

    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      await import('mapbox-gl/dist/mapbox-gl.css')

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

      map = new mapboxgl.Map({
        container: mapRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-98.5, 39.8],
        zoom: 3.5,
        attributionControl: false,
        interactive: true,
      })

      map.on('load', () => {
        if (!map) return

        // Build state-level deal counts expression
        const stateMap = new Map(stateDeals.map(s => [STATE_FIPS[s.state], s.deals]))

        // Add US states source
        map.addSource('states', {
          type: 'vector',
          url: 'mapbox://mapbox.boundaries-adm1-v4',
        })

        // Create a match expression for fill color
        const colorExpression: mapboxgl.Expression = [
          'interpolate',
          ['linear'],
          ['coalesce',
            ['match',
              ['get', 'iso_3166_1_alpha_2'],
              ...stateDeals.flatMap(s => [`US-${s.state}`, s.deals]),
              0
            ],
            0
          ],
          0, '#E3F2FD',
          Math.max(1, maxDeals * 0.25), '#64B5F6',
          Math.max(2, maxDeals * 0.5), '#1976D2',
          Math.max(3, maxDeals), '#0D47A1',
        ]

        map.addLayer({
          id: 'state-fills',
          type: 'fill',
          source: 'states',
          'source-layer': 'boundaries_admin_1',
          filter: ['==', ['get', 'iso_3166_1'], 'US'],
          paint: {
            'fill-color': colorExpression,
            'fill-opacity': 0.7,
          },
        })

        map.addLayer({
          id: 'state-borders',
          type: 'line',
          source: 'states',
          'source-layer': 'boundaries_admin_1',
          filter: ['==', ['get', 'iso_3166_1'], 'US'],
          paint: {
            'line-color': '#ffffff',
            'line-width': 0.5,
          },
        })

        // Hover tooltip
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
        })

        map.on('mousemove', 'state-fills', e => {
          if (!map || !e.features || e.features.length === 0) return
          map.getCanvas().style.cursor = 'pointer'
          const stateCode = e.features[0].properties?.iso_3166_1_alpha_2?.replace('US-', '')
          const dealCount = stateDeals.find(s => s.state === stateCode)?.deals ?? 0

          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-family:system-ui;font-size:12px">
                <strong>${stateCode ?? 'Unknown'}</strong>: ${dealCount} deal${dealCount !== 1 ? 's' : ''}
              </div>`
            )
            .addTo(map)
        })

        map.on('mouseleave', 'state-fills', () => {
          if (!map) return
          map.getCanvas().style.cursor = ''
          popup.remove()
        })
      })
    }

    init()

    return () => {
      if (map) map.remove()
    }
  }, [stateDeals, maxDeals])

  if (stateDeals.length === 0) return null

  const tableColumns = [
    { key: 'state', header: 'State' },
    { key: 'deals', header: 'Deals', align: 'right' as const },
  ]

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Map */}
        <div className="md:col-span-2">
          <SectionHeader
            title="Deal Activity by State"
            helpText="Geographic heatmap of PE deal activity. Darker blue = more deals. States with heavy activity (FL, TX, CA) are consolidation hotspots."
          />
          <div className="mt-4">
            <MapContainer height={400}>
              <div ref={mapRef} className="w-full h-full" />
            </MapContainer>
          </div>
        </div>

        {/* Top States table */}
        <div>
          <SectionHeader
            title="Top States"
            helpText="States ranked by total PE deal count. These are the most active acquisition markets."
          />
          <div className="mt-4">
            <DataTable
              data={top15 as unknown as Record<string, unknown>[]}
              columns={tableColumns}
              defaultSort="deals"
              defaultSortDir="desc"
              rowKey={(row) => String(row.state)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
