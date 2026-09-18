import assert from 'node:assert/strict'
import { test } from 'node:test'
import { facilityMarkerHtml } from './facilityMarker.ts'

test('marker escapes facility names before inserting HTML', () => {
  const html = facilityMarkerHtml('#1a73e8', false, '<img src=x onerror="alert(1)">')
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;img'))
  assert.ok(html.includes('&quot;'))
})

test('marker rejects invalid color CSS and preserves selected size', () => {
  const html = facilityMarkerHtml('red;position:fixed', true, 'Centre')
  assert.ok(!html.includes('position:fixed'))
  assert.ok(html.includes('#1a73e8'))
  assert.ok(html.includes('width:30px'))
})
