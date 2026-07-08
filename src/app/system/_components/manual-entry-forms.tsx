'use client'

import { useState, useCallback } from 'react'
import { Check, AlertTriangle } from 'lucide-react'
import { US_STATES } from '@/lib/constants/us-states'

// ────────────────────────────────────────────────────────────────────────────
// Tabs
// ────────────────────────────────────────────────────────────────────────────

type FormTab = 'deal' | 'zip'

// ────────────────────────────────────────────────────────────────────────────
// Add Deal Form
// ────────────────────────────────────────────────────────────────────────────

function AddDealForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSuccess(null)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const platform = formData.get('platform_company') as string
    if (!platform?.trim()) {
      setError('Platform company is required.')
      return
    }

    const dealSizeMm = parseFloat(formData.get('deal_size_mm') as string)

    setLoading(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_date: formData.get('deal_date') || null,
          platform_company: platform.trim(),
          pe_sponsor: (formData.get('pe_sponsor') as string)?.trim() || null,
          target_name: (formData.get('target_name') as string)?.trim() || null,
          target_state: formData.get('target_state') || null,
          deal_type: formData.get('deal_type') || 'other',
          specialty: formData.get('specialty') || 'general',
          deal_size_mm: dealSizeMm > 0 ? dealSizeMm : null,
          source: formData.get('source') || 'manual',
          notes: (formData.get('notes') as string)?.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to add deal.')
      } else {
        setSuccess(`Deal added: ${platform}`)
        ;(e.target as HTMLFormElement).reset()
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Deal Date</label>
          <input
            type="date"
            name="deal_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Platform Company *</label>
          <input
            type="text"
            name="platform_company"
            required
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">PE Sponsor</label>
          <input
            type="text"
            name="pe_sponsor"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Target Name</label>
          <input
            type="text"
            name="target_name"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">State</label>
          <select
            name="target_state"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          >
            <option value="">--</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Deal Type</label>
          <select
            name="deal_type"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          >
            {['buyout', 'add-on', 'recapitalization', 'growth', 'de_novo', 'partnership', 'other'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Specialty</label>
          <select
            name="specialty"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          >
            {[
              'general', 'orthodontics', 'oral_surgery', 'endodontics',
              'periodontics', 'pediatric', 'prosthodontics', 'multi_specialty', 'other',
            ].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Deal Size ($M)</label>
          <input
            type="number"
            name="deal_size_mm"
            min="0"
            step="0.1"
            defaultValue="0"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Source</label>
        <select
          name="source"
          className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
        >
          {['manual', 'press_release', 'linkedin', 'conference', 'other'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Notes</label>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[#B8860B] px-4 py-2 text-sm font-medium text-white hover:bg-[#996F00] transition-colors disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add Deal'}
      </button>

      {success && (
        <div className="flex items-center gap-2 text-sm text-[#2D8B4E]">
          <Check className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-[#C23B3B]">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Add ZIP Form
// ────────────────────────────────────────────────────────────────────────────

function AddZipForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSuccess(null)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const zipCode = (formData.get('zip_code') as string)?.trim()

    if (!zipCode || zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
      setError('Enter a valid 5-digit ZIP code.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/watched-zips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip_code: zipCode,
          city: (formData.get('city') as string)?.trim() || null,
          state: formData.get('state') || null,
          metro_area: (formData.get('metro_area') as string)?.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to add ZIP.')
      } else {
        setSuccess(`Added ZIP ${zipCode} to watch list. Run merge_and_score.py to calculate scores.`)
        ;(e.target as HTMLFormElement).reset()
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">ZIP Code *</label>
          <input
            type="text"
            name="zip_code"
            maxLength={5}
            required
            pattern="\d{5}"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">City</label>
          <input
            type="text"
            name="city"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">State</label>
          <select
            name="state"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          >
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#6B6B60] mb-1 block uppercase tracking-wider">Metro Area</label>
          <input
            type="text"
            name="metro_area"
            placeholder="e.g., Chicagoland"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B] placeholder:text-[#8F8E82]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[#B8860B] px-4 py-2 text-sm font-medium text-white hover:bg-[#996F00] transition-colors disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add ZIP'}
      </button>

      {success && (
        <div className="flex items-center gap-2 text-sm text-[#2D8B4E]">
          <Check className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-[#C23B3B]">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function ManualEntryForms() {
  const [activeTab, setActiveTab] = useState<FormTab>('deal')

  return (
    <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-[#E8E5DE]">
        {[
          { id: 'deal' as FormTab, label: 'Add Deal' },
          { id: 'zip' as FormTab, label: 'Add ZIP to Watch' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-[#1A1A1A] bg-[#E8E5DE]/30'
                : 'text-[#6B6B60] hover:text-[#1A1A1A]'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B8860B]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'deal' && <AddDealForm />}
        {activeTab === 'zip' && <AddZipForm />}
      </div>
    </div>
  )
}
