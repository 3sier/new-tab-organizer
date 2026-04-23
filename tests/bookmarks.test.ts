import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeUrl } from '../src/lib/bookmarks.ts'

test('normalizeUrl añade https a dominios sin esquema', () => {
  assert.equal(normalizeUrl('youtube.com'), 'https://youtube.com/')
})

test('normalizeUrl acepta localhost sin esquema', () => {
  assert.equal(normalizeUrl('localhost:3000'), 'https://localhost:3000/')
})

test('normalizeUrl conserva URLs de Brave con esquema propio', () => {
  assert.equal(normalizeUrl('brave://bookmarks/'), 'brave://bookmarks/')
})

test('normalizeUrl conserva URLs válidas sin // como mailto', () => {
  assert.equal(normalizeUrl('mailto:test@example.com'), 'mailto:test@example.com')
})

test('normalizeUrl acepta ftp sin doble slash', () => {
  assert.equal(normalizeUrl('ftp:example.com'), 'ftp://example.com/')
})

test('normalizeUrl rechaza javascript por seguridad', () => {
  assert.equal(normalizeUrl('javascript:alert(1)'), '')
})

test('normalizeUrl rechaza esquemas web mal formados con una sola barra', () => {
  assert.equal(normalizeUrl('https:/example.com'), '')
  assert.equal(normalizeUrl('http:/example.com'), '')
})
