"use client"

import { useCallback, useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { loadLlmConfig, saveLlmConfig } from "@/lib/party-storage"
import type { LlmConfig } from "@/lib/types"

interface LlmConfigFormProps {
  llmConfig: LlmConfig
  onChange: (config: LlmConfig) => void
}

export function LlmConfigForm({ llmConfig, onChange }: LlmConfigFormProps) {
  const [models, setModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState("")

  // Load saved config on mount
  useEffect(() => {
    const saved = loadLlmConfig()
    if (saved) onChange(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = useCallback(
    (patch: Partial<LlmConfig>) => {
      const next = { ...llmConfig, ...patch }
      onChange(next)
      saveLlmConfig(next)
    },
    [llmConfig, onChange],
  )

  const fetchModels = useCallback(async () => {
    if (!llmConfig.baseUrl) return
    setModelsLoading(true)
    setModelsError("")
    try {
      const res = await fetch(
        `/api/models?base=${encodeURIComponent(llmConfig.baseUrl)}&key=${encodeURIComponent(llmConfig.apiKey)}`,
      )
      const data = await res.json()
      if (data.models?.length) {
        setModels(data.models)
        if (!llmConfig.model || !data.models.includes(llmConfig.model)) {
          update({ model: data.models[0] })
        }
      } else {
        setModelsError("No models found at that endpoint.")
      }
    } catch {
      setModelsError("Could not reach endpoint.")
    } finally {
      setModelsLoading(false)
    }
  }, [llmConfig.baseUrl, llmConfig.apiKey, llmConfig.model, update])

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4 corner-ornaments">
      <p className="font-mono text-[9px] tracking-[0.4em] uppercase text-muted-foreground">
        Language Model
      </p>

      <div className="space-y-3">
        {/* Base URL */}
        <div className="space-y-1">
          <label className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
            Base URL
          </label>
          <Input
            value={llmConfig.baseUrl}
            onChange={(e) => update({ baseUrl: e.target.value })}
            onBlur={() => fetchModels()}
            placeholder="http://localhost:11434/v1"
            className="font-mono text-xs"
            suppressHydrationWarning
          />
        </div>

        {/* API Key */}
        <div className="space-y-1">
          <label className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
            API Key
          </label>
          <Input
            value={llmConfig.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            type="password"
            placeholder="sk-... or 'ollama'"
            className="font-mono text-xs"
            suppressHydrationWarning
          />
        </div>

        {/* Model */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
              Model
            </label>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => fetchModels()}
              disabled={modelsLoading}
              className="font-mono text-[9px] tracking-widest uppercase text-primary"
            >
              {modelsLoading ? "Loading..." : "Fetch models"}
            </Button>
          </div>

          {models.length > 0 ? (
            <select
              value={llmConfig.model}
              onChange={(e) => update({ model: e.target.value })}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={llmConfig.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder="Enter model name or fetch from endpoint"
              className="font-mono text-xs"
              suppressHydrationWarning
            />
          )}

          {modelsError && (
            <p className="font-mono text-[9px] text-destructive">{modelsError}</p>
          )}
        </div>

        {/* noToolChoice toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={llmConfig.noToolChoice ?? false}
            onChange={(e) => update({ noToolChoice: e.target.checked })}
            className="accent-primary"
            suppressHydrationWarning
          />
          <span className="font-mono text-[9px] tracking-wide text-muted-foreground">
            Omit tool_choice parameter
            <span className="ml-1.5 opacity-50">
              (vLLM without --enable-auto-tool-choice)
            </span>
          </span>
        </label>
      </div>
    </section>
  )
}
