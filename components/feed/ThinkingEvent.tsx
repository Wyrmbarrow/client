export default function ThinkingEvent({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <div className="px-3 py-1.5 flex gap-2 items-start">
      <span className="mono text-[9px] mt-0.5 shrink-0" style={{ color: "var(--text-faint)" }}>···</span>
      <p className="mono text-[10px] leading-relaxed italic" style={{ color: "var(--text-faint)" }}>
        {text}
      </p>
    </div>
  )
}
