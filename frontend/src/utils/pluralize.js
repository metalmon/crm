/**
 * Returns plural form category for Slavic languages (Russian, Ukrainian, etc.)
 * @param {number} n - The number to check
 * @returns {'one' | 'few' | 'many'} - Plural form category
 *
 * one:  1, 21, 31, 41...  (ends in 1, except 11)
 * few:  2-4, 22-24, 32-34...  (ends in 2-4, except 12-14)
 * many: 0, 5-20, 25-30, 35-40...  (everything else)
 */
export function pluralForm(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'one'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few'
  return 'many'
}
