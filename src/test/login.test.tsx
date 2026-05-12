import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const signInMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
  useNavigate: () => navigateMock,
}));

vi.mock("@/lib/store", () => ({
  useStore: () => ({
    user: null,
    signIn: signInMock,
    signUp: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [] }),
    })),
  },
}));

vi.mock("@/hooks/use-admin", () => ({ ADMIN_EMAIL: "admin@example.com" }));

vi.mock("@/components/PasswordField", () => ({
  PasswordField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  ),
  PasswordRequirements: () => null,
  isPasswordValid: () => true,
  Spinner: () => <span>loading</span>,
}));

vi.mock("@/lib/recaptcha", () => ({
  RecaptchaCheckbox: ({ onChange }: { onChange: (token: string | null) => void }) => (
    <button
      type="button"
      data-testid="recaptcha-widget"
      onClick={() => onChange("recaptcha-token")}
    >
      Solve reCAPTCHA
    </button>
  ),
  resetRecaptchaWidgets: vi.fn(),
}));

vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential?: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: "google.jwt.token" })}>
      Continue with Google
    </button>
  ),
}));

import { Login } from "../routes/login";

describe("Login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "example-client-id");
  });

  it("renders Google and reCAPTCHA widgets, then runs both flows", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    render(<Login />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByTestId("recaptcha-widget")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("recaptcha-widget"));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "example-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith(
        "user@example.com",
        "example-password",
        "recaptcha-token",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(screen.getByTestId("google-jwt")).toHaveTextContent("google.jwt.token…le.jwt.token");
    expect(infoSpy).toHaveBeenCalledWith("[auth] Google ID token received", {
      tokenLength: 16,
    });

    fireEvent.click(screen.getByRole("button", { name: "Reveal full token" }));
    expect(screen.getByTestId("google-jwt")).toHaveTextContent("google.jwt.token");
  });
});
