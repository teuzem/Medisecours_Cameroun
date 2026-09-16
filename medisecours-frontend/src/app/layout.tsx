import "./globals.css"
import Providers from "./providers"
import ThemeInit from "../components/ui/ThemeInit"

export const metadata = {
  title: "MediSecours+ | Les premiers gestes qui sauvent",
  description: "Plateforme médicale d'urgence pour le Cameroun : premiers soins, centres de santé, messagerie médecins.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className="h-dvh antialiased"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col">
        <ThemeInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
