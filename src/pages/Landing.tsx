import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Compass,
  Image as ImageIcon,
  Images,
  Layers,
  Package,
  Puzzle,
  ScanSearch,
  Sparkles,
  SplitSquareHorizontal,
} from "lucide-react";
import logo from "@/assets/logo.svg";

const steps = [
  {
    icon: ClipboardList,
    title: "The brief goes in",
    text: "Meeting notes, decks, logos, mood shots — paste the whole thing, messy is fine.",
    bg: "bg-clay-blush",
    fg: "text-[#8a3b52]",
  },
  {
    icon: ScanSearch,
    title: "Agent reads for 3D",
    text: "It keeps stage sizes, layouts, materials, lighting and branding — and drops the rest.",
    bg: "bg-clay-butter",
    fg: "text-[#7c5a10]",
  },
  {
    icon: SplitSquareHorizontal,
    title: "Plan, chunk by chunk",
    text: "The scope is split into ordered build chunks, worked one at a time.",
    bg: "bg-clay-mint",
    fg: "text-[#1d5c44]",
  },
  {
    icon: Images,
    title: "Real-world references",
    text: "For every chunk the agent pulls reference images from the open web first.",
    bg: "bg-clay-sky",
    fg: "text-[#20506f]",
  },
  {
    icon: ImageIcon,
    title: "All sides, one sheet",
    text: "Pollinations.ai renders an infographic turnaround: front, side, top and 3/4.",
    bg: "bg-clay-lilac",
    fg: "text-[#4d3580]",
  },
  {
    icon: Package,
    title: "The full model sheet",
    text: "Chunk sheets stack into a master plan of the whole event for your 3D team.",
    bg: "bg-clay-coral",
    fg: "text-[#7c2d12]",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="clay-sm flex size-11 items-center justify-center rounded-2xl bg-white/80 p-2">
            <img src={logo} alt="Modelforge" className="size-full" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Modelforge
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/auth?returnTo=/dashboard"
            className="rounded-full px-4 py-2 text-sm font-bold text-foreground/80 transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/auth?returnTo=/dashboard"
            className="clay-sm rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Open Studio
          </Link>
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-10 pb-16 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="clay-sm inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-bold tracking-wide text-foreground/70 uppercase">
              <Sparkles className="size-3.5 text-clay-coral" />
              AI agent for event 3D teams
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] font-extrabold tracking-tight text-foreground sm:text-6xl">
              The briefing goes in.
              <br />
              The <span className="text-primary">3D model plan</span> comes
              out.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Modelforge is an AI agent built for event production companies.
              Feed it the whole event brief and it extracts only the 3D-relevant
              info, splits the build into chunks, pulls real references, and
              renders every side of the model — one image at a time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/auth?returnTo=/dashboard"
                className="clay group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display text-base font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
              >
                Try the agent
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#how"
                className="clay-sm inline-flex items-center gap-2 rounded-full bg-white/70 px-6 py-3 font-display text-base font-bold text-foreground transition-transform hover:-translate-y-0.5"
              >
                <Compass className="size-4 text-primary" />
                See how it works
              </a>
            </div>
          </motion.div>

          {/* Clay stage illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative mx-auto w-full max-w-md"
          >
            <div className="clay-lg clay-sheen relative aspect-square rounded-[2.5rem] bg-clay-blush/60">
              <div className="absolute top-10 left-10 flex size-16 items-center justify-center rounded-3xl bg-clay-coral clay-sm">
                <Layers className="size-7 text-white" />
              </div>
              <div className="absolute top-16 right-12 flex size-12 items-center justify-center rounded-2xl bg-clay-mint clay-sm">
                <Boxes className="size-6 text-white" />
              </div>
              <div className="absolute bottom-14 left-14 flex h-24 w-40 flex-col justify-center gap-2 rounded-3xl bg-white/85 px-5 clay-sm">
                <div className="h-2.5 w-24 rounded-full bg-clay-blush" />
                <div className="h-2.5 w-16 rounded-full bg-clay-sky" />
                <div className="h-2.5 w-20 rounded-full bg-clay-butter" />
              </div>
              <div className="absolute right-8 bottom-16 flex size-14 items-center justify-center rounded-2xl bg-clay-butter clay-sm">
                <Puzzle className="size-7 text-white" />
              </div>
              <div className="absolute top-1/2 left-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] bg-white clay">
                <Boxes className="size-12 text-primary" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="mx-auto w-full max-w-6xl px-5 py-16">
        <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
          <h2 className="text-center font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            One agent, six soft steps
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Version 1 does one thing end to end: turn an event brief into the
            reference sheets your 3D model needs. Nothing else.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              {...fadeUp}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              className="clay-sheen clay-sm group rounded-[1.8rem] bg-white/80 p-6 transition-transform hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex size-12 items-center justify-center rounded-2xl clay-sm ${step.bg} ${step.fg}`}
 >
                  <step.icon className="size-6" />
                </div>
                <span className="font-display text-2xl font-extrabold text-foreground/15">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-foreground">
                {step.title}
                </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.45 }}
          className="clay-lg clay-sheen relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-clay-coral to-clay-lilac px-8 py-14 text-center"
        >
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            Your next brief could be a model plan by lunch
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-medium text-white/90">
            Sign in, paste the brief, and watch the chunks come together one by
            one.
          </p>
          <Link
            to="/auth?returnTo=/dashboard"
            className="clay mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 font-display text-base font-extrabold text-[#7c2d12] transition-transform hover:-translate-y-0.5"
          >
            Open the studio
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="pb-10 text-center text-sm text-muted-foreground">
        Modelforge — an AI agent that turns event briefs into 3D model plans.
      </footer>
    </div>
  );
}
