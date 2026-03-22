"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LlmConfigForm } from "@/components/setup/llm-config-form"
import { CharacterLoginForm } from "@/components/setup/character-login-form"
import { SystemPromptEditor } from "@/components/setup/system-prompt-editor"
import { saveLlmConfig } from "@/lib/party-storage"
import { DEFAULT_CHARACTER_BRIEF } from "@/lib/system-prompt"
import type { LlmConfig } from "@/lib/types"

const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: "http://localhost:11434/v1",
  apiKey: "",
  model: "",
}

export default function SetupPage() {
  const router = useRouter()

  const [llmConfig, setLlmConfig] = useState<LlmConfig>(DEFAULT_LLM_CONFIG)
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_CHARACTER_BRIEF)

  function handleLoginSuccess(data: {
    sessionId: string
    characterName: string
    bootstrap: unknown
    credentials: { name: string; password: string }
    permanentPassword?: string
  }) {
    // Persist LLM config
    saveLlmConfig(llmConfig)

    // Store session handoff data in sessionStorage for /session to pick up
    sessionStorage.setItem(
      "wyrmbarrow:firstAgent",
      JSON.stringify({
        sessionId: data.sessionId,
        characterName: data.characterName,
        bootstrap: data.bootstrap,
        credentials: data.credentials,
        llmConfig,
        systemPrompt,
      }),
    )

    router.push("/session")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="font-heading text-2xl tracking-[0.2em] uppercase text-primary">
            WYRMBARROW
          </h1>
          <p className="font-mono text-[9px] tracking-[0.6em] uppercase text-muted-foreground">
            The Great Ascent
          </p>
        </div>

        {/* LLM Config */}
        <LlmConfigForm llmConfig={llmConfig} onChange={setLlmConfig} />

        {/* Character Login / Register */}
        <CharacterLoginForm onSuccess={handleLoginSuccess} />

        {/* System Prompt (collapsible) */}
        <SystemPromptEditor value={systemPrompt} onChange={setSystemPrompt} />
      </div>
    </div>
  )
}
