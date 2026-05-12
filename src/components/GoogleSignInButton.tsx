import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

type GoogleSignInButtonProps = {
  onSuccess: (idToken: string) => void;
  onError: () => void;
};

export function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const clientId = (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ??
    import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    ""
  ).trim();

  if (!clientId) {
    return (
      <p className="text-xs text-muted-foreground">
        Google sign-in is currently unavailable. Please try again later.
      </p>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(response: CredentialResponse) => {
            if (response.credential) {
              onSuccess(response.credential);
            } else {
              onError();
            }
          }}
          onError={onError}
        />
      </div>
    </GoogleOAuthProvider>
  );
}
