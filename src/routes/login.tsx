import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login · Battleship" }] }),
});

function LoginPage() {
  const { user, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav({ to: "/play" }); }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    sfx.click();
    setBusy(true);
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(email, pw);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(mode === "signin" ? "Authenticated." : "Account created.");
      nav({ to: "/play" });
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8">
        <h1 className="font-display text-2xl uppercase tracking-widest neon-cyan mb-1">
          {mode === "signin" ? "Authenticate" : "New Operative"}
        </h1>
        <p className="text-xs text-muted-foreground mb-6">
          {mode === "signin" ? "Sign in to sync match history." : "Register to track stats across sessions."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-muted-foreground">Email</label>
            <input type="email" required className="input-cyber mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-muted-foreground">Password</label>
            <input type="password" required minLength={6} className="input-cyber mt-1" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <button disabled={busy} className="btn-cyber w-full">
            {busy ? "···" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <button
          className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full"
          onClick={() => { sfx.click(); setMode((m) => m === "signin" ? "signup" : "signin"); }}
        >
          {mode === "signin" ? "Need an account? Register →" : "Have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}
