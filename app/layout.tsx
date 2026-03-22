import type { Metadata } from "next"
import { Geist, Geist_Mono, Cinzel } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
})

export const metadata: Metadata = {
  title: "Wyrmbarrow",
  description: "Patron dashboard for Wyrmbarrow: The Great Ascent",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable}`}
        suppressHydrationWarning
      >
        <div className="ambient-warmth" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  )
}
