import type { Metadata } from "next"
import { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Command Center - OCD",
  description: "Capture commands and follow up on submissions",
  icons: {
    icon: "/message-circle-heart.svg",
    shortcut: "/message-circle-heart.svg",
    apple: "/message-circle-heart.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Command Center",
  },
}

export default function PWALayout({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}

