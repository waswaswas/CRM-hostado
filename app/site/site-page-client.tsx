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
  ArrowUp,
  Quote,
} from 'lucide-react'

const NEON_GREEN = 'bg-[#22c55e] text-white hover:bg-[#16a34a]'
const BG_DARK = 'bg-[#0A061B]'

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

/* First 4 cards for the “Breaking away” slider: To do list, Insights, Expenses, Dashboard */
const FEATURE_CARDS = [
  { icon: ListTodo, title: 'To do list', description: 'List-first task management with projects, subtasks, time tracking, and shared lists.' },
  { icon: LayoutDashboard, title: 'Insights', description: 'Overview of reminders, recent clients, and lead stats (new leads, waiting for offer).' },
  { icon: Calculator, title: 'Expenses', description: 'Link clients to accounting customers, track transactions, and import data.' },
  { icon: LayoutDashboard, title: 'Dashboard', description: 'One place for reminders, clients, offers, and quick actions.' },
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

const STATS = [
  { value: 'Clients', label: 'Track presales & customers' },
  { value: 'Reminders', label: 'Never miss a follow-up' },
  { value: 'Offers', label: 'Create & send proposals' },
  { value: 'Teams', label: 'Organizations & permissions' },
]

const TESTIMONIALS = [
  { quote: 'Hostado GMS made our pre-sales process so much smoother. Everything in one place.', author: 'Team Lead', company: 'Sales Team' },
  { quote: 'Simple, fast, and the reminders keep us on track. Exactly what we needed.', author: 'Account Manager', company: 'Hostado' },
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
  const [testimonialIndex, setTestimonialIndex] = useState(0)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const featuresScroll = useScrollVisible()
  const statsScroll = useScrollVisible()
  const whyScroll = useScrollVisible()
  const pricingScroll = useScrollVisible()
  const testimonialsScroll = useScrollVisible()
  const ctaScroll = useScrollVisible()

  useEffect(() => {
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const goToFeature = (dir: number) => {
    setFeatureIndex((i) => {
      const next = i + dir
      const max = Math.max(0, FEATURE_CARDS.length - 3)
      if (next < 0) return max
      if (next > max) return 0
      return next
    })
  }

  return (
    <div className={`relative min-h-screen flex flex-col overflow-x-hidden ${BG_DARK}`}>
      {/* Subtle blue gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0A061B]/90 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-4 px-4">
          <Link href="/site" className="flex shrink-0 items-center gap-2 font-semibold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22c55e]">
              <Image src="/hostado-logo.png" alt="Hostado GMS" width={20} height={20} className="rounded object-contain" />
            </span>
            <span className="hidden sm:inline">Hostado GMS</span>
          </Link>
          <nav className="hidden flex-1 justify-center gap-8 md:flex">
            <Link href="/site#features" className="text-sm text-white/90 hover:text-white">Product</Link>
            <Link href="/site#why-us" className="text-sm text-white/90 hover:text-white">Company</Link>
            <Link href="/site#pricing" className="text-sm text-white/90 hover:text-white">Help</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {isAuthenticated ? (
              <Button asChild className={`rounded-lg px-4 py-2 font-semibold shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98] ${NEON_GREEN}`}>
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild className={`rounded-lg px-4 py-2 font-semibold shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98] ${NEON_GREEN}`}>
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
        {/* Hero – strong blue gradient (lighter top → darker bottom) + illustration */}
        <section className="relative bg-gradient-to-b from-blue-400/25 via-blue-600/20 to-blue-900/30 py-16 md:py-24 transition-all duration-500" ref={heroRef}>
          <div className="container relative px-4 text-center">
            <div className="relative min-h-[260px] md:min-h-[240px]">
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
                  <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
                    {slide.subtitle}
                  </p>
                  <div className="mt-8">
                    {isAuthenticated ? (
                      <Button asChild size="lg" className={`rounded-lg font-semibold shadow-lg ${NEON_GREEN}`}>
                        <Link href="/dashboard">Open app</Link>
                      </Button>
                    ) : (
                      <Button asChild size="lg" className={`rounded-lg font-semibold shadow-lg ${NEON_GREEN}`}>
                        <Link href="/login">Get started</Link>
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
                    i === heroIndex ? 'w-8 bg-[#22c55e]' : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            {/* Hero illustration: shield, lock, computer, servers */}
            <div className="relative mx-auto mt-12 flex max-w-4xl justify-center">
              <div className="relative h-48 w-full md:h-56">
                <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-gradient-to-br from-blue-500/40 to-blue-800/50 flex items-center justify-center shadow-xl">
                  <Shield className="h-12 w-12 text-white/90" />
                </div>
                <div className="absolute left-[15%] top-[20%] flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/40 text-white/90">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div className="absolute right-[15%] top-[25%] flex h-16 w-16 items-center justify-center rounded-xl bg-blue-500/40 text-white/90">
                  <LayoutDashboard className="h-8 w-8" />
                </div>
                <div className="absolute bottom-[10%] left-[20%] h-8 w-12 rounded-lg bg-blue-700/50" />
                <div className="absolute bottom-[10%] left-[35%] h-10 w-10 rounded-lg bg-blue-600/50" />
                <div className="absolute bottom-[10%] right-[35%] h-8 w-12 rounded-lg bg-blue-700/50" />
                <div className="absolute bottom-[10%] right-[20%] h-10 w-10 rounded-lg bg-blue-600/50" />
              </div>
            </div>
          </div>
        </section>

        {/* Section: Pre-sales awareness (heading + dots) */}
        <section className="relative py-8 md:py-10">
          <div className="container flex flex-wrap items-center justify-between gap-4 px-4">
            <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">
              Pre-sales awareness
            </h2>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-white/40" aria-hidden />
              ))}
            </div>
          </div>
        </section>

        {/* Breaking away from the pack – two horizontal blocks */}
        <section className="relative py-8 md:py-12">
          <div className="container px-4">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 md:flex-row md:items-start">
                <div className="h-32 w-32 shrink-0 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-700/40 flex items-center justify-center ring-4 ring-white/10">
                  <Users className="h-12 w-12 text-white/80" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Breaking away from the pack</h3>
                  <p className="mt-2 text-sm text-white/70">
                    Stand out with a CRM built for pre-sales: clients, reminders, offers, and to-do lists in one place. No enterprise bloat.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 md:flex-row md:items-start">
                <div className="h-32 w-32 shrink-0 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-700/40 flex items-center justify-center ring-4 ring-white/10">
                  <LayoutDashboard className="h-12 w-12 text-white/80" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">Breaking away from the pack</h3>
                  <p className="mt-2 text-sm text-white/70">
                    One place for your team: dashboard, clients, offers, emails, accounting, and shared to-do lists. Get started in minutes.
                  </p>
                  <div className="mt-4">
                    {isAuthenticated ? (
                      <Button asChild className={`rounded-lg font-semibold ${NEON_GREEN}`}>
                        <Link href="/dashboard">Go to Dashboard</Link>
                      </Button>
                    ) : (
                      <Button asChild className={`rounded-lg font-semibold ${NEON_GREEN}`}>
                        <Link href="/login">Learn more</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats – blue gradient block */}
        <section
          ref={statsScroll.ref}
          className={`relative py-16 md:py-20 transition-all duration-1000 ease-out ${
            statsScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionProperty: 'opacity, transform' }}
        >
          <div className="container px-4">
            <div className="rounded-2xl bg-gradient-to-r from-blue-500/30 via-blue-600/25 to-blue-800/30 p-8 md:p-12">
              <h2 className="text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
                Results that matter
              </h2>
              <p className="mt-2 text-center text-white/80">Everything you need to run pre-sales in one place.</p>
              <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
                {STATS.map(({ value, label }) => (
                  <div key={value} className="text-center">
                    <p className="text-2xl font-bold text-white md:text-3xl">{value}</p>
                    <p className="mt-1 text-sm text-white/70">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Breaking away from the pack – feature cards (3 visible) */}
        <section
          id="features"
          ref={featuresScroll.ref}
          className={`relative py-16 md:py-20 transition-all duration-1000 ease-out ${
            featuresScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionProperty: 'opacity, transform' }}
        >
          <div className="container px-4">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Breaking away from the pack</h2>
            <p className="mt-2 text-white/80">Everything you need to manage presales and customers.</p>
            <div className="mt-10 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full border border-white/20 bg-white/5 text-white transition-transform hover:bg-white/10 hover:scale-110"
                onClick={() => goToFeature(-1)}
                aria-label="Previous features"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
                {[0, 1, 2].map((offset) => {
                  const i = featureIndex + offset
                  if (i >= FEATURE_CARDS.length) return null
                  const { icon: Icon, title, description } = FEATURE_CARDS[i]
                  return (
                    <Card
                      key={`${title}-${i}`}
                      className="border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-500 hover:bg-white/10"
                    >
                      <CardHeader>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#22c55e]/20 text-[#22c55e]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-lg text-white">{title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-white/70">{description}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full border border-white/20 bg-white/5 text-white transition-transform hover:bg-white/10 hover:scale-110"
                onClick={() => goToFeature(1)}
                aria-label="Next features"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
            <div className="mt-6 flex justify-center gap-1.5">
              {Array.from({ length: Math.max(1, FEATURE_CARDS.length - 2) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setFeatureIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === featureIndex ? 'w-6 bg-[#22c55e]' : 'w-1.5 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Why Hostado GMS */}
        <section
          id="why-us"
          ref={whyScroll.ref}
          className={`relative py-16 md:py-20 transition-all duration-1000 ease-out ${
            whyScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionProperty: 'opacity, transform' }}
        >
          <div className="container px-4">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Why Hostado GMS</h2>
            <p className="mt-2 text-white/80">Focused on what pre-sales teams actually need.</p>
            <ul className="mt-10 space-y-4">
              {WHY_US.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#22c55e]" />
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
          className={`relative py-16 md:py-20 transition-all duration-1000 ease-out ${
            pricingScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionProperty: 'opacity, transform' }}
        >
          <div className="container px-4">
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Plans & pricing</h2>
            <p className="mt-2 text-white/80">Flexible options for teams of all sizes.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PRICING_TIERS.map((tier) => (
                <Card
                  key={tier.title}
                  className={`border-white/10 bg-white/5 backdrop-blur-sm ${tier.highlight ? 'ring-2 ring-[#22c55e]/50' : ''}`}
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

        {/* Testimonials */}
        <section
          id="testimonials"
          ref={testimonialsScroll.ref}
          className={`relative py-16 md:py-20 transition-all duration-1000 ease-out ${
            testimonialsScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionProperty: 'opacity, transform' }}
        >
          <div className="container px-4">
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                People are loving using our software
              </h2>
              <div className="flex gap-1">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setTestimonialIndex(i)}
                    className={`h-2 w-2 rounded-full transition-all ${
                      i === testimonialIndex ? 'bg-[#22c55e] scale-125' : 'bg-white/40 hover:bg-white/60'
                    }`}
                    aria-label={`Testimonial ${i + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {TESTIMONIALS.map((t, i) => (
                <Card key={i} className="border-white/10 bg-white/5 backdrop-blur-sm">
                  <CardContent className="pt-6">
                    <Quote className="mb-2 h-8 w-8 text-[#22c55e]/60" />
                    <p className="text-white/90">{t.quote}</p>
                    <p className="mt-4 text-sm font-medium text-white">{t.author}</p>
                    <p className="text-xs text-white/60">{t.company}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA – headline left, illustration right */}
        <section
          ref={ctaScroll.ref}
          className={`relative py-16 md:py-20 transition-all duration-1000 ease-out ${
            ctaScroll.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionProperty: 'opacity, transform' }}
        >
          <div className="container px-4">
            <div className="rounded-2xl bg-gradient-to-r from-blue-500/20 to-blue-700/20 p-10 md:p-16">
              <div className="flex flex-col items-center justify-between gap-10 md:flex-row md:items-center">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    Get started with Hostado GMS today
                  </h2>
                  <p className="mt-2 text-white/80">One place for clients, reminders, offers, and more.</p>
                  <div className="mt-6">
                    {isAuthenticated ? (
                      <Button asChild size="lg" className={`rounded-lg font-semibold shadow-lg ${NEON_GREEN}`}>
                        <Link href="/dashboard">Open app</Link>
                      </Button>
                    ) : (
                      <Button asChild size="lg" className={`rounded-lg font-semibold shadow-lg ${NEON_GREEN}`}>
                        <Link href="/login">Get started</Link>
                      </Button>
                    )}
                  </div>
                </div>
                {/* Illustration: abstract shapes (folders, docs, shield) */}
                <div className="relative h-48 w-64 shrink-0 md:h-56 md:w-80">
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-blue-500/10">
                    <Shield className="h-16 w-16 text-white/40" />
                  </div>
                  <div className="absolute -left-4 top-4 h-12 w-14 rounded-lg bg-white/10 rotate-[-8deg]" />
                  <div className="absolute -right-2 top-8 h-10 w-12 rounded-lg bg-white/10 rotate-[6deg]" />
                  <div className="absolute bottom-6 left-2 h-8 w-10 rounded bg-white/10 rotate-[-4deg]" />
                  <div className="absolute bottom-8 right-4 h-10 w-12 rounded-lg bg-white/10 rotate-[3deg]" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 py-12">
        <div className="container px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22c55e]">
                  <Image src="/hostado-logo.png" alt="Hostado" width={18} height={18} className="rounded object-contain" />
                </span>
                Hostado GMS
              </div>
              <p className="mt-2 text-sm text-white/70">© 2026 Hostado</p>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Product</p>
              <ul className="mt-2 space-y-1 text-sm text-white/70">
                <li><Link href="/site#features" className="hover:text-white">Features</Link></li>
                <li><Link href="/site#pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/site#why-us" className="hover:text-white">Why us</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Company</p>
              <ul className="mt-2 space-y-1 text-sm text-white/70">
                <li><Link href="/site" className="hover:text-white">About</Link></li>
                <li><Link href="/login" className="hover:text-white">Login</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Help</p>
              <ul className="mt-2 space-y-1 text-sm text-white/70">
                <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
                <li><Link href="/site#pricing" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to top */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-500"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}
