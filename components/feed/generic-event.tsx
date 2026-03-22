export default function GenericEvent({ tool, input, result }: {
  tool: string
  input: Record<string, unknown>
  result: unknown
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const action = String(input?.action ?? "")
  const isError = !!r?.error

  return (
    <div className="px-3 py-1.5 flex gap-2 items-baseline flex-wrap">
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase shrink-0 text-[color:var(--wyr-muted)]">
        {tool}
      </span>
      {action && (
        <span className="font-mono text-[10px] shrink-0 text-[color:var(--wyr-muted)]">{action}</span>
      )}
      {isError ? (
        <span className="font-mono text-[10px] text-[color:var(--wyr-danger)]">{r.error}</span>
      ) : r?.message ? (
        <span className="font-mono text-[10px] text-[color:var(--wyr-muted)]">{r.message}</span>
      ) : r?.status ? (
        <span className="font-mono text-[10px] text-[color:var(--wyr-muted)]">{r.status}</span>
      ) : null}
    </div>
  )
}
