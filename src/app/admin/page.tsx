import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { getAdminMatches } from "@/lib/results";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminResults } from "@/components/AdminResults";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdmin();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Home
      </Link>
      <div className="mt-3">
        {authed ? (
          <AdminResults matches={await getAdminMatches()} />
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}
