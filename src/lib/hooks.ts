import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { callData } from './duoplus/client'
import type { CloudPhone, Paged, Proxy } from './duoplus/types'

/**
 * Page through the whole fleet.
 *
 * The list endpoint caps a page at 100, so screens that summarise the account
 * (dashboards, counters) walk the pages rather than reporting the first 100 as
 * if it were everything.
 */
export function useAllPhones(): { phones: CloudPhone[] | null; reload: () => void } {
  const [phones, setPhones] = useState<CloudPhone[] | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      const rows: CloudPhone[] = []
      let page = 1
      let pages = 1
      do {
        const data = await callData<Paged<CloudPhone>>('/api/v1/cloudPhone/list', { page, pagesize: 100 })
        rows.push(...data.list)
        pages = data.total_page
        page++
      } while (page <= pages && page <= 20)
      return rows
    }
    loadAll()
      .then((rows) => { if (!cancelled) setPhones(rows) })
      .catch(() => { if (!cancelled) setPhones([]) })
    return () => { cancelled = true }
  }, [nonce])

  return { phones, reload: useCallback(() => setNonce((n) => n + 1), []) }
}

/**
 * The proxies this account can bind. Read through MADOVA rather than the
 * device API directly, because with a provider configured the authoritative
 * list is the provider's and MADOVA is the one that knows which is in play.
 */
export function useProxies(): {
  proxies: Proxy[] | null
  /** True when the list comes from the provider and cannot be added to here. */
  managed: boolean
  reload: () => void
} {
  const [proxies, setProxies] = useState<Proxy[] | null>(null)
  const [managed, setManaged] = useState(false)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let cancelled = false
    api.proxies()
      .then((d) => { if (!cancelled) { setProxies(d.proxies); setManaged(d.managed) } })
      .catch(() => { if (!cancelled) setProxies([]) })
    return () => { cancelled = true }
  }, [nonce])
  return { proxies, managed, reload: useCallback(() => setNonce((n) => n + 1), []) }
}
