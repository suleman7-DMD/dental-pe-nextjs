'use client'

import { useMemo, useState } from 'react'
import { Download, PencilLine } from 'lucide-react'

type CorrectionFieldKey =
  | 'practice_name'
  | 'owner_doctor_or_group'
  | 'operating_doctors'
  | 'provider_count'
  | 'employee_count'
  | 'website'
  | 'general_note'

export interface ManualCorrectionField {
  key: CorrectionFieldKey
  label: string
  currentValue: string | number | null | undefined
  placeholder?: string
  inputMode?: 'text' | 'numeric'
}

interface ManualCorrectionPanelProps {
  locationId: string | null | undefined
  npi?: string | null
  practiceName: string
  fields: ManualCorrectionField[]
  compact?: boolean
}

interface LocalCorrectionPayload {
  location_id: string
  npi: string | null
  practice_name: string
  corrections: Record<string, string>
  old_values: Record<string, string>
  source_url: string | null
  notes: string | null
  submitted_by: string
  created_at: string
  api_status: 'queued_in_supabase' | 'local_only'
  api_error?: string
}

const STORAGE_KEY = 'dental-pe-manual-corrections-v1'

function currentToString(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  return String(value)
}

function loadLocalQueue(): LocalCorrectionPayload[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalQueue(rows: LocalCorrectionPayload[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-300)))
  } catch {
    // Ignore storage failures; the API response still tells the user what happened.
  }
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ManualCorrectionPanel({
  locationId,
  npi,
  practiceName,
  fields,
  compact = false,
}: ManualCorrectionPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<LocalCorrectionPayload | null>(null)

  const oldValues = useMemo(
    () =>
      Object.fromEntries(
        fields.map((field) => [field.key, currentToString(field.currentValue)]),
      ),
    [fields],
  )

  const changed = useMemo(() => {
    const out: Record<string, string> = {}
    for (const field of fields) {
      const next = (values[field.key] ?? '').trim()
      if (!next) continue
      if (next !== currentToString(field.currentValue)) {
        out[field.key] = next
      }
    }
    return out
  }, [fields, values])

  const changedCount = Object.keys(changed).length

  async function handleSubmit() {
    if (!locationId || changedCount === 0) return
    setSaving(true)
    setMessage(null)

    const payload: LocalCorrectionPayload = {
      location_id: locationId,
      npi: npi ?? null,
      practice_name: practiceName,
      corrections: changed,
      old_values: oldValues,
      source_url: sourceUrl.trim() || null,
      notes: notes.trim() || null,
      submitted_by: 'live_app_manual_review',
      created_at: new Date().toISOString(),
      api_status: 'local_only',
    }

    try {
      const res = await fetch('/api/practice-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        payload.api_status = 'queued_in_supabase'
        setMessage(`Queued ${changedCount} correction${changedCount === 1 ? '' : 's'} for review.`)
      } else {
        payload.api_error = json.error ?? `HTTP ${res.status}`
        setMessage('Saved locally. Supabase queue is not available from this deployment yet.')
      }
    } catch (error) {
      payload.api_error = error instanceof Error ? error.message : String(error)
      setMessage('Saved locally. Network/API write did not complete.')
    } finally {
      const queue = [...loadLocalQueue(), payload]
      saveLocalQueue(queue)
      setLastPayload(payload)
      setSaving(false)
      setValues({})
      setSourceUrl('')
      setNotes('')
    }
  }

  if (!locationId) return null

  return (
    <section className={compact ? 'space-y-3' : 'rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4'}>
      <div className="flex items-start gap-2">
        <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-[#B8860B]" />
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A1A]">Suggest a correction</h3>
          <p className="mt-1 text-xs leading-5 text-[#6B6B60]">
            This queues your edit for review. It does not overwrite the census or scoring data.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[#707064]">
              {field.label}
            </span>
            <input
              value={values[field.key] ?? ''}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
              }
              inputMode={field.inputMode === 'numeric' ? 'numeric' : undefined}
              placeholder={
                field.placeholder ??
                (field.currentValue == null || field.currentValue === ''
                  ? 'Not verified yet'
                  : `Current: ${field.currentValue}`)
              }
              className="mt-1 w-full rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/15"
            />
          </label>
        ))}

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#707064]">
            Source URL
          </span>
          <input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="Paste the Our Doctors / Team / About page you checked"
            className="mt-1 w-full rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/15"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#707064]">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What did you find?"
            rows={compact ? 2 : 3}
            className="mt-1 w-full resize-y rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/15"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || changedCount === 0}
          onClick={handleSubmit}
          className="rounded-md bg-[#1A1A1A] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#3D3D35] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Saving...' : `Queue ${changedCount || ''} correction${changedCount === 1 ? '' : 's'}`}
        </button>
        {lastPayload ? (
          <button
            type="button"
            onClick={() =>
              downloadJson(lastPayload, `practice-correction-${locationId}.json`)
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E8E5DE] px-3 py-2 text-xs font-semibold text-[#6B6B60] hover:bg-[#F7F7F4]"
          >
            <Download className="h-3.5 w-3.5" />
            Download JSON
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="text-xs leading-5 text-[#6B6B60]">{message}</p>
      ) : null}
    </section>
  )
}
