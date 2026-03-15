'use client'

import { useMemo, useState, useEffect } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { KpiCard } from '@/components/data-display/kpi-card'
import { DataTable } from '@/components/data-display/data-table'
import { ScatterChart } from '@/components/charts/scatter-chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isIndependentClassification, isCorporateClassification } from '@/lib/constants/entity-classifications'
import { ENTITY_CLASSIFICATION_COLORS } from '@/lib/constants/colors'
import { getEntityClassificationLabel } from '@/lib/constants/entity-classifications'
import { formatStatusLabel } from '@/lib/utils/formatting'
import { createBrowserClient } from '@/lib/supabase/client'

import type { Practice } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface OpportunitySignalsProps {
  practices: Practice[]  // with job_opp_score computed
  zipList: string[]
}

interface PracticeChange {
  change_date: string
  practice_name: string
  city: string
  zip: string
  field_changed: string
  old_value: string
  new_value: string
  change_type: string
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function OpportunitySignals({ practices, zipList }: OpportunitySignalsProps) {
  const [changes, setChanges] = useState<PracticeChange[]>([])
  const [changesLoading, setChangesLoading] = useState(false)

  const currentYear = new Date().getFullYear()

  // ── Retirement Risk ───────────────────────────────────────────────────
  const retirementData = useMemo(() => {
    return practices.filter((p) => {
      const yr = p.year_established != null ? Number(p.year_established) : NaN
      const isIndep = isIndependentClassification(p.entity_classification) ||
        (!p.entity_classification && ['independent', 'likely_independent'].includes(
          (p.ownership_status ?? 'unknown').trim().toLowerCase()
        ))
      return !isNaN(yr) && yr > 0 && yr <= currentYear - 30 && isIndep
    }).map((p) => ({
      ...p,
      practice_age: currentYear - Number(p.year_established),
    }))
  }, [practices, currentYear])

  const retireKpis = useMemo(() => {
    const count = retirementData.length
    const avgAge =
      count > 0
        ? retirementData.reduce((s, r) => s + r.practice_age, 0) / count
        : 0
    const buyScores = retirementData
      .map((r) => (r.buyability_score != null ? Number(r.buyability_score) : NaN))
      .filter((v) => !isNaN(v))
    const avgBuy =
      buyScores.length > 0
        ? buyScores.reduce((a, b) => a + b, 0) / buyScores.length
        : NaN

    return {
      count,
      avgAge: avgAge > 0 ? `${avgAge.toFixed(0)} yrs` : '--',
      avgBuy: !isNaN(avgBuy) ? avgBuy.toFixed(0) : '--',
    }
  }, [retirementData])

  const retirementTableData = useMemo(
    () =>
      [...retirementData]
        .sort(
          (a, b) =>
            (Number(a.year_established) || 9999) - (Number(b.year_established) || 9999)
        )
        .slice(0, 100),
    [retirementData]
  )

  // ── High Buyability ───────────────────────────────────────────────────
  const highBuyData = useMemo(() => {
    return practices.filter(
      (p) => p.buyability_score != null && Number(p.buyability_score) >= 60
    )
  }, [practices])

  const scatterData = useMemo(() => {
    return highBuyData
      .filter(
        (p) =>
          p.buyability_score != null &&
          p.employee_count != null &&
          Number(p.employee_count) > 0
      )
      .map((p) => {
        const ec = (p.entity_classification ?? '').trim().toLowerCase() || 'unknown'
        return {
          x: Number(p.buyability_score),
          y: Number(p.employee_count),
          label: p.practice_name ?? 'Unknown',
          group: getEntityClassificationLabel(ec),
          color: ENTITY_CLASSIFICATION_COLORS[ec as keyof typeof ENTITY_CLASSIFICATION_COLORS] ?? '#64748B',
          tooltip: `${p.practice_name ?? 'Unknown'}\n${p.city ?? ''}\nBuyability: ${Number(p.buyability_score).toFixed(0)}`,
        }
      })
  }, [highBuyData])

  const highBuyTableData = useMemo(
    () =>
      [...highBuyData]
        .sort(
          (a, b) => (Number(b.buyability_score) || 0) - (Number(a.buyability_score) || 0)
        )
        .slice(0, 100),
    [highBuyData]
  )

  // ── Recent Changes ────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchChanges() {
      if (zipList.length === 0) return
      setChangesLoading(true)

      try {
        const supabase = createBrowserClient()
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 180)
        const cutoff = cutoffDate.toISOString().slice(0, 10)

        // Fetch changes with practice join
        // Supabase doesn't support arbitrary JOINs, so we fetch changes
        // and match with practices client-side, or use an RPC/view.
        // For simplicity, fetch changes where npi is in our practice set.
        const npiSet = new Set(practices.map((p) => p.npi))

        // Batch fetch to avoid URL length limits
        const batchSize = 500
        const allChanges: PracticeChange[] = []
        const npiArr = Array.from(npiSet)

        for (let i = 0; i < npiArr.length; i += batchSize) {
          const batch = npiArr.slice(i, i + batchSize)
          const { data } = await supabase
            .from('practice_changes')
            .select('change_date, field_changed, old_value, new_value, change_type, npi')
            .in('npi', batch)
            .gte('change_date', cutoff)
            .order('change_date', { ascending: false })

          if (data) {
            // Enrich with practice info
            const practiceMap = new Map(practices.map((p) => [p.npi, p]))
            for (const row of data) {
              const practice = practiceMap.get(row.npi)
              allChanges.push({
                change_date: row.change_date,
                practice_name: practice?.practice_name ?? 'Unknown',
                city: practice?.city ?? '',
                zip: (practice?.zip ?? '').toString().slice(0, 5),
                field_changed: row.field_changed,
                old_value: row.old_value,
                new_value: row.new_value,
                change_type: row.change_type,
              })
            }
          }
        }

        setChanges(allChanges)
      } catch {
        // Silently handle - changes data is supplementary
        setChanges([])
      } finally {
        setChangesLoading(false)
      }
    }

    fetchChanges()
  }, [zipList, practices])

  const changeKpis = useMemo(() => {
    const total = changes.length
    const nameChg = changes.filter((c) => c.change_type === 'name_change').length
    const addrChg = changes.filter((c) => c.change_type === 'relocation').length
    const ownChg = changes.filter((c) => c.change_type === 'acquisition').length
    return { total, nameChg, addrChg, ownChg }
  }, [changes])

  return (
    <div>
      <SectionHeader
        title="Opportunity Signals"
        helpText="Each practice scored 0-100: independent ownership (30), buyability (25), size (20), young practice (15), unknown status (10)."
      />

      <Tabs defaultValue="retirement" className="mt-4">
        <TabsList className="bg-[#0F1629] border border-[#1E293B]">
          <TabsTrigger value="retirement">Retirement Risk</TabsTrigger>
          <TabsTrigger value="buyability">High Buyability</TabsTrigger>
          <TabsTrigger value="changes">Recent Changes</TabsTrigger>
        </TabsList>

        {/* ── Retirement Risk ──────────────────────────────────────────── */}
        <TabsContent value="retirement">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <KpiCard
              icon="clock"
              label="At-Risk Practices"
              value={retireKpis.count.toLocaleString()}
            />
            <KpiCard
              icon="calendar"
              label="Avg Practice Age"
              value={retireKpis.avgAge}
            />
            <KpiCard
              icon="target"
              label="Avg Buyability"
              value={retireKpis.avgBuy}
            />
          </div>

          {retirementData.length === 0 ? (
            <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
              No independent practices with 30+ years of operation found in these ZIPs.
            </div>
          ) : (
            <DataTable
              data={retirementTableData}
              columns={[
                { key: 'practice_name', header: 'Practice Name' },
                { key: 'city', header: 'City' },
                {
                  key: 'zip',
                  header: 'ZIP',
                  render: (v: string) => (v ?? '').toString().slice(0, 5),
                },
                {
                  key: 'year_established',
                  header: 'Year Est.',
                  render: (v: number | null) =>
                    v != null ? Math.floor(Number(v)).toString() : '--',
                },
                {
                  key: 'practice_age',
                  header: 'Age',
                  render: (v: number) => `${v} yrs`,
                },
                {
                  key: 'buyability_score',
                  header: 'Buyability',
                  render: (v: number | null) =>
                    v != null ? Number(v).toFixed(0) : '--',
                },
                {
                  key: 'employee_count',
                  header: 'Employees',
                  render: (v: number | null) => v ?? '--',
                },
              ]}
              rowKey="npi"
            />
          )}
        </TabsContent>

        {/* ── High Buyability ──────────────────────────────────────────── */}
        <TabsContent value="buyability">
          {highBuyData.length === 0 ? (
            <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
              No practices with buyability score &gt;= 60 found in these ZIPs.
            </div>
          ) : (
            <>
              {scatterData.length > 0 && (
                <div className="mb-4">
                  <ScatterChart
                    data={scatterData}
                    xAxisLabel="Buyability Score"
                    yAxisLabel="Employee Count"
                    height={420}
                    groups={[
                      { label: 'Solo Established', color: '#22C55E' },
                      { label: 'Solo High Volume', color: '#2E7D32' },
                      { label: 'Family Practice', color: '#FF9800' },
                      { label: 'Small Group', color: '#42A5F5' },
                      { label: 'DSO Regional', color: '#FFA726' },
                      { label: 'DSO National', color: '#EF4444' },
                      { label: 'Unknown', color: '#64748B' },
                    ]}
                  />
                </div>
              )}

              <DataTable
                data={highBuyTableData}
                columns={[
                  { key: 'practice_name', header: 'Practice Name' },
                  { key: 'city', header: 'City' },
                  {
                    key: 'zip',
                    header: 'ZIP',
                    render: (v: string) => (v ?? '').toString().slice(0, 5),
                  },
                  {
                    key: 'ownership_status',
                    header: 'Status',
                    render: (v: string) => formatStatusLabel(v),
                  },
                  {
                    key: 'buyability_score',
                    header: 'Buyability',
                    render: (v: number | null) =>
                      v != null ? Number(v).toFixed(0) : '--',
                  },
                  {
                    key: 'employee_count',
                    header: 'Employees',
                    render: (v: number | null) => v ?? '--',
                  },
                  {
                    key: 'estimated_revenue',
                    header: 'Est. Revenue',
                    render: (v: number | null) =>
                      v != null ? `$${Number(v).toLocaleString()}` : '--',
                  },
                  {
                    key: 'job_opp_score',
                    header: 'Job Score',
                    render: (v: number | null) => v ?? '--',
                  },
                ]}
                rowKey="npi"
              />
            </>
          )}
        </TabsContent>

        {/* ── Recent Changes ───────────────────────────────────────────── */}
        <TabsContent value="changes">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <KpiCard
              icon="refresh"
              label="Total Changes"
              value={changeKpis.total.toLocaleString()}
            />
            <KpiCard
              icon="edit"
              label="Name Changes"
              value={changeKpis.nameChg.toLocaleString()}
            />
            <KpiCard
              icon="map-pin"
              label="Address Changes"
              value={changeKpis.addrChg.toLocaleString()}
            />
            <KpiCard
              icon="alert-circle"
              label="Ownership Changes"
              value={changeKpis.ownChg.toLocaleString()}
              accentColor="#EF4444"
            />
          </div>

          {changesLoading ? (
            <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
              <div className="inline-block h-4 w-4 border-2 border-[#7eb8e0] border-t-transparent rounded-full animate-spin mr-2" />
              Loading recent changes...
            </div>
          ) : changes.length === 0 ? (
            <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
              No practice changes detected in the last 180 days for these ZIPs.
            </div>
          ) : (
            <DataTable
              data={changes}
              columns={[
                { key: 'practice_name', header: 'Practice Name' },
                {
                  key: 'change_type',
                  header: 'Change Type',
                  render: (v: string) =>
                    (v ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                },
                { key: 'old_value', header: 'Old Value', render: (v: string) => v || '--' },
                { key: 'new_value', header: 'New Value', render: (v: string) => v || '--' },
                { key: 'change_date', header: 'Date' },
              ]}
              rowKey={(row, i) => `${row.change_date}-${row.practice_name}-${i}`}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
