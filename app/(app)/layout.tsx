import type { Viewport } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SessionProvider } from "@/components/session-provider"
import { BottomNav } from "@/components/nav"
import { ConfirmProvider } from "@/components/confirm-sheet"
import { ToastProvider } from "@/components/toast"

export const viewport: Viewport = {
  themeColor: "#000000",
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <SessionProvider session={session}>
      <ToastProvider>
        <ConfirmProvider>
          <div className="app-root">
            {children}
          </div>
          <BottomNav />
        </ConfirmProvider>
      </ToastProvider>
    </SessionProvider>
  )
}
