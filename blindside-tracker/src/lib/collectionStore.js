import { supabase } from './supabaseClient'

function rowsToState(rows) {
  const state = {}
  for (const row of rows) {
    if (!state[row.set_id]) state[row.set_id] = {}
    state[row.set_id][row.card_id] = {
      quantity: row.quantity,
      updatedAt: row.updated_at,
    }
  }
  return state
}

function stateToRows(state, userId) {
  const rows = []
  for (const [setId, cards] of Object.entries(state)) {
    for (const [cardId, data] of Object.entries(cards)) {
      rows.push({
        user_id: userId,
        set_id: setId,
        card_id: cardId,
        quantity: data.quantity ?? 0,
        updated_at: data.updatedAt ?? new Date().toISOString(),
      })
    }
  }
  return rows
}

// ─────────────────────────────────────────────
// Local storage fallback (used when logged out)
// ─────────────────────────────────────────────

const LOCAL_KEY = 'blindside-tracker.collection.v1'

function localLoad() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function localSave(state) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  } catch { }
}

// ─────────────────────────────────────────────
// Public store
// ─────────────────────────────────────────────

export const collectionStore = {
  // Load the full collection for the current user.
  // Falls back to localStorage when logged out.
  async load(userId) {
    if (!userId) return localLoad()

    const { data, error } = await supabase
      .from('collections')
      .select('set_id, card_id, quantity, updated_at')
      .eq('user_id', userId)

    if (error) {
      console.error('collectionStore.load error:', error.message)
      return localLoad()
    }

    return rowsToState(data)
  },

  // Persist a single card update.
  // Called after every quantity change in App.jsx.
  async saveCard(userId, setId, cardId, quantity, updatedAt) {
    // Always keep localStorage in sync so logged-out fallback stays current.
    // (App.jsx still calls this with the full state via the debounced save,
    //  but we also persist locally here for resilience.)

    if (!userId) {
      // Guest: handled entirely by the debounced localSave below
      return
    }

    const { error } = await supabase
      .from('collections')
      .upsert(
        {
          user_id: userId,
          set_id: setId,
          card_id: cardId,
          quantity,
          updated_at: updatedAt,
        },
        { onConflict: 'user_id,set_id,card_id' },
      )

    if (error) {
      console.error('collectionStore.saveCard error:', error.message)
    }
  },

  // Bulk-replace the entire collection (used by Import).
  async saveAll(userId, state) {
    localSave(state)
    if (!userId) return

    const rows = stateToRows(state, userId)
    if (rows.length === 0) return

    // Delete existing rows first, then re-insert.
    // Simpler than diffing for an import operation.
    const { error: delError } = await supabase
      .from('collections')
      .delete()
      .eq('user_id', userId)

    if (delError) {
      console.error('collectionStore.saveAll delete error:', delError.message)
      return
    }

    const { error: insError } = await supabase
      .from('collections')
      .insert(rows)

    if (insError) {
      console.error('collectionStore.saveAll insert error:', insError.message)
    }
  },

  // Migrate any existing localStorage data up to Supabase on first login.
  // Call this once after a user signs in.
  async migrateLocalToSupabase(userId) {
    const local = localLoad()
    const hasData = Object.keys(local).length > 0
    if (!hasData) return

    // Check if user already has remote data — don't overwrite it.
    const { data } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (data && data.length > 0) return // remote already has data, skip

    await this.saveAll(userId, local)
    console.info('Migrated localStorage collection to Supabase.')
  },
}