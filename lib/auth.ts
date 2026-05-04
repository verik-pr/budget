import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return { id: user.id, name: user.name, email: user.email, color: user.color }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) { token.id = user.id; token.color = (user as { color?: string }).color }
      return token
    },
    session: async ({ session, token }) => {
      if (token) {
        // Always resolve fresh user from DB so stale IDs after DB resets don't cause FK errors
        const fresh = await prisma.user.findUnique({ where: { email: session.user.email! } })
        session.user.id = fresh?.id ?? token.id as string
        session.user.color = fresh?.color ?? token.color as string
      }
      return session
    },
  },
  pages: { signIn: "/login" },
}
