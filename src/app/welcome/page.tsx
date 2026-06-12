import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { safeNextPath } from "@/lib/redirect";
import { WelcomeForm } from "@/components/WelcomeForm";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNextPath(next);

  const userId = await getUserId();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/welcome?next=${dest}`)}`);
  }

  // Already set up? Skip straight to where they were headed.
  const profile = await getProfile(userId);
  if (profile?.name) redirect(dest);

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 gradient-text font-display pb-1 text-3xl leading-tight">
        One last thing
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        What&apos;s your name? It&apos;s shown on your group leaderboards — you can
        pick a different nickname for each group when you join.
      </p>
      <WelcomeForm next={dest} />
    </main>
  );
}
