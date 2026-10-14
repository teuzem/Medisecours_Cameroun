import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractAvisList } from './api.ts'

const review = (id, note = 5) => ({
  id,
  note,
  commentaire: `Super établissement ${id}`,
  statut: 'PUBLIE',
  auteurNom: 'Patient Test',
  createdAt: '2026-10-01T10:00:00+00:00',
  images: [],
})

test('extracts the dedicated envelope {items, total, page}', () => {
  const payload = { items: [review(1), review(2)], total: 2, page: 1 }
  const list = extractAvisList(payload)
  assert.equal(list.length, 2)
  assert.equal(list[0].id, 1)
})

test('regression: five published reviews are never collapsed to empty', () => {
  const payload = {
    items: [review(1, 5), review(2, 5), review(3, 5), review(4, 5), review(5, 4)],
    total: 5,
    page: 1,
  }
  const list = extractAvisList(payload)
  assert.equal(list.length, 5)
  assert.deepEqual(
    list.map((item) => item.note),
    [5, 5, 5, 5, 4],
  )
})

test('keeps legacy Hydra and member envelopes working', () => {
  assert.deepEqual(extractAvisList({ member: [review(1)] }).map((r) => r.id), [1])
  assert.deepEqual(extractAvisList({ 'hydra:member': [review(2)] }).map((r) => r.id), [2])
  assert.deepEqual(extractAvisList([review(3)]).map((r) => r.id), [3])
})

test('never returns nullish or non-array values', () => {
  for (const bad of [null, undefined, {}, { items: null }, { member: 'x' }, 42, 'oops']) {
    assert.deepEqual(extractAvisList(bad), [])
  }
})

test('preserves full media payloads (provider, embed, thumbnail)', () => {
  const withVideo = {
    ...review(9),
    images: [
      {
        id: 31,
        contentUrl: 'https://www.youtube.com/watch?v=abc123DEFGH',
        mimeType: 'video/youtube',
        kind: 'video',
        provider: 'youtube',
        externalUrl: 'https://www.youtube.com/watch?v=abc123DEFGH',
        embedUrl: 'https://www.youtube.com/embed/abc123DEFGH',
        thumbnailUrl: 'https://i.ytimg.com/vi/abc123DEFGH/hqdefault.jpg',
      },
    ],
  }
  const [only] = extractAvisList({ items: [withVideo], total: 1, page: 1 })
  assert.equal(only.images[0].embedUrl, 'https://www.youtube.com/embed/abc123DEFGH')
  assert.equal(only.images[0].provider, 'youtube')
})
