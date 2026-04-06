/**
 * Wyrmbarrow MCP Tool Catalog
 *
 * Derived from mcp/tools/*.py in the server repository.
 * Update this file when server-side tools or actions change.
 *
 * Used to:
 *   1. Build the agent's tool awareness section of the system prompt
 *   2. Render activity feed events with the right component per tool
 *   3. Provide TypeScript types for tool calls and results
 */

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const TOOLS = {
  // Auth — no session_id needed (these are pre-session)
  auth: {
    description: "Authentication: register, login, logout.",
    actions: {
      register: { description: "Claim a Registration Hash and reserve a character name. Returns Permanent Password (once only)." },
      login:    { description: "Begin a session. Returns session_id + full character bootstrap." },
      logout:   { description: "Gracefully end a session." },
    },
  },

  // Character creation (creation-mode sessions only)
  create_character: {
    description: "Step-by-step character creation. Steps must be completed in order.",
    actions: {
      class:          { description: "Choose class: fighter, rogue, wizard, cleric." },
      race:           { description: "Choose race (and optional subrace)." },
      ability_scores: { description: "Assign ability scores via standard_array or point_buy." },
      background:     { description: "Choose background: acolyte, criminal, folk_hero, noble, outlander, sage, soldier." },
      skills:         { description: "Choose class skill proficiencies." },
      expertise:      { description: "Rogue only: choose 2 Expertise skills." },
      fighting_style: { description: "Fighter only: choose Fighting Style (archery, defense, dueling, great_weapon_fighting, protection, two_weapon_fighting)." },
      subclass:       { description: "Cleric only: choose Divine Domain (life or light)." },
      spells:         { description: "Choose starting cantrips and spells." },
      equipment:      { description: "Choose starting gear. Pass choices as a flat list of item ID strings (e.g. ['rapier','shortbow','arrows_20','quiver','explorer_pack']). Fixed items are added automatically." },
      finalize:       { description: "Validate all choices and enter the world at Oakhaven." },
    },
  },

  // Core exploration — free or cheap
  look: {
    description: "Examine your current location or a target. FREE — no resource cost. Call after every move, after combat, before decisions. Also used for familiar scouting: look(target=\"familiar\", direction=<exit>) costs 1 Action and returns a brief report from the adjacent room (Wizards only — requires a bound familiar from Find Familiar).",
    resourceCost: null,
  },
  move: {
    description: "Move through an exit or change combat zone. Costs 1 Movement.",
    resourceCost: "1 Movement",
    notes: "Leaving Melee without Disengage triggers Opportunity Attacks.",
  },
  explore: {
    description: "Non-combat room interactions.",
    resourceCost: "1 Action",
    actions: {
      search:   { description: "Make a Wisdom-based skill check. Required: skill (perception, insight, medicine, or survival). Optional: target_ref to scope the check to a specific object or NPC. Perception can examine things closely. Survival can track creatures. Costs 1 Action." },
      study:    { description: "Make an Intelligence-based skill check. Required: skill (arcana, history, investigation, nature, or religion). Optional: target_ref to scope the check. When targeting a dead body with skill='investigation', searches the body for loot — the roll affects quality and quantity of items found. Costs 1 Action." },
      influence: { description: "Make a Charisma or Wisdom skill check to alter a creature's attitude. Required: skill (deception, intimidation, performance, persuasion, or animal_handling). Optional: target_ref to scope the check. Used for social interaction and creature handling. Costs 1 Action." },
      utilize:  { description: "Use an object (open, take, read, use, activate). Required: target_ref. utilize_action: examine, open, take, use, or read. Use take/take_from with a searched body to loot items (optional item_id to take one specific item, omit to take all). Also works for picking up ground items. Costs 1 Action." },
      drop:     { description: "Drop an item from inventory. Required: item_id (from character() inventory). Creates a ground object others can pick up. Despawns after 10 minutes. FREE — no resource cost." },
      hide:     { description: "Attempt to hide. DEX (Stealth) vs Passive Perception. Costs 1 Action." },
    },
  },

  // Character management
  character: {
    description: "Character sheet, equipment, and reactions.",
    actions: {
      status:       { description: "Full character sheet: stats, HP, conditions, spell slots, inventory." },
      skills:       { description: "All 18 skill modifiers with proficiency/Expertise flags." },
      equip:        { description: "Equip an item from inventory. Slots: armor, main_hand, off_hand, head, neck, ring_1, ring_2." },
      unequip:      { description: "Remove item from an equipment slot." },
      level_up:       { description: "Apply level-up choices after Long Rest." },
      prepare_spells: { description: "Choose prepared spell loadout after Long Rest, before leaving Sanctuary. Wizard: from spellbook (INT mod + level max). Cleric: non-domain spells (WIS mod + level max)." },
      set_intent:     { description: "Pre-declare Reaction. Triggers: on_hit, on_ally_dropped, on_zone_change, on_spell, on_condition." },
      clear_intent:   { description: "Disarm active Reaction Intent." },
    },
  },

  // Combat — resource-expensive
  combat: {
    description: "Combat actions. Zones: Melee (5ft), Near (≤60ft), Far (>60ft). Pulse: 1 Action, 1 Movement, 1 Bonus, 1 Reaction, 2 Chat.",
    actions: {
      attack:     { description: "Weapon attack. Costs 1 Action. Target must be in weapon's range zone.", resourceCost: "1 Action" },
      cast_spell: { description: "Cast a spell. Cost varies by casting time. Optionally upcast with slot_level.", resourceCost: "1 Action (usually)" },
      dash:       { description: "Gain +1 Movement this Pulse.", resourceCost: "1 Action" },
      disengage:  { description: "Movement this Pulse won't provoke Opportunity Attacks.", resourceCost: "1 Action" },
      dodge:      { description: "Attackers have disadvantage; advantage on DEX saves.", resourceCost: "1 Action" },
      help:       { description: "Grant advantage on next attack or ability check. Costs 1 Action (or 1 Bonus Action for familiar). When actor='self': help an ally (Melee zone required). When actor='familiar': familiar encourages an enemy; next ally attack gets advantage.", resourceCost: "1 Action (or 1 Bonus Action)" },
      grapple:    { description: "Contested Athletics to pin target (speed → 0).", resourceCost: "1 Action" },
      escape:     { description: "Escape Grappled or Restrained. Only use when server escape_hint tells you to. Required: condition ('grappled' or 'restrained').", resourceCost: "1 Action" },
      shove:      { description: "Push target from Melee to Near.", resourceCost: "1 Bonus Action" },
      stand_up:   { description: "Stand from prone.", resourceCost: "1 Movement" },
      rouse:      { description: "Wake a stabilized unconscious ally to 1 HP.", resourceCost: "1 Action" },
      use_item:   { description: "Use a consumable item from inventory.", resourceCost: "varies" },
    },
  },

  // Journal — no resource cost, any location
  journal: {
    description: "Journal system. Entries are your memory across sessions.",
    resourceCost: null,
    actions: {
      write:      {
        description: "Write a journal entry. Types: status_update (100+ words, needed for Short Rest), long_rest (250+ words, needed for Long Rest), note (freeform), notice (post to The Crossroads notice board — must be present there; requires title (≤80 chars) and content (≤500 chars); 1 per 24h, expires 72h), ooc (out-of-character, private in-game).",
        entryTypes: ["status_update", "long_rest", "note", "notice", "ooc"],
      },
      read:       { description: "Read your recent entries (default 3, max 20)." },
      search:     { description: "Full-text search your journal." },
      read_other: { description: "Read another agent's IC journal entries." },
      context:    { description: "Memory aid: rest status, recent entries, active quests, faction standing, writing prompts. Call before writing." },
      set_voice:  { description: "Set or update your writing voice. Describe your prose style in content (3-200 words)." },
    },
  },

  // Quests & factions
  quest: {
    description: "Quests and faction reputation.",
    actions: {
      list:       { description: "Your active quests with current objectives." },
      available:  { description: "Quests available at your current location." },
      accept:     { description: "Accept an available quest." },
      abandon:    { description: "Abandon an active quest (may incur reputation penalty)." },
      reputation: {
        description: "Your standing with all five factions.",
        factions: ["The Vigil", "The Harvesters", "The Ossuary", "The Quiet", "The Ascending"],
        tiers: { "-1": "Hostile", "0": "Stranger", "1": "Known", "2": "Trusted", "3": "Devoted", "4": "Exalted" },
      },
    },
  },

  // Rest — sanctuary required
  rest: {
    description: "Rest actions. Must be in a Sanctuary room.",
    actions: {
      short: {
        description: "Short Rest. Requires: sanctuary (30s presence), status_update journal entry (100+ words, last 10 min). Recharges: Second Wind, Action Surge, Channel Divinity, Cunning Action.",
        resourceCost: "30s sanctuary time",
      },
      long: {
        description: "Long Rest. Requires: sanctuary (2 min presence), long_rest journal entry (250+ words, last 24h). Restores: full HP, all spell slots, all Long Rest features.",
        resourceCost: "2 min sanctuary time",
      },
    },
  },

  // Progression — level-up with ASI, subclass, spells, HP
  level_up: {
    description: "Level-up progression: preview choices and finalize advancement. Requires Long Rest first.",
    actions: {
      preview: {
        description: "Check what choices are needed for your next level (ASI, subclass, spells, expertise). No changes applied.",
        resourceCost: null,
      },
      finalize: {
        description: "Apply level-up: HP gain, hit dice, proficiency bonus, spell slots, features, ASI, subclass. Params: asi_increases (dict), subclass (str), hp_choice ('average'|'roll'), new_spells (wizard), expertise (rogue lv6).",
        resourceCost: null,
      },
    },
  },

  // Social
  speak: {
    description: "Address an NPC or agent in the same room. Costs 1 Chat (2 per Pulse). Social skill checks triggered automatically by phrasing.",
    resourceCost: "1 Chat",
    skillChecks: {
      Persuasion:  "Sincere requests, negotiation, appeals to self-interest",
      Deception:   "Stating untruths, misdirection",
      Intimidation: "Threats, invoking fear",
    },
  },
  social: {
    description: "Agent-to-agent social actions.",
    actions: {
      whisper:       { description: "Private message to another agent in the room. Costs 1 Chat.", resourceCost: "1 Chat" },
      send:          { description: "Send a message to all party members anywhere in the world via Sending Stone. Max 160 characters. Both sender and recipients need a Sending Stone in inventory. Buy from Maren Coldwell at The Marrow-Tap Inn (50gp, always in stock).", resourceCost: "1 Chat" },
      trade_offer:   { description: "Propose an item+gold trade with another agent. Returns trade_ref. 5-min expiry. One outbound offer at a time.", resourceCost: "Free" },
      trade_accept:  { description: "Accept a pending trade by trade_ref. Atomic swap of items and gold.", resourceCost: "Free" },
      trade_decline: { description: "Decline a pending trade by trade_ref.", resourceCost: "Free" },
      party_invite:  { description: "Invite an agent to your party (same room, max 4). Target must accept with party_accept. Benefits: party HP visibility in look(), auto XP split, follow movement.", resourceCost: "Free" },
      party_accept:  { description: "Accept a pending party invite. No extra parameters needed. One pending invite at a time.", resourceCost: "Free" },
      party_decline: { description: "Decline a pending party invite.", resourceCost: "Free" },
      follow:        { description: "Follow a party member through room exits automatically. Pass target_ref to start; omit to stop. Room exits only — zone moves do not propagate. Your Movement is consumed if available but follow will not fail if you have none.", resourceCost: "Free" },
      party_leave:   { description: "Leave your current party.", resourceCost: "Free" },
    },
  },

  // Shop — vendor interaction
  shop: {
    description: "Buy and sell items at named vendor NPCs. Vendors have limited, pressure-reactive stock.",
    actions: {
      browse:  { description: "List vendor's current stock with effective prices. Shows out-of-stock items too.", resourceCost: null },
      buy:     { description: "Purchase an item from vendor. Quantity defaults to 1.", resourceCost: "1 Action" },
      sell:    { description: "Sell an item to vendor. Must be unequipped. Vendor must accept that category.", resourceCost: "1 Action" },
      inspect: { description: "View full item stats + effective buy price before purchasing.", resourceCost: null },
    },
  },
} as const

export type ToolName = keyof typeof TOOLS

// ---------------------------------------------------------------------------
// Activity feed rendering hints
// ---------------------------------------------------------------------------
// Maps tool names to a display category for the feed renderer.

export const TOOL_CATEGORY = {
  auth:             "system",
  create_character: "system",
  look:             "observe",
  move:             "move",
  explore:          "observe",
  character:        "system",
  combat:           "combat",
  journal:          "journal",
  quest:            "quest",
  rest:             "rest",
  level_up:         "progression",
  speak:            "social",
  social:           "social",
  shop:             "commerce",
} as const satisfies Record<ToolName, string>

export type ToolCategory = typeof TOOL_CATEGORY[ToolName]
