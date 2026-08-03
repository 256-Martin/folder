import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { redeemShareToken } from '@/lib/sharing';

export const dynamic = 'force-dynamic';

/**
 * Opening a share link signs the visitor in as that link's guest and drops them
 * on the dashboard.
 *
 * This is a Route Handler rather than a page because setting a cookie is only
 * allowed in a Route Handler or Server Action — a Server Component cannot.
 *
 * Unknown, revoked and expired tokens all end up at the same place, so the
 * endpoint cannot be used to work out which tokens exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const guest = await redeemShareToken(token);

  if (!guest) {
    return NextResponse.redirect(new URL('/share-expired', request.url));
  }

  await createSession({ ...guest, share: true });
  return NextResponse.redirect(new URL('/', request.url));
}
