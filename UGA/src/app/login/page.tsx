import { redirect } from 'next/navigation';
import { createSession, getSession, verifyCredentials } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

async function signIn(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const user = await verifyCredentials(email, password);
  if (!user) redirect('/login?error=1');

  await createSession(user);
  await recordAudit({ user, action: 'LOGIN', entity: 'Session', refId: user.email });
  redirect('/');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect('/');
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-ink">UGABRUSH</div>
          <p className="mt-1 text-sm text-muted">
            Manufacturing Inventory, WIP &amp; Direct Labour System
          </p>
          <p className="mt-0.5 text-xs text-faint">Deploy Resource Africa Ltd</p>
        </div>

        <form action={signIn} className="card card-pad space-y-4">
          {error && (
            <div className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
              That email and password combination was not recognised.
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              autoFocus
              className="input"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            Sign in
          </button>
        </form>

        {process.env.NODE_ENV !== 'production' && (
          <p className="mt-4 text-center text-xs text-faint">
            Seeded account: <span className="font-mono">muenoch@gmail.com</span> /{' '}
            <span className="font-mono">ugabrush2026</span>
          </p>
        )}
      </div>
    </div>
  );
}
