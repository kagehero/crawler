import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Suspense
        fallback={
          <p className="text-sm text-sumi/70">読み込み中…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
