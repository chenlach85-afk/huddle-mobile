import { Link } from "wouter";
import { Zap, Users, Calendar, CheckSquare, MessageSquare, ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const FEATURES = [
  { icon: Users, label: "Team Management", desc: "Organize squads, track rosters, manage player info" },
  { icon: Calendar, label: "Smart Calendar", desc: "Schedule events, set reminders, track attendance" },
  { icon: CheckSquare, label: "Task Tracking", desc: "Assign and monitor tasks for every team member" },
  { icon: MessageSquare, label: "Team Messaging", desc: "Keep the whole squad in sync with team chat" },
];

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/6"
        style={{ background: "var(--surface-sidebar)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Zap className="h-5 w-5 text-white" fill="white" />
          </div>
          <span className="font-wordmark text-xl text-white">CLASIKO</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-white/70 hover:text-white">
              {t.auth.signIn}
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-primary hover:bg-primary/90 text-white font-semibold px-5">
              {t.auth.getStarted}
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-semibold">
          <Zap className="h-3.5 w-3.5" />
          Professional Coach Platform
        </div>

        <h1 className="font-wordmark text-6xl md:text-8xl text-white mb-6 leading-none">
          CLASIKO
        </h1>

        <p className="text-white/50 text-xl mb-10 max-w-xl mx-auto">
          {t.auth.tagline}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link href="/sign-up">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-bold text-base px-8 h-12 shadow-lg shadow-primary/30">
              {t.auth.getStarted}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/8 h-12 px-8">
              {t.auth.signIn}
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.label}
              className="rounded-2xl p-5 text-left border border-border"
              style={{ background: "var(--surface-card)" }}>
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">{f.label}</h3>
              <p className="text-white/45 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex items-center justify-center gap-2 text-white/30 text-sm">
          <Globe className="h-4 w-4" />
          <span>Available in English, Hebrew (עברית), and Spanish (Español)</span>
        </div>
      </main>
    </div>
  );
}
