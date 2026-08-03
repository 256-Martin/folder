import { Sidebar } from '@/components/Sidebar';
import { GuestBanner } from '@/components/GuestBanner';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Row layout only from lg up, where the icon rail is a real column. Below
  // that the rail is hidden and Sidebar renders a full-width top bar, which
  // must stack above the content rather than sit beside it as a flex item.
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        role={user.role}
        userName={user.name}
        envLabel={process.env.NEXT_PUBLIC_ENV_LABEL}
      />
      <main className="min-w-0 flex-1">
        {user.share && <GuestBanner role={user.role} />}
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
