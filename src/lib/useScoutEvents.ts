import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import type { ScoutEvent } from '~/lib/scouting'

const KEY = 'optix-scout-event'

const readStored = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/**
 * Loads all scouting events and tracks which one this device is scouting.
 * Defaults to the event marked active by leadership; a member's manual pick is
 * remembered per device so the match/pit/teams pages stay in sync.
 */
export function useScoutEvents() {
  const [events, setEvents] = useState<ScoutEvent[]>([])
  const [eventId, setEventIdState] = useState<string>('')
  const [loading, setLoading] = useState(true)

  async function reload() {
    const { data } = await supabase
      .from('scout_events')
      .select('*')
      .order('is_active', { ascending: false })
      .order('starts_on', { ascending: false, nullsFirst: false })
    const list = (data as ScoutEvent[]) || []
    setEvents(list)
    const stored = readStored()
    const pick = list.find((e) => e.id === stored) ?? list.find((e) => e.is_active) ?? list[0]
    setEventIdState(pick?.id ?? '')
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  function setEventId(id: string) {
    setEventIdState(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* private mode — selection just won't persist */
    }
  }

  const event = events.find((e) => e.id === eventId) ?? null
  return { events, event, eventId, setEventId, loading, reload }
}
