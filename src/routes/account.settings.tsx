import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account/settings")({
  component: SettingsPanel,
});

function SettingsPanel() {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div>
      <h2 className="font-serif text-3xl">Account Settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">Manage your account preferences and security.</p>

      <div className="mt-8 space-y-6">
        <Section title="Personal Information">
          <Field label="Name" defaultValue={user.name} />
          <Field label="Email" defaultValue={user.email} type="email" />
        </Section>
        <Section title="Preferences">
          <Select label="Currency" options={["USD ($)", "EUR (€)", "GBP (£)"]} />
          <Select label="Language" options={["English", "Français", "Italiano"]} />
        </Section>
        <Section title="Security">
          <Field label="New Password" type="password" />
          <Field label="Confirm Password" type="password" />
        </Section>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <button type="button" className="bg-gold-gradient px-8 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground">
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => { logout(); navigate({ to: "/" }); }}
            className="border border-destructive/40 px-8 py-3 text-xs uppercase tracking-[0.25em] text-destructive hover:bg-destructive/10"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-primary">{title}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, defaultValue = "", type = "text" }: { label: string; defaultValue?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}

function Select({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <select className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
