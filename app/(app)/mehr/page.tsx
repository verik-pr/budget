import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SignOutButton } from "./sign-out-button"
import Link from "next/link"
import { RefreshCw, Target, ChevronRight } from "lucide-react"

export default async function MehrPage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-black px-6 pt-16 pb-8">
        <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase mb-4">Konto</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-black font-black text-lg"
            style={{ backgroundColor: session?.user?.color || "#16a34a" }}>
            {session?.user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-white font-bold text-lg">{session?.user?.name}</p>
            <p className="text-zinc-500 text-sm">{session?.user?.email}</p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-6 space-y-3">
        <div className="bg-white rounded-3xl overflow-hidden">
          <Link href="/recurring" className="flex items-center gap-4 px-5 py-4 border-b border-gray-100">
            <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </div>
            <span className="text-sm font-semibold text-gray-900 flex-1">Regeln</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </Link>
          <Link href="/goals" className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
              <Target className="w-4 h-4 text-gray-600" />
            </div>
            <span className="text-sm font-semibold text-gray-900 flex-1">Sparziele</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </Link>
        </div>

        <div className="bg-white rounded-3xl overflow-hidden">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
