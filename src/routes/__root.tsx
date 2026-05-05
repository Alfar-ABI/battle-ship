import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md text-center p-10">
        <h1 className="font-display text-7xl neon-cyan">404</h1>
        <h2 className="mt-4 text-xl font-display uppercase tracking-widest">Signal Lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">No transmission from this sector.</p>
        <Link to="/" className="btn-cyber mt-6 inline-flex">Return to Command</Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cyber-Command · Battleship" },
      { name: "description", content: "High-end 3D Battleship with futuristic Cyber-Command UI." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=JetBrains+Mono:wght@400;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NavBar() {
  const { user, signOut } = useAuth();
  return (
    <header className="relative z-10 px-5 h-16 flex items-center justify-between border-b border-border/40 backdrop-blur-md bg-background/40">
      <Link to="/" className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md border border-[var(--cyan)]/60 flex items-center justify-center neon-cyan font-display">⌬</div>
        <div className="font-display uppercase tracking-widest text-sm">
          Cyber-<span className="neon-cyan">Command</span>
        </div>
      </Link>
      <nav className="flex items-center gap-2">
        <Link to="/" className="px-3 py-1.5 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground">Home</Link>
        <Link to="/play" className="px-3 py-1.5 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground">Play</Link>
        {user && <Link to="/stats" className="px-3 py-1.5 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground">Stats</Link>}
        {user ? (
          <button onClick={() => signOut()} className="btn-danger !py-1.5 !px-3 !text-xs">Sign Out</button>
        ) : (
          <Link to="/login" className="btn-cyber !py-1.5 !px-3 !text-xs">Login</Link>
        )}
      </nav>
    </header>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <div className="relative min-h-screen">
        <NavBar />
        <main className="relative z-10">
          <Outlet />
        </main>
        <Toaster theme="dark" position="top-right" />
      </div>
    </AuthProvider>
  );
}
