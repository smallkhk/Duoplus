import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import {
  Badge, ButtonLink, Card, Container, EmptyState, Input, Skeleton, cx,
} from '@/components/ui'
import { api, type KnowledgeArticle } from '@/lib/api'

/**
 * The knowledge base the assistant reads from.
 *
 * Both this page and the assistant's search tool are served by the same
 * endpoint, so what a customer reads here is what the assistant answers with.
 */
export function Knowledge() {
  const [articles, setArticles] = useState<KnowledgeArticle[] | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    api.knowledge()
      .then((d) => {
        setArticles(d.articles)
        setCategories(d.categories)
      })
      .catch(() => setArticles([]))
  }, [])

  const filtered = useMemo(() => {
    if (!articles) return null
    /* Match every word independently — "adb root" should find the ADB article. */
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return articles.filter((a) => {
      if (category && a.category !== category) return false
      if (terms.length === 0) return true
      const haystack = `${a.title} ${a.summary} ${a.tags.join(' ')} ${a.body}`.toLowerCase()
      return terms.every((t) => haystack.includes(t))
    })
  }, [articles, query, category])

  return (
    <>
      <div className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" />
        <Container className="relative py-20 text-center sm:py-24">
          <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-300">
            Knowledge base
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            How MADOVA works, written down
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[1.05rem] leading-relaxed text-ink-300">
            This is the same source the assistant answers from. If it is not in here, the assistant
            will tell you it does not know rather than invent something.
          </p>

          <div className="relative mx-auto mt-9 max-w-lg">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — billing, proxies, ADB, detection…"
              className="!h-12 pl-11 text-[0.95rem]"
              aria-label="Search the knowledge base"
            />
          </div>
        </Container>
      </div>

      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[15rem_1fr]">
          <nav className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-500">Categories</p>
            <ul className="mt-4 space-y-0.5">
              <li>
                <button
                  onClick={() => setCategory(null)}
                  className={cx(
                    'w-full rounded-lg px-3 py-2 text-left text-[0.83rem] transition-colors',
                    category === null ? 'bg-ink-800 text-ink-50' : 'text-ink-400 hover:text-ink-100',
                  )}
                >
                  All articles
                </button>
              </li>
              {categories.map((c) => (
                <li key={c}>
                  <button
                    onClick={() => setCategory(c)}
                    className={cx(
                      'w-full rounded-lg px-3 py-2 text-left text-[0.83rem] transition-colors',
                      category === c ? 'bg-ink-800 text-ink-50' : 'text-ink-400 hover:text-ink-100',
                    )}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>

            <Card className="mt-8 p-5">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
                <Icon name="sparkle" className="size-4" />
              </span>
              <p className="mt-3.5 text-[0.85rem] font-medium text-ink-100">Ask instead</p>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-400">
                The assistant reads all of this and can act on your fleet. Open it from the button in
                the corner.
              </p>
            </Card>
          </nav>

          <div className="min-w-0">
            {filtered === null ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="Nothing matched that search"
                body="Try a broader term, or ask the assistant — it can take a message for the team if the answer is not written down yet."
              />
            ) : (
              <>
                <p className="mb-4 text-[0.78rem] text-ink-500">
                  {filtered.length} article{filtered.length === 1 ? '' : 's'}
                  {category ? ` in ${category}` : ''}
                </p>
                <ul className="space-y-3">
                  {filtered.map((a) => {
                    const isOpen = openId === a.id
                    return (
                      <li key={a.id}>
                        <Card className={cx('overflow-hidden', isOpen && 'border-brand-500/40')}>
                          <button
                            onClick={() => setOpenId(isOpen ? null : a.id)}
                            aria-expanded={isOpen}
                            className="flex w-full items-start justify-between gap-5 p-6 text-left"
                          >
                            <span className="min-w-0">
                              <Badge tone="brand">{a.category}</Badge>
                              <span className="mt-3 block text-[1.05rem] font-semibold text-ink-50">{a.title}</span>
                              <span className="mt-1.5 block text-pretty text-[0.85rem] leading-relaxed text-ink-400">
                                {a.summary}
                              </span>
                            </span>
                            <Icon
                              name="chevronDown"
                              className={cx('mt-1 size-4 shrink-0 text-ink-500 transition-transform', isOpen && 'rotate-180 text-brand-300')}
                            />
                          </button>
                          <div className={cx('grid transition-all duration-300', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                            <div className="overflow-hidden">
                              <div className="border-t border-ink-800 px-6 py-5">
                                {a.body.split('\n\n').map((para, i) => (
                                  <p key={i} className="mb-3.5 whitespace-pre-line text-pretty text-[0.88rem] leading-relaxed text-ink-300 last:mb-0">
                                    {para}
                                  </p>
                                ))}
                                <div className="mt-5 flex flex-wrap gap-1.5 border-t border-ink-800 pt-4">
                                  {a.tags.map((t) => (
                                    <span key={t} className="rounded bg-ink-800 px-2 py-0.5 text-[0.68rem] text-ink-400">{t}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}

            <Card className="mt-8 flex flex-wrap items-center justify-between gap-5 p-7">
              <div>
                <h2 className="text-[1.05rem] font-semibold text-ink-50">Still stuck?</h2>
                <p className="mt-1.5 max-w-md text-[0.85rem] leading-relaxed text-ink-400">
                  Ask the assistant — it can hand the thread to a human, who replies within one
                  business day.
                </p>
              </div>
              <div className="flex gap-2.5">
                <ButtonLink to="/contact" variant="outline">Contact us</ButtonLink>
                <ButtonLink to="/register" iconRight="arrowRight">Start free</ButtonLink>
              </div>
            </Card>

            <p className="mt-6 text-center text-[0.78rem] text-ink-500">
              Still stuck?{' '}
              <Link to="/contact" className="text-brand-300 hover:text-brand-200">
                A person will answer within a few hours →
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </>
  )
}
