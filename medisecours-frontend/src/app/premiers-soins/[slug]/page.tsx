'use client'

import { use, useEffect, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import api from '@/api/axios'
import FirstAidDetailContent from '@/components/firstAid/FirstAidDetailContent'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { FirstAidProtocol } from '@/types/firstAid'

export default function FirstAidDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [protocol, setProtocol] = useState<FirstAidProtocol | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    api.get(`/api/public/first-aid-protocols/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (active) setProtocol(response.data)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [slug])

  if (loading) return <LoadingSpinner />
  if (error || !protocol) notFound()

  return <FirstAidDetailContent protocol={protocol} />
}
