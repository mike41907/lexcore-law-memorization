import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup'

describe('parseBackup', () => {
  it('rejects unrelated JSON', () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow('LexCore')
  })

  it('validates a complete backup envelope', () => {
    const backup = { format: 'lexcore-backup', version: '0.1.0', exportedAt: '2026-08-02T00:00:00.000Z', settings: { id: 'settings' }, progress: { id: 'progress' }, laws: [], articles: [], sections: [], sessions: [], answers: [], errors: [], reviews: [], mastery: [], tasks: [], achievements: [], confusions: [] }
    expect(parseBackup(JSON.stringify(backup)).format).toBe('lexcore-backup')
  })
})
