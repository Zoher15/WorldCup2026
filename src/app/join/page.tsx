import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { JoinForms } from "@/components/JoinForms";
import { PageShell } from "@/components/PageShell";

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
    <PageShell width="narrow" back={{ href: "/", label: "Back" }}>
      <h1 className="mb-6 gradient-text font-display pb-1 text-3xl leading-tight tracking-tight">
        Join the fun
      </h1>
      <JoinForms
        initialTab={mode === "create" ? "create" : "join"}
        defaultName={profile?.name ?? ""}
      />
    </PageShell>
  );
}
