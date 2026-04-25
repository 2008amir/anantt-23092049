import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { User, Lock, Save, LogOut, Palette } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  PasswordField,
  PasswordRequirements,
  isPasswordValid,
  Spinner,
} from "@/components/PasswordField";

export const Route = createFileRoute("/admin/profile")({
  component: AdminProfilePage,
});

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
  form?: string;
};

function AdminProfilePage() {
  const { user, signOut } = useStore();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!currentPassword) next.current = "Enter your current password";
    if (!isPasswordValid(newPassword)) next.next = "Password does not meet all requirements";
    if (newPassword && currentPassword && newPassword === currentPassword) {
      next.next = "New password must differ from current";
    }
    if (confirmPassword !== newPassword) next.confirm = "Passwords do not match";
    return next;
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;

    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSaving(true);
    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      setSaving(false);
      setErrors({ current: "Current password is incorrect" });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      setErrors({ form: error.message });
      return;
    }

    // Only fire success toast after Supabase confirms the update
    toast.success("Password updated successfully");
    setErrors({});
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your admin account.</p>
      </div>

      {/* Appearance */}
      <div className="rounded-lg border border-border/40 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-wider">Appearance</h2>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Theme</p>
          <ThemeToggle />
        </div>
      </div>

      {/* Account info */}
      <div className="rounded-lg border border-border/40 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-wider">Account</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="text-primary">Administrator</span>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive transition-smooth hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>

      {/* Change password */}
      <div className="rounded-lg border border-border/40 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-wider">Change Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errors.current) setErrors((p) => ({ ...p, current: undefined }));
              }}
              autoComplete="current-password"
              aria-invalid={!!errors.current}
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none ${
                errors.current ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
              }`}
            />
            {errors.current && (
              <p className="mt-1 text-xs text-destructive">{errors.current}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errors.next) setErrors((p) => ({ ...p, next: undefined }));
              }}
              autoComplete="new-password"
              aria-invalid={!!errors.next}
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none ${
                errors.next ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
              }`}
            />
            {errors.next && (
              <p className="mt-1 text-xs text-destructive">{errors.next}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
              }}
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none ${
                errors.confirm ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
              }`}
            />
            {errors.confirm && (
              <p className="mt-1 text-xs text-destructive">{errors.confirm}</p>
            )}
          </div>
          {errors.form && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errors.form}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-gold-gradient px-4 py-2 text-sm text-primary-foreground transition-smooth hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
