import { acceptInviteAction } from "@/app/i/[code]/actions";
import { inputClasses as input } from "@/components/form-styles";

/**
 * The signed-in, non-member join prompt shared by the invite (/i/<code>) and
 * share (/s/<code>) pages: a one-tap join form with an optional per-group
 * nickname (defaults to the profile name). Both pages reach this same state, so
 * the markup lives here once.
 */
export function InviteJoinForm({
  code,
  groupName,
  profileName,
}: {
  code: string;
  groupName: string;
  profileName: string;
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 gradient-text pb-1 text-3xl font-black leading-tight">
        You&apos;re invited!
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        Join <strong className="text-grape dark:text-violet-300">{groupName}</strong> and
        start predicting.
      </p>

      <form action={acceptInviteAction} className="space-y-4">
        <input type="hidden" name="code" value={code} />
        <div>
          <label className="mb-1 block text-sm font-bold text-stone-600 dark:text-stone-200">
            Your nickname in this group (optional)
          </label>
          <input name="displayName" className={input} placeholder={profileName} />
        </div>
        <button
          type="submit"
          className="w-full rounded-full glass py-3.5 text-lg font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
        >
          Join {groupName} →
        </button>
      </form>
    </main>
  );
}
