import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin bearer-token guard for write-side API routes.
 *
 * The operator MUST set the ADMIN_API_TOKEN environment variable — in every
 * environment, including local dev. Clients must present
 * `Authorization: Bearer <token>` on every request. Missing/mismatched →
 * 401 (or 503 if the token env var isn't configured at all).
 *
 * There is deliberately NO NODE_ENV skip: an unset NODE_ENV (or a
 * misconfigured deploy) must fail CLOSED, not open. For local work, put
 * ADMIN_API_TOKEN in .env.local.
 *
 * Returns null when the request is authorized, otherwise a NextResponse
 * the caller should return immediately.
 */
export function requireAdminToken(req: NextRequest): NextResponse | null {
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
