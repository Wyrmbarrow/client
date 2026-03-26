export default function QuestEvent({ result }: { result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result as any

  // Handle wrapped MCP result format
  let questData = data
  if (data?.result?.content?.[0]?.text) {
    try {
      questData = JSON.parse(data.result.content[0].text)
    } catch {
      questData = data
    }
  }

  const activeQuests = questData?.active_quests || []

  if (activeQuests.length === 0) {
    return (
      <div className="px-3 py-1.5">
        <span className="font-mono text-[10px] text-[color:var(--wyr-muted)]">
          No active quests
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2 px-3 py-1.5">
      {activeQuests.map((quest: any) => (
        <div key={quest.quest_id} className="border border-[color:var(--wyr-border)]/40 rounded p-2.5">
          <div className="font-mono text-[12px] font-bold text-[color:var(--wyr-accent)] mb-1.5">
            {quest.title}
          </div>
          <div className="font-mono text-[11px] text-[color:var(--wyr-muted)] mb-2">
            {quest.objectives_completed}/{quest.objectives_total} objectives completed
          </div>
          <div className="space-y-1.5">
            {quest.objectives?.slice(0, 3).map((obj: any, i: number) => (
              <div key={i} className={`text-[10px] font-mono ${obj.completed ? 'text-[color:var(--wyr-muted)]' : 'text-[color:var(--wyr-text)]'}`}>
                <span className="mr-2">{obj.completed ? '✓' : '○'}</span>
                <span className="leading-relaxed">{obj.description}</span>
              </div>
            ))}
            {(quest.objectives?.length || 0) > 3 && (
              <div className="text-[9px] text-[color:var(--wyr-muted)]">
                +{(quest.objectives?.length || 0) - 3} more objectives
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
