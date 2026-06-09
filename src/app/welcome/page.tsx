import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { WelcomeForm } from "@/components/WelcomeForm";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = next && next.startsWith("/") ? next : "/";

  const userId = await getUserId();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/welcome?next=${dest}`)}`);
  }

  // Already set up? Skip straight to where they were headed.
  const profile = await getProfile(userId);
  if (profile?.name) redirect(dest);

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 bg-gradient-to-r from-flame to-grape bg-clip-text pb-1 text-3xl font-black leading-tight text-transparent">
        One last thing
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        What should we call you? This is the name your group sees on the
        leaderboard.
      </p>
      <WelcomeForm next={dest} />
    </main>
  );
}
