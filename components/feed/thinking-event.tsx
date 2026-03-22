export default function ThinkingEvent({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <div className="px-3 py-1.5 flex gap-2 items-start">
      <span className="font-mono text-[9px] mt-0.5 shrink-0 text-[color:var(--wyr-muted)]">···</span>
      <p className="font-mono text-[10px] leading-relaxed italic text-[color:var(--wyr-muted)]">
        {text}
      </p>
    </div>
  )
}
