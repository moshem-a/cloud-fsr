import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SignInScreen } from "../features/auth/components/SignInScreen.tsx";

export const Route = createFileRoute("/signin")({
  component: SignInPage,
});

function SignInPage() {
  const nav = useNavigate();
  return <SignInScreen onSignedIn={() => nav({ to: "/dashboard" })} />;
}
