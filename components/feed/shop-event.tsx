import GenericEvent from "./generic-event"

export default function ShopEvent({ input, result }: { input: Record<string, unknown>; result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const action  = String(input?.action ?? "")
  const isError = !!r?.error

  if (action === "browse") {
    return <ShopBrowse result={r} isError={isError} />
  }
  if (action === "buy") {
    return <ShopBuy input={input} result={r} isError={isError} />
  }
  if (action === "sell") {
    return <ShopSell input={input} result={r} isError={isError} />
  }
  if (action === "inspect") {
    return <ShopInspect input={input} result={r} isError={isError} />
  }

  // Unknown shop action — fall back to generic
  return <GenericEvent tool="shop" input={input} result={result} />
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

interface SubProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
  isError: boolean
}

function ShopBrowse({ result, isError }: SubProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(result?.items) ? result.items : []
  const shopName = result?.shop ?? result?.vendor ?? ""

  return (
    <div className="rounded-md border border-[color:var(--wyr-border)] bg-[var(--wyr-panel)] px-4 pt-3 pb-4 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[color:var(--wyr-muted)]">shop</span>
        <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">browse</span>
        {shopName && (
          <span className="font-heading text-sm text-[color:var(--wyr-accent)]">{shopName}</span>
        )}
      </div>
      {isError ? (
        <p className="font-mono text-[10px] text-[color:var(--wyr-danger)]">{result.error}</p>
      ) : items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="font-mono text-[10px] flex gap-2 items-baseline text-[color:var(--wyr-muted)]">
              <span className="text-foreground">{item.name ?? item.key ?? "Item"}</span>
              {item.price != null && (
                <span className="text-[color:var(--wyr-accent)]">{item.price} gp</span>
              )}
              {item.description && (
                <span className="text-[color:var(--wyr-muted)] truncate">{item.description}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-[10px] text-[color:var(--wyr-muted)]">No items available.</p>
      )}
    </div>
  )
}

function ShopBuy({ input, result, isError }: SubProps & { input: Record<string, unknown> }) {
  const itemName = String(input?.item ?? input?.item_ref ?? result?.item?.name ?? "")
  const price    = result?.price ?? result?.total ?? null
  const qty      = Number(input?.quantity ?? 1)

  return (
    <div className="px-3 py-2 flex gap-3 items-center flex-wrap">
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase shrink-0 text-[color:var(--wyr-muted)]">shop</span>
      <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">buy</span>
      {isError ? (
        <span className="font-mono text-[10px] text-[color:var(--wyr-danger)]">{result.error}</span>
      ) : (
        <span className="font-mono text-[10px] text-[color:var(--wyr-muted)]">
          {qty !== 1 && <span className="text-foreground">{qty}× </span>}
          <span className="text-foreground">{itemName}</span>
          {price != null && (
            <> · <span className="text-[color:var(--wyr-accent)]">{price} gp</span></>
          )}
          <span className="ml-2" style={{ color: "rgba(100,180,110,0.6)" }}>✓ purchased</span>
        </span>
      )}
    </div>
  )
}

function ShopSell({ input, result, isError }: SubProps & { input: Record<string, unknown> }) {
  const itemName = String(input?.item ?? input?.item_ref ?? result?.item?.name ?? "")
  const received = result?.gold ?? result?.price ?? null
  const qty      = Number(input?.quantity ?? 1)

  return (
    <div className="px-3 py-2 flex gap-3 items-center flex-wrap">
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase shrink-0 text-[color:var(--wyr-muted)]">shop</span>
      <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">sell</span>
      {isError ? (
        <span className="font-mono text-[10px] text-[color:var(--wyr-danger)]">{result.error}</span>
      ) : (
        <span className="font-mono text-[10px] text-[color:var(--wyr-muted)]">
          {qty !== 1 && <span className="text-foreground">{qty}× </span>}
          <span className="text-foreground">{itemName}</span>
          {received != null && (
            <> · <span className="text-[color:var(--wyr-accent)]">+{received} gp</span></>
          )}
          <span className="ml-2" style={{ color: "rgba(100,180,110,0.6)" }}>✓ sold</span>
        </span>
      )}
    </div>
  )
}

function ShopInspect({ input, result, isError }: SubProps & { input: Record<string, unknown> }) {
  const itemName    = String(input?.item ?? input?.item_ref ?? result?.name ?? "")
  const description = result?.description ?? result?.details ?? ""
  const price       = result?.price ?? null
  const itemType    = result?.type ?? result?.category ?? ""

  return (
    <div className="rounded-md border border-[color:var(--wyr-border)] bg-[var(--wyr-panel)] px-4 pt-3 pb-4 space-y-1.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[color:var(--wyr-muted)]">shop</span>
        <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">inspect</span>
        <span className="font-heading text-sm text-[color:var(--wyr-accent)]">{itemName}</span>
        {itemType && (
          <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">{itemType}</span>
        )}
        {price != null && (
          <span className="font-mono text-[10px] ml-auto text-[color:var(--wyr-accent)]">{price} gp</span>
        )}
      </div>
      {isError ? (
        <p className="font-mono text-[10px] text-[color:var(--wyr-danger)]">{result.error}</p>
      ) : description ? (
        <p className="font-serif text-xs leading-relaxed text-[color:var(--wyr-muted)]" style={{ lineHeight: 1.6 }}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
