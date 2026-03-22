export default function MoveEvent({ input, result }: { input: Record<string, unknown>; result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const destination = r?.room?.name ?? r?.location ?? r?.destination ?? null
  const direction   = String(input?.direction ?? "")
  const status      = r?.status ?? ""
  const isError     = !!r?.error

  return (
    <div className="px-3 py-2 flex gap-3 items-center">
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase shrink-0 text-[color:var(--wyr-muted)]">
        move
      </span>
      {isError ? (
        <span className="font-mono text-[10px] text-[color:var(--wyr-danger)]">
          {r.error}
        </span>
      ) : (
        <span className="font-mono text-[10px] text-[color:var(--wyr-muted)]">
          <span className="text-[color:var(--wyr-accent)]">{direction}</span>
          {destination && (
            <> → <span className="text-foreground">{destination}</span></>
          )}
          {status === "opportunity_attack" && (
            <span className="ml-2 px-1 rounded-sm font-mono text-[9px]" style={{
              color: "rgba(224,128,80,0.9)",
              border: "1px solid rgba(200,80,50,0.4)",
            }}>
              Opportunity Attack!
            </span>
          )}
        </span>
      )}
    </div>
  )
}
