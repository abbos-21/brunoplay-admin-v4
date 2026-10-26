/** The server's rule (internal/admin/password.go): 12+ characters and at least three of four character kinds. */
export const PASSWORD_HINT = 'At least 12 characters, using at least three of: lower case, upper case, digits, symbols.'

export function passwordProblem(pw: string): string {
  if ([...pw].length < 12) return 'Use at least 12 characters.'
  if (pw.length > 128) return 'Use at most 128 characters.'
  let kinds = 0
  if (/\p{Ll}/u.test(pw)) kinds++
  if (/\p{Lu}/u.test(pw)) kinds++
  if (/\p{Nd}/u.test(pw)) kinds++
  if (/[^\p{Ll}\p{Lu}\p{Nd}]/u.test(pw)) kinds++
  if (kinds < 3) return 'Mix at least three kinds: lower case, upper case, digits, symbols.'
  return ''
}
