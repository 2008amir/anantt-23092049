import { useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  variant = "luxe",
  invalid = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  variant?: "luxe" | "admin";
  invalid?: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  if (variant === "admin") {
    return (
      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            aria-invalid={invalid}
            className={`w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm focus:outline-none ${
              invalid ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
            } ${className}`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <div className="relative mt-2">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full border border-border bg-background px-4 py-3 pr-11 text-sm text-foreground outline-none transition-smooth focus:border-primary"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-primary"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  symbol: boolean;
};

export function checkPassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

export function isPasswordValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.length && c.upper && c.lower && c.number && c.symbol;
}

export function PasswordRequirements({ password }: { password: string }) {
  const c = checkPassword(password);
  const items: { key: keyof PasswordChecks; label: string }[] = [
    { key: "length", label: "At least 8 characters" },
    { key: "upper", label: "One uppercase letter (A–Z)" },
    { key: "lower", label: "One lowercase letter (a–z)" },
    { key: "number", label: "One number (0–9)" },
    { key: "symbol", label: "One symbol (!@#$…)" },
  ];
  return (
    <ul className="space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-3">
      {items.map((it) => {
        const ok = c[it.key];
        return (
          <li
            key={it.key}
            className={`flex items-center gap-2 text-xs transition-colors ${
              ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                ok
                  ? "border-emerald-600/60 bg-emerald-600/15 dark:border-emerald-400/60 dark:bg-emerald-400/15"
                  : "border-border bg-background"
              }`}
            >
              {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-40" />}
            </span>
            {it.label}
          </li>
        );
      })}
    </ul>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}
