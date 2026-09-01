import { ButtonLink, Container } from '@/components/ui'
import { PhoneFrame } from '@/components/PhoneFrame'

export function NotFound() {
  return (
    <Container className="flex min-h-[60vh] items-center py-20">
      <div className="grid w-full items-center gap-12 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="font-mono text-[0.8rem] font-semibold tracking-widest text-brand-400">404</p>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
            This page was powered off
          </h1>
          <p className="mt-4 max-w-md text-pretty text-[0.95rem] leading-relaxed text-ink-300">
            The address you followed does not resolve to anything. The console and the API reference
            are both a click away.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/" iconRight="arrowRight">Back to the home page</ButtonLink>
            <ButtonLink to="/console" variant="outline">Open the console</ButtonLink>
          </div>
        </div>
        <PhoneFrame tone="off" className="mx-auto w-32" />
      </div>
    </Container>
  )
}
