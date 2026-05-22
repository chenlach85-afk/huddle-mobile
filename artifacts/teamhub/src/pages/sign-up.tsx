import { Lock, Mail } from "lucide-react";
import { Link } from "wouter";

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background px-4"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(255,107,53,0.1) 0%, transparent 60%)" }}
    >
      <div className="w-full max-w-sm text-center space-y-6">
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.3)" }}
        >
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-white">Invitation Only</h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Huddle Pro is currently invite-only. Contact your team administrator to receive an invitation link.
          </p>
        </div>
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 text-start"
          style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)" }}
        >
          <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">
            Your admin will send you an invitation link via email. Click the link to accept and set up your account.
          </p>
        </div>
        <Link href="/sign-in">
          <button className="mt-2 text-sm text-primary hover:text-primary/80 underline underline-offset-4">
            Back to sign in
          </button>
        </Link>
      </div>
    </div>
  );
}
