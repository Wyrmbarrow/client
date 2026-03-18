export default function MoveEvent({ input, result }: { input: Record<string, unknown>; result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const destination = r?.room?.name ?? r?.location ?? r?.destination ?? null
  const direction   = String(input?.direction ?? "")
  const status      = r?.status ?? ""
  const isError     = !!r?.error

  return (
    <div className="px-3 py-2 flex gap-3 items-center">
      <span className="mono text-[9px] tracking-[0.2em] uppercase shrink-0" style={{ color: "rgba(100,65,15,0.7)" }}>
        move
      </span>
      {isError ? (
        <span className="mono text-[10px]" style={{ color: "#c0504a" }}>
          {r.error}
        </span>
      ) : (
        <span className="mono text-[10px]" style={{ color: "var(--text-dim)" }}>
          <span style={{ color: "var(--amber-dim)" }}>{direction}</span>
          {destination && (
            <> → <span style={{ color: "var(--text)" }}>{destination}</span></>
          )}
          {status === "opportunity_attack" && (
            <span className="ml-2 px-1" style={{
              color: "#e08050",
              border: "1px solid rgba(200,80,50,0.4)",
              fontSize: 9,
            }}>Opportunity Attack!</span>
          )}
        </span>
      )}
    </div>
  )
}
