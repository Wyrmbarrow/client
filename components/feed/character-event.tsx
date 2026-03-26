"use client"

import { useState } from "react"

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const
const ABILITY_LABELS: Record<string, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
}
const SAVING_THROW_LABELS: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
}
const SKILLS: { name: string; ability: string; label: string }[] = [
  { name: "acrobatics", ability: "dex", label: "Acrobatics" },
  { name: "animal_handling", ability: "wis", label: "Animal Handling" },
  { name: "arcana", ability: "int", label: "Arcana" },
  { name: "athletics", ability: "str", label: "Athletics" },
  { name: "deception", ability: "cha", label: "Deception" },
  { name: "history", ability: "int", label: "History" },
  { name: "insight", ability: "wis", label: "Insight" },
  { name: "intimidation", ability: "cha", label: "Intimidation" },
  { name: "investigation", ability: "int", label: "Investigation" },
  { name: "medicine", ability: "wis", label: "Medicine" },
  { name: "nature", ability: "int", label: "Nature" },
  { name: "perception", ability: "wis", label: "Perception" },
  { name: "performance", ability: "cha", label: "Performance" },
  { name: "persuasion", ability: "cha", label: "Persuasion" },
  { name: "religion", ability: "int", label: "Religion" },
  { name: "sleight_of_hand", ability: "dex", label: "Sleight of Hand" },
  { name: "stealth", ability: "dex", label: "Stealth" },
  { name: "survival", ability: "wis", label: "Survival" },
]
const FACTION_LABELS: Record<string, string> = {
  the_vigil: "The Vigil",
  the_harvesters: "The Harvesters",
  the_ossuary: "The Ossuary",
  the_quiet: "The Quiet",
  the_ascending: "The Ascending",
}
const FACTION_TIER_NAMES: Record<number, string> = {
  [-1]: "Hostile", 0: "Stranger", 1: "Acquainted",
  2: "Trusted", 3: "Devoted", 4: "Exalted",
}

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function skillMod(cs: any, skill: { name: string; ability: string }): string {
  const base = Math.floor(((cs[skill.ability] ?? 10) - 10) / 2)
  const isExpert = cs.expertise_skills?.includes(skill.name)
  const isProf = cs.skill_proficiencies?.includes(skill.name) || isExpert
  const bonus = isExpert ? cs.proficiency_bonus * 2 : isProf ? cs.proficiency_bonus : 0
  const total = base + bonus
  return total >= 0 ? `+${total}` : `${total}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveMod(cs: any, ability: string): string {
  const base = Math.floor(((cs[ability] ?? 10) - 10) / 2)
  const isProf = cs.saving_throw_proficiencies?.includes(ability)
  const total = base + (isProf ? cs.proficiency_bonus : 0)
  return total >= 0 ? `+${total}` : `${total}`
}

function formatSlug(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

export default function CharacterEvent({ result }: { result: unknown }) {
  const [expanded, setExpanded] = useState(false)
  const [packOpen, setPackOpen] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result as any
  const char = data?.character ?? data
  const cs = char?.charsheet ?? char
  if (!cs?.name) return null

  const conditions: string[] = char?.conditions ?? cs?.conditions ?? []
  const hpFraction = cs.hp_max > 0 ? cs.hp_current / cs.hp_max : 1
  const hpColor = hpFraction > 0.5 ? "var(--wyr-accent)" : hpFraction > 0.25 ? "rgba(224,160,60,0.9)" : "var(--wyr-danger)"

  // Spirit state — from look response top-level or login bootstrap.spirit
  const isDead = data?.spirit_vision === true || data?.spirit?.is_spirit === true || char?.is_dead === true
  const minutesUntilRevival: number | undefined = data?.minutes_until_revival ?? data?.spirit?.minutes_until_revival
  const revivalAvailableAt: string | undefined = data?.revival_available_at ?? data?.spirit?.revival_available_at

  return (
    <div className="corner-ornaments rounded-md border border-[color:var(--wyr-border)] bg-[var(--wyr-panel)]">
      <div className="px-4 pt-3 pb-4 space-y-2">

        {/* Header */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-heading text-sm font-medium text-[color:var(--wyr-accent)]">{cs.name}</span>
          <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">
            {[formatSlug(cs.race ?? ""), cs.class ? formatSlug(cs.class) : null, cs.level].filter(Boolean).join(" ")}
            {cs.subclass ? ` (${formatSlug(cs.subclass)})` : ""}
          </span>
        </div>

        {/* Spirit banner */}
        {isDead && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-sm font-mono text-[9px]"
            style={{
              background: "rgba(160,135,88,0.1)",
              border: "1px solid rgba(160,135,88,0.25)",
              color: "rgba(160,135,88,0.8)",
            }}>
            <span className="tracking-widest uppercase">Spirit</span>
            {minutesUntilRevival != null && (
              <span>Revival in <span className="tabular-nums font-bold">{minutesUntilRevival}m</span></span>
            )}
            {revivalAvailableAt && (
              <span className="text-[color:var(--wyr-muted)]">({revivalAvailableAt})</span>
            )}
          </div>
        )}

        {/* Combat stats */}
        <div className="flex gap-4 flex-wrap font-mono text-[10px] text-[color:var(--wyr-text)]">
          <span><span className="text-[color:var(--wyr-muted)]">AC</span> {cs.ac ?? "—"}</span>
          <span>
            <span className="text-[color:var(--wyr-muted)]">HP</span>{" "}
            <span style={{ color: hpColor }}>{cs.hp_current}</span>
            <span className="text-[color:var(--wyr-muted)]">/{cs.hp_max}</span>
          </span>
          <span><span className="text-[color:var(--wyr-muted)]">Speed</span> {cs.speed ?? "—"}</span>
          <span><span className="text-[color:var(--wyr-muted)]">Init</span> {cs.initiative >= 0 ? `+${cs.initiative}` : cs.initiative}</span>
          <span><span className="text-[color:var(--wyr-muted)]">Prof</span> +{cs.proficiency_bonus}</span>
          <span><span className="text-[color:var(--wyr-muted)]">Gold</span> {cs.gold ?? 0}</span>
        </div>

        {/* Ability scores */}
        <div className="flex justify-around py-1.5 border-y border-[color:var(--wyr-border)]/40">
          {ABILITY_KEYS.map((key) => (
            <div key={key} className="text-center">
              <div className="font-mono text-[7px] font-bold uppercase tracking-widest text-[color:var(--wyr-accent)]/60">
                {ABILITY_LABELS[key]}
              </div>
              <div className="font-mono text-sm font-bold text-[color:var(--wyr-text)]">
                {cs[key] ?? "—"}
              </div>
              <div className="font-mono text-[9px] text-[color:var(--wyr-muted)]">
                {cs[key] ? mod(cs[key]) : "—"}
              </div>
            </div>
          ))}
        </div>

        {/* Conditions */}
        {conditions.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {conditions.map((c: string) => (
              <span key={c} className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm border border-[color:var(--wyr-danger)]/40 text-[color:var(--wyr-danger)]">
                {formatSlug(c)}
              </span>
            ))}
          </div>
        )}

        {/* Expandable sheet */}
        {expanded && (
          <div className="grid grid-cols-2 gap-0 pt-2 font-mono text-[9px] text-[color:var(--wyr-text)]">

            {/* LEFT COLUMN */}
            <div className="pr-3 border-r border-[color:var(--wyr-border)]/40 space-y-2">
              <SectionHeader label="Saving Throws" />
              <div className="space-y-0.5">
                {ABILITY_KEYS.map((key) => {
                  const isProf = cs.saving_throw_proficiencies?.includes(key)
                  return (
                    <div key={key} className="flex justify-between">
                      <span>{SAVING_THROW_LABELS[key]} {isProf && <span className="text-[color:var(--wyr-accent)]">✦</span>}</span>
                      <span className="font-bold">{saveMod(cs, key)}</span>
                    </div>
                  )
                })}
              </div>

              <SectionHeader label="Skills" />
              <div className="space-y-0.5">
                {SKILLS.map((skill) => {
                  const isExpert = cs.expertise_skills?.includes(skill.name)
                  const isProf = cs.skill_proficiencies?.includes(skill.name) || isExpert
                  return (
                    <div key={skill.name} className="flex justify-between">
                      <span>
                        {skill.label}{" "}
                        {isExpert ? <span className="text-[color:var(--wyr-accent)]">✦✦</span>
                          : isProf ? <span className="text-[color:var(--wyr-accent)]">✦</span> : ""}
                      </span>
                      <span className="font-bold">{skillMod(cs, skill)}</span>
                    </div>
                  )
                })}
              </div>

              <SectionHeader label="Hit Dice" />
              <p>{(cs.hit_dice_total ?? 0) - (cs.hit_dice_used ?? 0)}/{cs.hit_dice_total ?? 0} {cs.hit_die ?? ""}</p>
            </div>

            {/* RIGHT COLUMN */}
            <div className="pl-3 space-y-2">
              <SectionHeader label="Features" />
              {cs.features?.length > 0
                ? cs.features.map((f: { name: string }, i: number) => (
                    <p key={i} className="font-bold">{f.name}</p>
                  ))
                : <p className="text-[color:var(--wyr-muted)]">None yet</p>
              }

              <SectionHeader label="Equipment" />
              {Object.entries(cs.equipped ?? {}).map(([slot, item]) =>
                item ? (
                  <div key={slot}>
                    <span className="text-[color:var(--wyr-muted)]">{formatSlug(slot)}: </span>
                    <span>{formatSlug(String(item))}</span>
                  </div>
                ) : null
              )}
              {cs.inventory?.length > 0 && (
                <div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPackOpen(o => !o) }}
                    className="text-[color:var(--wyr-muted)] hover:text-[color:var(--wyr-text)] transition-colors"
                  >
                    {packOpen ? "▾" : "▸"} {cs.inventory.length} item{cs.inventory.length !== 1 ? "s" : ""} in pack
                  </button>
                  {packOpen && (
                    <div className="pl-2.5 mt-0.5">
                      {(cs.inventory as { item_id: string; quantity: number }[]).map((item, i) => (
                        <div key={i}>
                          {formatSlug(item.item_id)}
                          {item.quantity > 1 && <span className="text-[color:var(--wyr-muted)]"> ×{item.quantity}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {Object.keys(cs.spell_slots ?? {}).length > 0 && (
                <>
                  <SectionHeader label="Spell Slots" />
                  {Object.entries(cs.spell_slots).map(([lvl, slot]: [string, unknown]) => {
                    const s = slot as { total: number; used: number }
                    return <div key={lvl}>Level {lvl}: {s.total - s.used}/{s.total}</div>
                  })}
                </>
              )}

              {((cs.cantrips?.length ?? 0) > 0 || (cs.spellbook?.length ?? 0) > 0 || (cs.prepared_spells?.length ?? 0) > 0) && (
                <>
                  <SectionHeader label="Spells" />
                  {(cs.cantrips?.length ?? 0) > 0 && (
                    <>
                      <p className="text-[color:var(--wyr-muted)]">Cantrips</p>
                      {cs.cantrips.map((id: string) => <div key={id} className="pl-1.5">{formatSlug(id)}</div>)}
                    </>
                  )}
                  {(cs.spellbook?.length ?? 0) > 0 && (
                    <>
                      <p className="text-[color:var(--wyr-muted)] mt-1">Spellbook</p>
                      {cs.spellbook.map((id: string) => <div key={id} className="pl-1.5">{formatSlug(id)}</div>)}
                    </>
                  )}
                  {(cs.prepared_spells?.length ?? 0) > 0 && (
                    <>
                      <p className="text-[color:var(--wyr-muted)] mt-1">Prepared</p>
                      {cs.prepared_spells.map((id: string) => (
                        <div key={id} className="pl-1.5">
                          {formatSlug(id)}
                          {cs.domain_spells?.includes(id) && <span className="text-[color:var(--wyr-accent)] ml-1">✦</span>}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              <SectionHeader label="Faction Standing" />
              {Object.entries(cs.reputation ?? {}).map(([faction, tier]) => (
                <div key={faction}>
                  <span className="text-[color:var(--wyr-muted)]">{FACTION_LABELS[faction] ?? faction}: </span>
                  <span className="font-bold">{FACTION_TIER_NAMES[tier as number] ?? tier}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expand/collapse */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
          className="w-full pt-1 font-mono text-[8px] tracking-[0.15em] uppercase text-[color:var(--wyr-accent)]/60 hover:text-[color:var(--wyr-accent)] transition-colors"
        >
          {expanded ? "▲ collapse ▲" : "▼ expand full sheet ▼"}
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="font-mono text-[7px] font-bold uppercase tracking-[0.12em] text-[color:var(--wyr-accent)]/60 mt-1 mb-0.5">
      {label}
    </p>
  )
}
