import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { CyberModal } from "@/components/game/CyberModal";
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
      { title: "Battleship" },
      { name: "description", content: "A battleship game" },
      { property: "og:title", content: "Battleship" },
      { name: "twitter:title", content: "Battleship" },
      { property: "og:description", content: "A battleship game" },
      { name: "twitter:description", content: "A battleship game" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f41be530-1e98-4428-81ad-cc3eb5fe3f91/id-preview-22cfbf27--9e22b33b-c22a-42ad-b4e1-60174011a305.lovable.app-1777995920029.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f41be530-1e98-4428-81ad-cc3eb5fe3f91/id-preview-22cfbf27--9e22b33b-c22a-42ad-b4e1-60174011a305.lovable.app-1777995920029.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('cc-theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');}}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title="Toggle theme"
      className="px-3 py-1.5 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border rounded-md"
    >
      {theme === "dark" ? "☾ Dark" : "☀ Light"}
    </button>
  );
}

function NavBar() {
  const { user, signOut } = useAuth();
  const [rules, setRules] = useState(false);
  return (
    <>
      <header className="relative z-10 px-5 h-16 flex items-center justify-between border-b border-border/40 backdrop-blur-md bg-background/40">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md border border-[var(--cyan)]/60 flex items-center justify-center neon-cyan font-display">⌬</div>
          <div className="font-display uppercase tracking-widest text-sm">
            <span className="neon-cyan">Battleship</span>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className="px-3 py-1.5 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground">Home</Link>
          <Link to="/play" className="px-3 py-1.5 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground">Play</Link>
          {user && <Link to="/stats" className="px-3 py-1.5 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground">Stats</Link>}
          <button
            onClick={() => setRules(true)}
            className="px-3 py-1.5 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border rounded-md"
          >
            Rules
          </button>
          <ThemeToggle />
          {user ? (
            <button onClick={() => signOut()} className="btn-danger !py-1.5 !px-3 !text-xs">Sign Out</button>
          ) : (
            <Link to="/login" className="btn-cyber !py-1.5 !px-3 !text-xs">Login</Link>
          )}
        </nav>
      </header>
      <CyberModal
        open={rules}
        variant="info"
        title="Rules"
        onClose={() => setRules(false)}
        actions={<button className="btn-cyber" onClick={() => setRules(false)}>Got it</button>}
      >
        <div className="text-left space-y-2 text-sm">
          <p>• Place 5 ships on your 10×10 grid. Ships cannot touch — not even diagonally.</p>
          <p>• Players take turns firing at the enemy grid. A miss ends your turn; a hit lets you fire again.</p>
          <p>• <span className="neon-cyan">Left-click</span> a cell on enemy waters to fire.</p>
          <p>• <span className="neon-enemy">Right-click</span> a cell to mark it as a "no ship" guess (toggle).</p>
          <p>• Sink all five enemy ships (Carrier 5, Battleship 4, Destroyer 3, Submarine 3, Patrol 2) to win.</p>
          <p>• Difficulty: Easy = random, Medium = hunts adjacent after a hit, Hard = probability-density targeting.</p>
        </div>
      </CyberModal>
    </>
  );
}

function RootComponent() {
  const theme = typeof document !== "undefined" ? document.documentElement.classList.contains("light") ? "light" : "dark" : "dark";
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="relative min-h-screen">
          <NavBar />
          <main className="relative z-10">
            <Outlet />
          </main>
          <Toaster theme={theme} position="top-right" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
