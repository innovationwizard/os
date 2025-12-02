import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"

const title = "OCD – Opus Corpus Documenter"
const description = "AI-powered capture, routing, and kanban intelligence."
const imageUrl = "/og-brain.svg"
const iconUrl = "/brain.svg"

export const metadata: Metadata = {
  title,
  description,
  manifest: "/manifest.json",
  icons: {
    icon: iconUrl,
    shortcut: iconUrl,
    apple: iconUrl
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OCD"
  },
  openGraph: {
    title,
    description,
    siteName: "OCD",
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: "OCD – Opus Corpus Documenter"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [imageUrl]
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
