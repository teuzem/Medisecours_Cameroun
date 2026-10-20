import assert from 'node:assert/strict'
import { test } from 'node:test'

import { imgSrcCandidates, pickPhotoSrc } from './config.ts'

test('une photo absente ne produit aucun candidat', () => {
  assert.deepEqual(imgSrcCandidates(null), [])
  assert.deepEqual(imgSrcCandidates(undefined), [])
  assert.deepEqual(imgSrcCandidates(''), [])
})

test('une URL absolue (avatar Google) est conservée telle quelle', () => {
  const google = 'https://lh3.googleusercontent.com/a/ACg8oc=s96-c'
  assert.deepEqual(imgSrcCandidates(google), [google])
})

test('un chemin applicatif passe d’abord par le proxy de même origine', () => {
  const candidats = imgSrcCandidates('/api/media_objects/12/download')
  assert.equal(candidats[0], '/api/media_objects/12/download')
})

test('un chemin sans slash initial est normalisé', () => {
  assert.equal(imgSrcCandidates('api/media_objects/12/download')[0], '/api/media_objects/12/download')
})

test('un candidat épuisé passe au suivant (proxy puis API directe)', () => {
  const candidats = ['/api/media_objects/12/download', 'https://api.example/api/media_objects/12/download']
  assert.equal(pickPhotoSrc(candidats, []), candidats[0])
  assert.equal(pickPhotoSrc(candidats, [candidats[0]]), candidats[1])
})

test('les initiales ne s’affichent qu’une fois tous les candidats épuisés', () => {
  const candidats = ['/api/media_objects/12/download', 'https://api.example/api/media_objects/12/download']
  assert.equal(pickPhotoSrc(candidats, candidats), null)
})
