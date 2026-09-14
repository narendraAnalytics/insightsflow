import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-(--flow-cream) px-4 py-24">
      <SignIn appearance={clerkAppearance} />
    </main>
  );
}
