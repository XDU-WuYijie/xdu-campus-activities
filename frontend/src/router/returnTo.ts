export function safeReturnTo(
  value: unknown,
  fallback = '/',
): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return fallback
  }

  return value
}

export function withReturnTo(pathname: string, returnTo: string): string {
  const search = new URLSearchParams({ returnTo })
  return `${pathname}?${search.toString()}`
}
