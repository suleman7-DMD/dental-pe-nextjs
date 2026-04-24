import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin bearer-token guard for write-side API routes.
 *
 * In production (NODE_ENV === 'production') the operator MUST set the
 * ADMIN_API_TOKEN environment variable. Clients must then present
 * `Authorization: Bearer <token>` on every request. Missing/mismatched →
 * 401 (or 503 if the token env var isn't configured at all).
 *
 * In development the guard is skipped so local workflows stay productive.
 *
 * Returns null when the request is authorized, otherwise a NextResponse
 * the caller should return immediately.
 */
export function requireAdminToken(req: NextRequest): NextResponse | null {
  const isProduction = process.env.NODE_ENV === 'production'
  if (!isProduction) return null

  const expected = process.env.ADMIN_API_TOKEN
  if (!expected) {
    return NextResponse.json(
      {
        error:
          'Admin API is disabled. Set ADMIN_API_TOKEN on the server to ' +
          'enable write endpoints.',
      },
      { status: 503 }
    )
  }

  const presented = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim()
  if (presented !== expected) {
    return NextResponse.json(
      { error: 'Unauthorized. Missing or invalid bearer token.' },
      { status: 401 }
    )
  }

  return null
}
