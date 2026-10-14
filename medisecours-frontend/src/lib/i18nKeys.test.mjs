import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

/**
 * Toute clé `t('...')` absente des ressources s'affiche littéralement dans
 * l'interface (« visitor.carte.reviewsCount »). Ce test verrouille l'inventaire
 * des clés réellement utilisées par le code.
 */
const srcDir = fileURLToPath(new URL('../', import.meta.url))
const localesDir = join(srcDir, 'i18n/locales')

function loadJson(...parts) {
  return JSON.parse(readFileSync(join(localesDir, ...parts), 'utf8'))
}

function buildResources(lang) {
  const visitor = loadJson(lang, 'visitor.json')
  return {
    ...loadJson(`${lang}.json`),
    ...loadJson(lang, 'admin.json'),
    ...loadJson(lang, 'medecin.json'),
    ...loadJson(lang, 'patient.json'),
    ...loadJson(lang, 'personnel.json'),
    ...visitor,
    etablissement: visitor.visitor.etablissement,
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'i18n') continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const lookup = (obj, path) => path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj)

// i18next v26 : t('key', { count }) résout key_one / key_other.
const resolves = (obj, key) => {
  const base = key.replace(/_(zero|one|two|few|many|other)$/, '')
  if (lookup(obj, base) !== undefined) return true
  return ['_zero', '_one', '_two', '_few', '_many', '_other'].some((suffix) => lookup(obj, `${base}${suffix}`) !== undefined)
}

const usedKeys = new Map()
for (const file of walk(srcDir)) {
  const source = readFileSync(file, 'utf8')
  for (const [, key] of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    if (!usedKeys.has(key)) usedKeys.set(key, new Set())
    usedKeys.get(key).add(file.slice(srcDir.length))
  }
}

for (const lang of ['fr', 'en']) {
  test(`toutes les clés utilisées par le code existent en "${lang}"`, () => {
    const resources = buildResources(lang)
    const missing = [...usedKeys.entries()]
      .filter(([key]) => !resolves(resources, key))
      .map(([key, files]) => `  ${key} (${[...files].join(', ')})`)
    assert.equal(missing.length, 0, `Clés manquantes en ${lang} :\n${missing.join('\n')}`)
  })
}

test('les deux langues exposent les mêmes clés de carte', () => {
  const fr = buildResources('fr').visitor.carte
  const en = buildResources('en').visitor.carte
  const frKeys = new Set(Object.keys(fr))
  const enKeys = new Set(Object.keys(en))
  const onlyFr = [...frKeys].filter((key) => !enKeys.has(key))
  const onlyEn = [...enKeys].filter((key) => !frKeys.has(key))
  assert.equal(onlyFr.length, 0, `Clés présentes seulement en fr : ${onlyFr.join(', ')}`)
  assert.equal(onlyEn.length, 0, `Clés présentes seulement en en : ${onlyEn.join(', ')}`)
})