import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { authCardAppearance } from "@/lib/auth/appearance";

export const metadata = {
  title: "Sign up · Contently",
};

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp appearance={authCardAppearance} />
    </AuthLayout>
  );
}
