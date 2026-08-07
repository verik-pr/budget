import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SignOutButton } from "./sign-out-button"
import Link from "next/link"
import { RefreshCw, Target, ChevronRight, Users, CreditCard, PiggyBank, Bell, Tags } from "lucide-react"

export default async function MehrPage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-8 rounded-b-[32px]">
        <p className="kicker text-cream/40 mb-4">Konto</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-cream font-black text-lg ring-2 ring-cream/20"
            style={{ backgroundColor: session?.user?.color || "#16a34a" }}>
            {session?.user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="display text-cream text-xl">{session?.user?.name}</p>
            <p className="text-cream/45 text-sm">{session?.user?.email}</p>
          </div>
        </div>
      </div>

      <div className="stagger px-6 pt-6 space-y-3">
        <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
          <Link href="/budgets" className="flex items-center gap-4 px-5 py-4 border-b border-rule/60">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#22c55e20" }}>
              <PiggyBank className="w-4 h-4" style={{ color: "#22c55e" }} />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Budgets</span>
            <ChevronRight className="w-4 h-4 text-faint" />
          </Link>
          <Link href="/kategorien" className="flex items-center gap-4 px-5 py-4 border-b border-rule/60">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#f9731620" }}>
              <Tags className="w-4 h-4" style={{ color: "#f97316" }} />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Kategorien</span>
            <ChevronRight className="w-4 h-4 text-faint" />
          </Link>
          <Link href="/recurring" className="flex items-center gap-4 px-5 py-4 border-b border-rule/60">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#3b82f620" }}>
              <RefreshCw className="w-4 h-4" style={{ color: "#3b82f6" }} />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Regeln</span>
            <ChevronRight className="w-4 h-4 text-faint" />
          </Link>
          <Link href="/goals" className="flex items-center gap-4 px-5 py-4 border-b border-rule/60">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#ec489920" }}>
              <Target className="w-4 h-4" style={{ color: "#ec4899" }} />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Sparziele</span>
            <ChevronRight className="w-4 h-4 text-faint" />
          </Link>
          <Link href="/konto/konto_gemeinsam" className="flex items-center gap-4 px-5 py-4 border-b border-rule/60">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#8b5cf620" }}>
              <Users className="w-4 h-4" style={{ color: "#8b5cf6" }} />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Gemeinsames Konto</span>
            <ChevronRight className="w-4 h-4 text-faint" />
          </Link>
          <Link href="/kreditkarten" className="flex items-center gap-4 px-5 py-4 border-b border-rule/60">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#10b98120" }}>
              <CreditCard className="w-4 h-4" style={{ color: "#10b981" }} />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Kreditkarten</span>
            <ChevronRight className="w-4 h-4 text-faint" />
          </Link>
          <Link href="/notifications" className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#f59e0b20" }}>
              <Bell className="w-4 h-4" style={{ color: "#f59e0b" }} />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Notifications</span>
            <ChevronRight className="w-4 h-4 text-faint" />
          </Link>
        </div>

        <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
