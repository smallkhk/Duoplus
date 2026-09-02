import { useCallback, useEffect, useState } from 'react'
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

export function useProxies(): { proxies: Proxy[] | null; reload: () => void } {
  const [proxies, setProxies] = useState<Proxy[] | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let cancelled = false
    callData<Paged<Proxy>>('/api/v1/proxy/list', { page: 1, pagesize: 100 })
      .then((d) => { if (!cancelled) setProxies(d.list) })
      .catch(() => { if (!cancelled) setProxies([]) })
    return () => { cancelled = true }
  }, [nonce])
  return { proxies, reload: useCallback(() => setNonce((n) => n + 1), []) }
}
