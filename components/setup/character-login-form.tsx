"use client"

import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface LoginSuccessData {
  sessionId: string
  characterName: string
  bootstrap: unknown
  credentials: { name: string; password: string }
  permanentPassword?: string
}

interface CharacterLoginFormProps {
  onSuccess: (data: LoginSuccessData) => void
}

export function CharacterLoginForm({ onSuccess }: CharacterLoginFormProps) {
  // Login fields
  const [charName, setCharName] = useState("")
  const [password, setPassword] = useState("")

  // Register fields
  const [regCode, setRegCode] = useState("")
  const [newCharName, setNewCharName] = useState("")

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const lastAttemptRef = useRef(0)
  const [mode, setMode] = useState<"login" | "register">("login")

  async function handleSubmit() {
    setError("")

    // Cooldown guard
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

    // Validation
    if (mode === "login") {
      if (!charName.trim()) { setError("Enter a character name."); return }
      if (!password.trim()) { setError("Enter a password."); return }
    } else {
      if (!regCode.trim()) { setError("Enter a registration code."); return }
      if (!newCharName.trim()) { setError("Enter a character name."); return }
    }

    setLoading(true)
    try {
      const body =
        mode === "login"
          ? { mode: "login", charName, password }
          : { mode: "register", regCode, newCharName }

      const res = await fetch("/api/agent/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to connect.")
        return
      }
      if (!data.sessionId) {
        setError("Server returned no session ID.")
        return
      }

      const name = mode === "login" ? charName : newCharName
      const pwd = mode === "login" ? password : data.permanentPassword ?? ""

      onSuccess({
        sessionId: data.sessionId,
        characterName: data.characterName,
        bootstrap: data.bootstrap ?? null,
        credentials: { name, password: pwd },
        permanentPassword: data.permanentPassword,
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4 corner-ornaments">
      <p className="font-mono text-[9px] tracking-[0.4em] uppercase text-muted-foreground">
        Character
      </p>

      <Tabs
        defaultValue="login"
        onValueChange={(v) => setMode(v as "login" | "register")}
      >
        <TabsList className="w-full">
          <TabsTrigger value="login" className="font-mono text-[9px] tracking-[0.3em] uppercase">
            Log In
          </TabsTrigger>
          <TabsTrigger value="register" className="font-mono text-[9px] tracking-[0.3em] uppercase">
            Register
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <div className="space-y-3 pt-3">
            <div className="space-y-1">
              <label className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
                Character Name
              </label>
              <Input
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                className="font-mono text-xs"
                suppressHydrationWarning
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
                Password
              </label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="font-mono text-xs"
                suppressHydrationWarning
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="register">
          <div className="space-y-3 pt-3">
            <div className="space-y-1">
              <label className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
                Registration Code
              </label>
              <Input
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                className="font-mono text-xs"
                suppressHydrationWarning
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
                Character Name
              </label>
              <Input
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                className="font-mono text-xs"
                suppressHydrationWarning
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Error */}
      {error && (
        <p className="font-mono text-xs text-center text-destructive">{error}</p>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={loading || cooldown}
        variant="outline"
        className="w-full font-mono text-xs tracking-[0.3em] uppercase border-primary/40 text-primary hover:bg-primary/10"
      >
        {loading ? "Connecting..." : cooldown ? "Wait..." : "Begin"}
      </Button>
    </section>
  )
}
