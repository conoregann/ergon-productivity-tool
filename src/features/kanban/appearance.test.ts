import { expect, it } from 'vitest'
import { labelTextColor } from './appearance'

it('keeps text readable on both dark and light custom label colours', () => {
  expect(labelTextColor('#125abc')).toBe('#ffffff')
  expect(labelTextColor('#244e3c')).toBe('#ffffff')
  expect(labelTextColor('#fff1dc')).toBe('#000000')
  expect(labelTextColor('#ffffff')).toBe('#000000')
})
