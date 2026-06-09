import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { JoinForms } from "@/components/JoinForms";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;

  // Joining/creating needs an account — send guests through magic-link sign-in
  // and bring them right back here afterwards.
  const userId = await getUserId();
  if (!userId) {
    const next = mode === "create" ? "/join?mode=create" : "/join";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const profile = await getProfile(userId);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Back
      </Link>
      <h1 className="mt-3 mb-6 gradient-text pb-1 text-3xl font-black leading-tight">
        Join the fun
      </h1>
      <JoinForms
        initialTab={mode === "create" ? "create" : "join"}
        defaultName={profile?.name ?? ""}
      />
    </main>
  );
}
