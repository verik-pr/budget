import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SignOutButton } from "./sign-out-button"

export default async function MehrPage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 pt-14 pb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mehr</h1>
      </div>

      <div className="px-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-50">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-2"
              style={{ backgroundColor: session?.user?.color || "#6366f1" }}
            >
              {session?.user?.name?.[0]?.toUpperCase()}
            </div>
            <p className="font-semibold text-gray-900">{session?.user?.name}</p>
            <p className="text-sm text-gray-400">{session?.user?.email}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
