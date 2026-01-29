import { expect, test } from 'vitest'
import { formatMoney } from '../format'

test('formats money correctly', () => {
  expect(formatMoney(100)).toBe('PKR 100.00')
  expect(formatMoney(1234.56)).toBe('PKR 1,234.56')
  expect(formatMoney(0)).toBe('PKR 0.00')
  expect(formatMoney(-500)).toBe('-PKR 500.00')
})
