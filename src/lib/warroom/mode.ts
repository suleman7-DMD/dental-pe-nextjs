export const WARROOM_MODES = [
  { id: "hunt", label: "Hunt" },
  { id: "investigate", label: "Investigate" },
] as const

export type WarroomMode = (typeof WARROOM_MODES)[number]["id"]

export const DEFAULT_WARROOM_MODE: WarroomMode = "hunt"

export const WARROOM_LENSES = [
  { id: "consolidation", label: "Consolidation" },
  { id: "density", label: "Density" },
  { id: "buyability", label: "Buyability" },
  { id: "retirement", label: "Retirement" },
] as const

export type WarroomLens = (typeof WARROOM_LENSES)[number]["id"]

export const DEFAULT_WARROOM_LENS: WarroomLens = "consolidation"

const WARROOM_MODE_IDS: ReadonlySet<string> = new Set(
  WARROOM_MODES.map((mode) => mode.id)
)

const WARROOM_LENS_IDS: ReadonlySet<string> = new Set(
  WARROOM_LENSES.map((lens) => lens.id)
)

export function isWarroomMode(value: unknown): value is WarroomMode {
  return typeof value === "string" && WARROOM_MODE_IDS.has(value)
}

export function isWarroomLens(value: unknown): value is WarroomLens {
  return typeof value === "string" && WARROOM_LENS_IDS.has(value)
}

export function getWarroomLensLabel(lens: WarroomLens): string {
  return WARROOM_LENSES.find((option) => option.id === lens)?.label ?? lens
}
