import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/post")({
  head: () => ({ meta: [{ title: "Post — Admin" }] }),
  component: PostPage,
});

type NotificationRow = {
  id: string;
  user_id: string | null;
  kind: string;
  title: string;
  body: string;
  image: string | null;
  created_at: string;
};

function PostPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audience, setAudience] = useState<"all" | "user">("all");
  const [userEmail, setUserEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recent, setRecent] = useState<NotificationRow[]>([]);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("kind", "post")
      .order("created_at", { ascending: false })
      .limit(20);
    setRecent((data ?? []) as NotificationRow[]);
  };

  useEffect(() => {
    void loadRecent();
  }, []);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `notifications/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSending(true);
    try {
      if (audience === "all") {
        // Broadcast: one row per user so that per-user read state works.
        const { data: users, error: usersErr } = await supabase
          .from("profiles")
          .select("id");
        if (usersErr) throw usersErr;
        const rows = (users ?? []).map((u: { id: string }) => ({
          user_id: u.id,
          kind: "post",
          title: title.trim(),
          body: body.trim(),
          image: imageUrl || null,
        }));
        if (rows.length === 0) {
          toast.error("No recipients");
          return;
        }
        const { error } = await supabase.from("notifications").insert(rows);
        if (error) throw error;
        toast.success(`Sent to ${rows.length} user(s)`);
      } else {
        const email = userEmail.trim().toLowerCase();
        if (!email) {
          toast.error("User email required");
          return;
        }
        const { data: profile, error: lookupErr } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (lookupErr) throw lookupErr;
        if (!profile) {
          toast.error("No user found with that email");
          return;
        }
        const { error } = await supabase.from("notifications").insert({
          user_id: profile.id,
          kind: "post",
          title: title.trim(),
          body: body.trim(),
          image: imageUrl || null,
        });
        if (error) throw error;
        toast.success("Sent");
      }
      setTitle("");
      setBody("");
      setImageUrl("");
      await loadRecent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    await loadRecent();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a message or reward announcement to your users. Posts appear
          only in their notifications bell — not on the homepage or earn page.
        </p>
      </div>

      <div className="rounded-lg border border-border/40 bg-card p-6 space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New drop, exclusive offer…"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write the message body…"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Image (optional)
          </label>
          <div className="mt-1 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-primary">
              <ImageIcon className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
            </label>
            {imageUrl && (
              <>
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-12 w-12 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Audience
          </label>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setAudience("all")}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                audience === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              All users
            </button>
            <button
              type="button"
              onClick={() => setAudience("user")}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                audience === "user"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              Specific user
            </button>
          </div>
          {audience === "user" && (
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={sending}
          className="flex items-center gap-2 rounded-md bg-gold-gradient px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground shadow-gold hover:opacity-90 disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send post
        </button>
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider">Recent posts</h2>
        <div className="mt-3 divide-y divide-border/40 rounded-lg border border-border/40 bg-card">
          {recent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            recent.map((r) => (
              <div key={r.id} className="flex items-start gap-3 p-4">
                {r.image && (
                  <img src={r.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  {r.body && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{r.body}</p>
                  )}
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} ·{" "}
                    {r.user_id ? `user ${r.user_id.slice(0, 8)}…` : "all"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete(r.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
