import { describe, expect, it } from 'vitest'
import {
  defaultPreferences,
  interval,
  localInput,
  overlaps,
  toInstant,
  visibleDates,
} from './scheduling'

describe('timezone scheduling', () => {
  it('uses the selected timezone instead of the browser timezone', () => {
    expect(toInstant('2026-10-09T09:00', 'Europe/Dublin')).toBe(
      '2026-10-09T08:00:00.000Z',
    )
    expect(localInput('2026-10-09T08:00:00Z', 'Europe/Dublin')).toBe(
      '2026-10-09T09:00',
    )
    expect(toInstant('2026-01-09T09:00', 'Europe/Dublin')).toBe(
      '2026-01-09T09:00:00.000Z',
    )
    expect(toInstant('2026-10-09T09:00', 'Asia/Kathmandu')).toBe(
      '2026-10-09T03:15:00.000Z',
    )
  })
  it('rejects nonexistent and ambiguous DST times instead of silently shifting them', () => {
    expect(() => toInstant('2026-03-29T01:30', 'Europe/Dublin')).toThrow(
      'does not exist',
    )
    expect(() => toInstant('2026-10-25T01:30', 'Europe/Dublin')).toThrow(
      'occurs twice',
    )
    expect(() => toInstant('2026-02-30T09:00', 'UTC')).toThrow()
  })
  it('validates duration across DST and supports explicit UTC instants', () => {
    const result = interval(
      '2026-03-29T00:30',
      '2026-03-29T02:30',
      'Europe/Dublin',
    )
    expect(Date.parse(result.ends_at) - Date.parse(result.starts_at)).toBe(
      3600000,
    )
    expect(
      interval('2026-10-09T09:00:00Z', '2026-10-09T10:00:00Z').starts_at,
    ).toBe('2026-10-09T09:00:00.000Z')
    expect(() => interval('2026-10-09T09:00', '2026-10-09T09:00')).toThrow(
      'after',
    )
  })
  it('warns about actual overlaps, allowing adjacent intervals', () => {
    const a = interval('2026-10-09T09:00', '2026-10-09T10:00')
    expect(overlaps(a, interval('2026-10-09T09:30', '2026-10-09T10:30'))).toBe(
      true,
    )
    expect(overlaps(a, interval('2026-10-09T10:00', '2026-10-09T11:00'))).toBe(
      false,
    )
  })
  it('uses stored week starts and view, including year boundaries', () => {
    expect(visibleDates('2026-01-01', defaultPreferences)[0]).toBe('2025-12-29')
    expect(
      visibleDates('2026-01-01', {
        ...defaultPreferences,
        week_starts_on: 0,
      })[0],
    ).toBe('2025-12-28')
    expect(
      visibleDates('2026-01-01', {
        ...defaultPreferences,
        calendar_view: 'day',
      }),
    ).toEqual(['2026-01-01'])
  })
})
