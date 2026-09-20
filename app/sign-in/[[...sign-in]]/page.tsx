import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { authCardAppearance } from "@/lib/auth/appearance";

export const metadata = {
  title: "Sign in · Contently",
};

export default function SignInPage() {
  return (
    <AuthLayout>
      <SignIn appearance={authCardAppearance} />
    </AuthLayout>
  );
}
