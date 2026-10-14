import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

/**
 * Garde-fou : sans fetcher, `useSWR(clé)` ne lance AUCUNE requête dans SWR 2
 * (data=undefined, isLoading=false, error=undefined). Les composants de la
 * carte n'héritent d'aucun layout fournissant un SWRConfig, ils dépendaient
 * donc d'un provider global : les avis ne se chargeaient jamais (liste vide
 * alors que l'en-tête affichait la note dénormalisée).
 */
const appDir = fileURLToPath(new URL('../app/', import.meta.url))
const carteDir = fileURLToPath(new URL('../components/carte/', import.meta.url))

const providers = readFileSync(join(appDir, 'providers.tsx'), 'utf8')

test('the global providers mount SWRConfig with the axios fetcher', () => {
  assert.match(providers, /<SWRConfig\s+value=\{swrConfig\}/, 'providers.tsx must wrap the app in <SWRConfig value={swrConfig}>')
  assert.match(providers, /import\s*\{\s*swrConfig\s*\}\s*from\s*'\.\.\/lib\/fetcher'/, 'providers.tsx must import swrConfig from lib/fetcher')
})

test('swrConfig actually exposes a fetcher', () => {
  const fetcherModule = readFileSync(fileURLToPath(new URL('./fetcher.ts', import.meta.url)), 'utf8')
  assert.match(fetcherModule, /export\s+async\s+function\s+fetcher/, 'lib/fetcher.ts must export a fetcher')
  assert.match(fetcherModule, /export\s+const\s+swrConfig\s*=\s*\{[\s\S]*?fetcher,/, 'swrConfig must reference the fetcher')
})

test('review hooks in the carte tree opt out of the global dedupe window', () => {
  const files = readdirSync(carteDir).filter((name) => name.endsWith('.tsx'))
  const sources = files.map((name) => [name, readFileSync(join(carteDir, name), 'utf8')])

  const reviewHooks = sources.filter(([, source]) =>
    source.includes('/api/etablissements/') && source.includes('avis'),
  )
  assert.ok(reviewHooks.length > 0, 'expected at least one component reading the dedicated reviews endpoint')

  for (const [name, source] of reviewHooks) {
    const hookCalls = source.match(/useSWR<[^>]*>\([\s\S]*?\n\s*\)/g) ?? []
    for (const call of hookCalls) {
      if (!call.includes('/api/etablissements/')) continue
      assert.match(
        call,
        /dedupingInterval:\s*0/,
        `${name}: a reviews hook polling faster than the 120s global dedupe window must set dedupingInterval: 0`,
      )
    }
  }
})