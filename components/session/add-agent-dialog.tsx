"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { CharacterLoginForm } from "@/components/setup/character-login-form"

interface AddAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (data: {
    sessionId: string
    characterName: string
    bootstrap: unknown
    credentials: { name: string; password: string }
  }) => void
}

export function AddAgentDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddAgentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--wyr-panel)] border-[color:var(--wyr-border)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-[color:var(--wyr-accent)]">
            Add Agent
          </DialogTitle>
          <DialogDescription>
            Log in or register a character to add to your party.
          </DialogDescription>
        </DialogHeader>
        <CharacterLoginForm
          onSuccess={(data) => {
            onSuccess({
              sessionId: data.sessionId,
              characterName: data.characterName,
              bootstrap: data.bootstrap,
              credentials: data.credentials,
            })
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
