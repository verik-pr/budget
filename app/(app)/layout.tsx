import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SessionProvider } from "@/components/session-provider"
import { BottomNav } from "@/components/nav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        {children}
      </div>
      <BottomNav />
    </SessionProvider>
  )
}
