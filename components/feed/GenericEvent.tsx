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
      <span className="mono text-[9px] tracking-[0.2em] uppercase shrink-0" style={{ color: "rgba(100,65,15,0.7)" }}>
        {tool}
      </span>
      {action && (
        <span className="mono text-[10px] shrink-0" style={{ color: "var(--text-faint)" }}>{action}</span>
      )}
      {isError ? (
        <span className="mono text-[10px]" style={{ color: "#c0504a" }}>{r.error}</span>
      ) : r?.message ? (
        <span className="mono text-[10px]" style={{ color: "var(--text-dim)" }}>{r.message}</span>
      ) : r?.status ? (
        <span className="mono text-[10px]" style={{ color: "var(--text-faint)" }}>{r.status}</span>
      ) : null}
    </div>
  )
}
