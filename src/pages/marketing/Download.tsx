import { Icon } from '@/components/Icon'
import { Badge, Button, Card, Container, Section, SectionHeading, Code } from '@/components/ui'

const BUILDS = [
  { os: 'Windows', detail: 'Windows 10 / 11 · x64 · 118 MB', version: '3.8.2', icon: 'monitor' },
  { os: 'macOS', detail: 'macOS 13+ · Apple silicon & Intel · 126 MB', version: '3.8.2', icon: 'monitor' },
  { os: 'Android', detail: 'Android 9+ · APK · 34 MB', version: '3.8.0', icon: 'phone' },
]

const CHANGELOG = [
  { v: '3.8.2', date: '2026-08-28', notes: ['Group control now applies coordinate jitter per device', 'Fixed ADB reconnect after a proxy swap', 'Cloud drive uploads resume after a dropped connection'] },
  { v: '3.8.0', date: '2026-08-06', notes: ['Live stream relay reads directly from the cloud drive', 'Bulk fingerprint rewrite from CSV', 'Console keyboard shortcuts for power actions'] },
  { v: '3.7.4', date: '2026-07-15', notes: ['Sub-account quota warnings at 80% and 95%', 'Reduced control latency on the Singapore and Tokyo regions'] },
]

export function Download() {
  return (
    <>
      <div className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" />
        <Container className="relative py-20 text-center sm:py-24">
          <Badge tone="brand">Version 3.8.2</Badge>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            The console runs in your browser. The apps are for when you want more.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[1.05rem] leading-relaxed text-ink-300">
            Nothing here is required — every feature works from a browser tab on desktop or mobile.
            The native builds add local ADB bridging, hardware-accelerated multi-window streaming and
            drag-and-drop file push.
          </p>
        </Container>
      </div>

      <Section>
        <div className="grid gap-4 lg:grid-cols-3">
          {BUILDS.map((b) => (
            <Card key={b.os} className="flex flex-col p-7" hover>
              <span className="grid size-11 place-items-center rounded-xl bg-ink-800 text-brand-300">
                <Icon name={b.icon} className="size-5" />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-ink-50">{b.os}</h2>
              <p className="mt-1.5 flex-1 text-[0.82rem] text-ink-400">{b.detail}</p>
              <p className="mt-4 font-mono text-[0.72rem] text-ink-500">v{b.version}</p>
              <Button className="mt-5 w-full" icon="download">Download for {b.os}</Button>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-[0.78rem] text-ink-500">
          Downloads are illustrative in this build — no installer is served.
        </p>
      </Section>

      <div className="border-y border-ink-800 bg-ink-900/30">
        <Section>
          <div className="grid gap-12 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <SectionHeading
                eyebrow="Command line"
                title="Or skip the GUI entirely"
                lead="The CLI wraps the same API the console uses. Install it once and drive the fleet from a terminal or a CI job."
              />
              <div className="mt-8 space-y-3">
                <Code>{`npm install -g @madova/cli
madova auth login --key $MADOVA_KEY
madova phones list --status powered-on
madova phones power-on --group "TikTok US"
madova adb run --group "TikTok US" -- "input keyevent 3"`}</Code>
              </div>
            </div>
            <div>
              <SectionHeading eyebrow="Changelog" title="What shipped recently" />
              <ol className="mt-8 space-y-6">
                {CHANGELOG.map((c) => (
                  <li key={c.v} className="border-l-2 border-ink-700 pl-5">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[0.9rem] font-semibold text-ink-50">v{c.v}</span>
                      <span className="font-mono text-[0.72rem] text-ink-500">{c.date}</span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {c.notes.map((n) => (
                        <li key={n} className="text-[0.83rem] leading-relaxed text-ink-400">— {n}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Section>
      </div>
    </>
  )
}
