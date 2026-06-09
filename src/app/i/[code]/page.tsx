import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { getGroupInvite } from "@/lib/groups";
import { acceptInviteAction } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base font-medium outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Sign-in (and a name) are required before joining.
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/i/${code}`)}`);
  const profile = await getProfile(userId);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(`/i/${code}`)}`);

  const invite = await getGroupInvite(code, userId);

  if (!invite) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="text-4xl">🤷</div>
        <h1 className="mt-3 text-xl font-black text-stone-700 dark:text-stone-100">
          That invite link isn&apos;t valid
        </h1>
        <p className="mt-2 text-sm font-medium text-stone-500 dark:text-stone-300">
          Double-check the link, or ask for the group code.
        </p>
        <Link
          href="/join"
          className="mt-6 inline-block rounded-full glass px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
        >
          Join with a code
        </Link>
      </main>
    );
  }

  // Already in? Straight to the group.
  if (invite.isMember) redirect(`/g/${code}`);

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 gradient-text pb-1 text-3xl font-black leading-tight">
        You&apos;re invited!
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        Join <strong className="text-grape dark:text-violet-300">{invite.name}</strong> and
        start predicting.
      </p>

      <form action={acceptInviteAction} className="space-y-4">
        <input type="hidden" name="code" value={code} />
        <div>
          <label className="mb-1 block text-sm font-bold text-stone-600 dark:text-stone-200">
            Your nickname in this group (optional)
          </label>
          <input
            name="displayName"
            className={input}
            placeholder={profile.name}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-full glass py-3.5 text-lg font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
        >
          Join {invite.name} →
        </button>
      </form>
    </main>
  );
}
