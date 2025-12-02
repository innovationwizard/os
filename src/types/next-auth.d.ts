import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    name?: string
    role?: string
  }
  
  interface Session {
    user: {
      id: string
      name?: string
      role: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
  }
}