'use client'

import { memo, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { SWRConfig } from 'swr'
import { swrConfig } from '../lib/fetcher'
import { AuthProvider } from '../contexts/AuthContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { ToastProvider } from '../components/ui/Toast'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import FloatingHelpButton from '../components/layout/FloatingHelpButton'
import i18n, { getStoredLocale, changeLanguage } from '../i18n'
import { useLocale } from '../hooks/useLocale'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

const StableGoogleProvider = memo(function StableGoogleProvider({ children }: { children: React.ReactNode }) {
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>
})

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { locale: currentLang } = useLocale()
  
  const isAdminRoute = pathname?.startsWith('/admin')
  const isMedecinRoute = pathname === '/medecin' || pathname?.startsWith('/medecin/')
  const isFocusedAuthRoute = pathname === '/login' || pathname === '/register'
  const isMapRoute = pathname === '/carte'
  const hideShell = isAdminRoute || isMedecinRoute || isFocusedAuthRoute || isMapRoute
  const isMessagingRoute = pathname === '/messages' || pathname?.startsWith('/patient/messages')
  const isCentresRoute = pathname === '/centres'

  useEffect(() => {
    const stored = getStoredLocale()
    if (stored !== i18n.language) {
      changeLanguage(stored)
    }
    document.documentElement.lang = stored
  }, [])

  return (
    // SWRConfig global : sans fetcher, `useSWR(clé)` ne déclenche AUCUNE
    // requête dans SWR 2 (data=undefined, isLoading=false, error=undefined).
    // Les composants hors layout (ex. /carte : MapsPanel, EtablissementDrawer)
    // ne passent pas de fetcher explicite, donc aucune donnée n'était
    // chargée : avis vide alors que l'en-tête affichait la note dénormalisée.
    <SWRConfig value={swrConfig}>
      <StableGoogleProvider>
        <AuthProvider key={currentLang}>
          <ToastProvider>
            {hideShell ? (
              children
            ) : (
              <NotificationProvider>
                <Navbar />
                <main className="flex-1 flex flex-col min-h-0">{children}</main>
                {!isMessagingRoute && !isCentresRoute && <Footer />}
                {!isCentresRoute && <FloatingHelpButton />}
              </NotificationProvider>
            )}
          </ToastProvider>
        </AuthProvider>
      </StableGoogleProvider>
    </SWRConfig>
  )
}
