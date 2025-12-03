import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"

const title = "OCD – Opus Corpus Documenter"
const description = "AI-Powered Creative Process Accelerator Engine, from Idea to Completion."
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://opuscorpus.vercel.app"
const imageUrl = `${baseUrl}/og-image.png`
const iconUrl = "/favicon-32x32.png"

export const metadata: Metadata = {
  title,
  description,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
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
