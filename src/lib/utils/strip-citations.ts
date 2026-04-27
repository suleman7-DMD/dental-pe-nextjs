/**
 * stripCitations — remove AI citation markup from qualitative intel text.
 *
 * The Claude API emits <cite index="N-M">...content...</cite> markers in
 * long-form text responses (demand_outlook, supply_outlook, investment_thesis,
 * etc.). These are stored verbatim in `zip_qualitative_intel` and must be
 * stripped before rendering so users never see raw HTML-tag strings.
 *
 * Rules:
 *   - <cite ...> opening tags (any attributes) are removed
 *   - </cite> closing tags are removed
 *   - The text content between the tags is PRESERVED (it contains the actual data)
 *   - null / undefined / empty string pass through unchanged
 *
 * Examples:
 *   '<cite index="3-9">rates 5.84%</cite>' -> 'rates 5.84%'
 *   'text <cite index="1">A</cite> and <cite index="2">B</cite>' -> 'text A and B'
 *   'no cites here' -> 'no cites here'
 *   null -> null
 *   '' -> ''
 */
export function stripCitations(text: string): string
export function stripCitations(text: string | null): string | null
export function stripCitations(text: string | null | undefined): string | null | undefined
export function stripCitations(text: string | null | undefined): string | null | undefined {
  if (text == null || text === '') return text
  return text.replace(/<cite\s[^>]*>/gi, '').replace(/<\/cite>/gi, '')
}
