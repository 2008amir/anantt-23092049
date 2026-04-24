import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/users/")({
  component: UsersPage,
});

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
};

function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, display_name, created_at")
        .order("created_at", { ascending: false });
      setProfiles((data ?? []) as Profile[]);
      setLoading(false);
    })();
  }, []);

  const filtered = profiles.filter(
    (p) =>
      !q ||
      p.email?.toLowerCase().includes(q.toLowerCase()) ||
      p.display_name?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">{profiles.length} registered.</p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full rounded-md border border-border/40 bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to="/admin/users/$userId"
              params={{ userId: p.id }}
              className="flex items-center justify-between border-b border-border/40 px-5 py-4 last:border-0 hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{p.display_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No users.</p>
          )}
        </div>
      )}
    </div>
  );
}
