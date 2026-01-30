'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  Phone,
  StickyNote,
  LayoutDashboard,
  FileText,
  Mail,
  Calculator,
  ListTodo,
  Building2,
  Shield,
  Check,
  LogIn,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const GRADIENT_CLASSES = 'min-h-screen bg-gradient-to-br from-[#3b0764] via-[#5b21b6] to-[#4f46e5]'

const HERO_SLIDES = [
  {
    title: 'Pre-Sales CRM that keeps your team aligned',
    subtitle: 'One place for clients, reminders, offers, emails, accounting, and to-do lists. Built for small teams and cold-call workflows.',
  },
  {
    title: 'From first contact to closed deal',
    subtitle: 'Track interactions, set reminders, create offers, and never drop a follow-up again.',
  },
  {
    title: 'Simple. Fast. Secure.',
    subtitle: 'Organizations, permissions, and Row Level Security so your data stays where it belongs.',
  },
]

const FEATURES = [
  { icon: Users, title: 'Client management', description: 'Track presales and customers with contact info, status, source, and client type.' },
  { icon: Phone, title: 'Interactions', description: 'Log calls, emails, meetings, and other interactions with clients in one timeline.' },
  { icon: StickyNote, title: 'Notes & reminders', description: 'Pin notes per client and set follow-up reminders. View overdue and upcoming on the dashboard.' },
  { icon: LayoutDashboard, title: 'Dashboard', description: 'Overview of reminders, recent clients, and lead stats (new leads, waiting for offer).' },
  { icon: FileText, title: 'Offers', description: 'Create and manage offers per client. Optional payment links for customers.' },
  { icon: Mail, title: 'Emails', description: 'Templates, signatures, receive/send from the app. Link emails to clients.' },
  { icon: Calculator, title: 'Accounting', description: 'Link clients to accounting customers, track transactions, and import data.' },
  { icon: ListTodo, title: 'To-Do lists', description: 'List-first task management with projects, subtasks, time tracking, and shared lists.' },
  { icon: Building2, title: 'Organizations & permissions', description: 'Multi-tenant with role-based access: dashboard, clients, offers, emails, accounting, reminders, to-do, settings.' },
  { icon: Shield, title: 'Security', description: 'Supabase Auth, RLS, and organization-scoped data so teams only see their own.' },
]

const WHY_US = [
  'Built for pre-sales and small teams — no enterprise bloat.',
  'One place for clients, reminders, offers, emails, accounting, and to-do lists.',
  'Simple and fast: clear workflows for cold calls, follow-ups, and quick add.',
  'Organizations and permissions so you control who sees what.',
  'Secure by default with Row Level Security and scoped data.',
]

const PRICING_TIERS = [
  { title: 'Starter', description: 'For small teams getting started', points: ['Clients, reminders, dashboard', 'Notes & interactions', 'One organization'], cta: 'Contact us for pricing' },
  { title: 'Team', description: 'Full feature set for growing teams', points: ['Everything in Starter', 'Offers & payments', 'Emails, templates, signatures', 'Accounting & to-do lists', 'Role-based permissions'], cta: 'Contact us for pricing', highlight: true },
  { title: 'Enterprise', description: 'Custom needs and support', points: ['Everything in Team', 'Custom integrations', 'Dedicated support'], cta: 'Get in touch' },
]

function useScrollVisible() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

export function SitePageClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [heroIndex, setHeroIndex] = useState(0)
  const [featureIndex, setFeatureIndex] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)
  const featuresScroll = useScrollVisible()
  const whyScroll = useScrollVisible()
  const pricingScroll = useScrollVisible()

  useEffect(() => {
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [])

  const goToFeature = (dir: number) => {
    setFeatureIndex((i) => {
      const next = i + dir
      if (next < 0) return FEATURES.length - 1
      if (next >= FEATURES.length) return 0
      return next
    })
  }

  return (
    <div className={`relative flex flex-col overflow-x-hidden ${GRADIENT_CLASSES}`}>
      {/* Abstract blob shapes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-400/15 blur-3xl" />
        <div className="absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link href="/site" className="flex items-center gap-2 font-semibold text-white">
            <Image src="/hostado-logo.png" alt="Hostado GMS" width={28} height={28} className="rounded" />
            <span className="hidden sm:inline">Hostado GMS</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button asChild className="bg-white/20 text-white hover:bg-white/30">
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="bg-white/20 text-white hover:bg-white/30">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        {/* Hero slider */}
        <section className="relative py-16 md:py-24" ref={heroRef}>
          <div className="container relative px-4 text-center">
            <div className="relative min-h-[280px] md:min-h-[260px]">
              {HERO_SLIDES.map((slide, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ease-in-out ${
                    i === heroIndex ? 'opacity-100 translate-y-0 z-10' : 'opacity-0 translate-y-4 z-0 pointer-events-none'
                  }`}
                >
                  <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                    {slide.title}
                  </h1>
                  <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
                    {slide.subtitle}
                  </p>
                  <div className="mt-8">
                    {isAuthenticated ? (
                      <Button asChild size="lg" className="bg-white text-violet-900 hover:bg-white/90">
                        <Link href="/dashboard">Open app</Link>
                      </Button>
                    ) : (
                      <Button asChild size="lg" className="bg-white text-violet-900 hover:bg-white/90">
                        <Link href="/login">Sign in</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-center gap-2">
              {HERO_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === heroIndex ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Features slider */}
        <section
          id="features"
          ref={featuresScroll.ref}
          className={`relative py-16 md:py-20 transition-all duration-700 ease-out ${
            featuresScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="container px-4">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Features</h2>
            <p className="mt-2 text-white/80">Everything you need to manage presales and customers.</p>
            <div className="mt-10 flex items-stretch gap-4 overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => goToFeature(-1)}
                aria-label="Previous feature"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <div className="flex-1 overflow-hidden">
                {FEATURES.map(({ icon: Icon, title, description }, i) => (
                  <div
                    key={title}
                    className={`mx-auto max-w-md transition-all duration-500 ${
                      i === featureIndex ? 'block opacity-100' : 'hidden opacity-0'
                    }`}
                  >
                    <Card className="border-white/20 bg-white/10 backdrop-blur-sm">
                      <CardHeader>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white">
                          <Icon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-lg text-white">{title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-white/80">{description}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => goToFeature(1)}
                aria-label="Next feature"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
            <div className="mt-4 flex justify-center gap-1.5">
              {FEATURES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setFeatureIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === featureIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Feature ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Why Hostado GMS */}
        <section
          id="why-us"
          ref={whyScroll.ref}
          className={`relative py-16 md:py-20 transition-all duration-700 ease-out ${
            whyScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="container px-4">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Why Hostado GMS</h2>
            <p className="mt-2 text-white/80">Focused on what pre-sales teams actually need.</p>
            <ul className="mt-10 space-y-4">
              {WHY_US.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                  <span className="text-white/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          ref={pricingScroll.ref}
          className={`relative py-16 md:py-20 transition-all duration-700 ease-out ${
            pricingScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="container px-4">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Plans & pricing</h2>
            <p className="mt-2 text-white/80">Flexible options for teams of all sizes.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PRICING_TIERS.map((tier) => (
                <Card
                  key={tier.title}
                  className={`border-white/20 bg-white/10 backdrop-blur-sm ${tier.highlight ? 'ring-2 ring-white/40' : ''}`}
                >
                  <CardHeader>
                    <CardTitle className="text-white">{tier.title}</CardTitle>
                    <CardDescription className="text-white/70">{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm text-white/80">
                      {tier.points.map((p, i) => (
                        <li key={i}>• {p}</li>
                      ))}
                    </ul>
                    <p className="text-sm font-medium text-white">{tier.cta}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-white/70">
              Flexible plans per organization. Contact us to find the right fit.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 py-8">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <p className="text-sm text-white/80">© 2026 Hostado</p>
          <Link href="/login" className="text-sm font-medium text-white hover:underline">
            Login
          </Link>
        </div>
      </footer>
    </div>
  )
}
