"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { WORLD_RULES, DEFAULT_CHARACTER_BRIEF } from "@/lib/system-prompt"

const DEFAULT_SYSTEM_PROMPT = `${WORLD_RULES}\n\n${DEFAULT_CHARACTER_BRIEF}`
// Bump this when DEFAULT_SYSTEM_PROMPT changes in a breaking way.
// Mismatches cause the cached prompt to be reset to the new default.
const PROMPT_VERSION = "2"
const LS_KEY = "wyrmbarrow_setup"

function loadSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}")
    // If the saved prompt is from an older version, drop it so the new default applies.
    if (data.promptVersion !== PROMPT_VERSION) {
      delete data.systemPrompt
      data.promptVersion = PROMPT_VERSION
      localStorage.setItem(LS_KEY, JSON.stringify(data))
    }
    return data
  } catch { return {} }
}

type Tab = "existing" | "new"

export default function SetupPage() {
  const router = useRouter()
  const saved = typeof window !== "undefined" ? loadSaved() : {}

  const [tab, setTab] = useState<Tab>(saved.tab ?? "existing")
  function setTabAndSave(t: Tab) { setTab(t); save({ tab: t }) }
  const [llmBase, setLlmBase] = useState(saved.llmBase ?? "http://localhost:11434/v1")
  const [llmKey, setLlmKey] = useState(saved.llmKey ?? "ollama")
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState(saved.model ?? "")
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState("")
  const [noToolChoice, setNoToolChoice] = useState<boolean>(saved.noToolChoice === "true")

  const [charName, setCharName] = useState(saved.charName ?? "")
  const [password, setPassword] = useState(saved.password ?? "")
  const [regCode, setRegCode] = useState(saved.regCode ?? "")
  const [newCharName, setNewCharName] = useState(saved.newCharName ?? "")

  const [systemPrompt, setSystemPrompt] = useState(saved.systemPrompt ?? DEFAULT_SYSTEM_PROMPT)

  function save(patch: Record<string, string>) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ ...loadSaved(), ...patch })) } catch { /* ignore */ }
  }
  const [showPrompt, setShowPrompt] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const lastAttemptRef = useRef(0)

  async function fetchModels() {
    if (!llmBase) return
    setModelsLoading(true)
    setModelsError("")
    try {
      const res = await fetch(`/api/models?base=${encodeURIComponent(llmBase)}&key=${encodeURIComponent(llmKey)}`)
      const data = await res.json()
      if (data.models?.length) {
        setModels(data.models)
        setModel(data.models[0])
        save({ model: data.models[0] })
      } else {
        setModelsError("No models found at that endpoint.")
      }
    } catch {
      setModelsError("Could not reach endpoint.")
    } finally {
      setModelsLoading(false)
    }
  }

  async function handleBegin() {
    setError("")
    if (!model) { setError("Select a model first."); return }

    const now = Date.now()
    const elapsed = now - lastAttemptRef.current
    if (elapsed < 2000) {
      const wait = Math.ceil((2000 - elapsed) / 1000)
      setError(`Please wait ${wait}s before trying again.`)
      return
    }
    lastAttemptRef.current = now
    setCooldown(true)
    setTimeout(() => setCooldown(false), 2000)

    setLoading(true)
    try {
      const body = tab === "existing"
        ? { mode: "login", charName, password, llmBase, llmKey, model, systemPrompt }
        : { mode: "register", regCode, newCharName, llmBase, llmKey, model, systemPrompt }

      const res = await fetch("/api/agent/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Failed to connect."); return }

      // Store session config in sessionStorage — cleared when tab closes
      sessionStorage.setItem("wyrmbarrow_session", JSON.stringify({
        sessionId: data.sessionId,
        characterName: data.characterName,
        bootstrap: data.bootstrap ?? null,
        llmBase, llmKey, model, systemPrompt, noToolChoice,
      }))
      router.push("/session")
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--bg)" }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 700px 500px at 50% 40%, rgba(100,45,5,0.07) 0%, transparent 70%)"
      }} />

      <div className="relative w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="mono text-[9px] tracking-[0.6em] uppercase" style={{ color: "var(--amber-faint)" }}>
            Wyrmbarrow
          </p>
          <h1 className="mono text-lg tracking-[0.2em] uppercase" style={{ color: "var(--amber)" }}>
            The Great Ascent
          </h1>
          <p className="mono text-[9px] tracking-[0.4em] uppercase" style={{ color: "var(--text-faint)" }}>
            Agent Client
          </p>
        </div>

        {/* LLM Config */}
        <section className="panel-border corner-ornaments p-5 space-y-4">
          <p className="mono text-[9px] tracking-[0.4em] uppercase" style={{ color: "var(--amber-dim)" }}>
            Language Model
          </p>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
                Base URL
              </label>
              <input
                value={llmBase}
                onChange={e => { setLlmBase(e.target.value); save({ llmBase: e.target.value }) }}
                onBlur={fetchModels}
                placeholder="http://localhost:11434/v1"
                className="w-full mono text-xs px-3 py-2"
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  color: "var(--text)", outline: "none",
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
                API Key
              </label>
              <input
                value={llmKey}
                onChange={e => { setLlmKey(e.target.value); save({ llmKey: e.target.value }) }}
                type="password"
                placeholder="sk-... or 'ollama'"
                className="w-full mono text-xs px-3 py-2"
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  color: "var(--text)", outline: "none",
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
                  Model
                </label>
                <button onClick={fetchModels} className="mono text-[9px] tracking-widest uppercase"
                  style={{ color: "var(--amber-dim)" }}>
                  {modelsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>
              {models.length > 0 ? (
                <select
                  value={model}
                  onChange={e => { setModel(e.target.value); save({ model: e.target.value }) }}
                  className="w-full mono text-xs px-3 py-2"
                  style={{
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    color: "var(--text)", outline: "none",
                  }}
                >
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input
                  value={model}
                  onChange={e => { setModel(e.target.value); save({ model: e.target.value }) }}
                  placeholder="Enter model name or fetch from endpoint"
                  className="w-full mono text-xs px-3 py-2"
                  style={{
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    color: "var(--text)", outline: "none",
                  }}
                />
              )}
              {modelsError && (
                <p className="mono text-[9px]" style={{ color: "#c0504a" }}>{modelsError}</p>
              )}
            </div>

            {/* Tool choice compat toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={noToolChoice}
                onChange={e => { setNoToolChoice(e.target.checked); save({ noToolChoice: String(e.target.checked) }) }}
                style={{ accentColor: "var(--amber)" }}
              />
              <span className="mono text-[9px] tracking-wide" style={{ color: "var(--text-faint)" }}>
                Omit tool_choice parameter
                <span style={{ color: "rgba(100,65,15,0.5)", marginLeft: "0.4em" }}>
                  (vLLM without --enable-auto-tool-choice)
                </span>
              </span>
            </label>
          </div>
        </section>

        {/* Character Config */}
        <section className="panel-border corner-ornaments p-5 space-y-4">
          <p className="mono text-[9px] tracking-[0.4em] uppercase" style={{ color: "var(--amber-dim)" }}>
            Character
          </p>

          {/* Tab switcher */}
          <div className="flex gap-0" style={{ border: "1px solid var(--border)" }}>
            {(["existing", "new"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTabAndSave(t)}
                className="flex-1 mono text-[9px] tracking-[0.3em] uppercase py-2"
                style={{
                  background: tab === t ? "rgba(118,82,24,0.25)" : "transparent",
                  color: tab === t ? "var(--amber)" : "var(--text-faint)",
                  borderRight: t === "existing" ? "1px solid var(--border)" : "none",
                }}
              >
                {t === "existing" ? "Log In" : "Register"}
              </button>
            ))}
          </div>

          {tab === "existing" ? (
            <div className="space-y-3">
              <InputField label="Character Name" value={charName} onChange={v => { setCharName(v); save({ charName: v }) }} />
              <InputField label="Password" value={password} onChange={v => { setPassword(v); save({ password: v }) }} type="password" />
            </div>
          ) : (
            <div className="space-y-3">
              <InputField label="Registration Code" value={regCode} onChange={v => { setRegCode(v); save({ regCode: v }) }} mono />
              <InputField label="Character Name" value={newCharName} onChange={v => { setNewCharName(v); save({ newCharName: v }) }} />
            </div>
          )}
        </section>

        {/* System Prompt (collapsible) */}
        <section className="panel-border p-4 space-y-3">
          <div className="w-full flex items-center justify-between">
            <button
              onClick={() => setShowPrompt(v => !v)}
              className="flex items-center gap-2"
            >
              <p className="mono text-[9px] tracking-[0.4em] uppercase" style={{ color: "var(--amber-dim)" }}>
                Character Brief
              </p>
              <span className="mono text-[9px]" style={{ color: "var(--text-faint)" }}>
                {showPrompt ? "▲ hide" : "▼ edit"}
              </span>
            </button>
            <button
              onClick={() => { setSystemPrompt(DEFAULT_SYSTEM_PROMPT); save({ systemPrompt: DEFAULT_SYSTEM_PROMPT, promptVersion: PROMPT_VERSION }) }}
              className="mono text-[9px] tracking-widest uppercase"
              style={{ color: "var(--text-faint)" }}
            >
              Reset
            </button>
          </div>
          {showPrompt && (
            <textarea
              value={systemPrompt}
              onChange={e => { setSystemPrompt(e.target.value); save({ systemPrompt: e.target.value, promptVersion: PROMPT_VERSION }) }}
              rows={10}
              className="w-full mono text-[11px] px-3 py-2 resize-y"
              style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                color: "var(--text)", outline: "none", lineHeight: 1.6,
              }}
            />
          )}
        </section>

        {/* Error */}
        {error && (
          <p className="mono text-xs text-center" style={{ color: "#c0504a" }}>{error}</p>
        )}

        {/* Begin */}
        <button
          onClick={handleBegin}
          disabled={loading || cooldown}
          className="w-full py-3 mono text-xs tracking-[0.3em] uppercase"
          style={{
            background: (loading || cooldown) ? "rgba(118,82,24,0.15)" : "rgba(118,82,24,0.3)",
            border: "1px solid var(--border-hi)",
            color: (loading || cooldown) ? "var(--text-faint)" : "var(--amber)",
            cursor: (loading || cooldown) ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Connecting..." : cooldown ? "Wait…" : "Begin"}
        </button>

      </div>
    </div>
  )
}

function InputField({
  label, value, onChange, type = "text", mono = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  mono?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
        className={`w-full text-xs px-3 py-2 ${mono ? "mono" : ""}`}
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          color: "var(--text)", outline: "none",
        }}
      />
    </div>
  )
}
