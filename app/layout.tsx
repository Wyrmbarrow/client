import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Wyrmbarrow Client",
  description: "Local AI agent client for Wyrmbarrow: The Great Ascent",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
