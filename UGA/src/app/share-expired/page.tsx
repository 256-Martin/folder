import Link from 'next/link';

export default function ShareExpiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card card-pad max-w-md text-center">
        <h1 className="text-lg font-semibold text-ink">This link is no longer valid</h1>
        <p className="mt-2 text-sm text-muted">
          It has been revoked, or it was never a valid link. Ask whoever sent it to generate a new
          one from the dashboard.
        </p>
        <Link href="/login" className="btn-secondary btn-sm mt-4">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
