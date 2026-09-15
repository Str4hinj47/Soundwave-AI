import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./store/auth";
import { ToastHost } from "./components/ui/ToastHost";
import { Logo } from "./components/Logo";
import { AppShell } from "./components/layout/AppShell";
import { Landing } from "./pages/Landing";
import { Pricing } from "./pages/Pricing";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { VerifyEmail } from "./pages/VerifyEmail";
import { OAuthCallback } from "./pages/OAuthCallback";
import { Dashboard } from "./pages/Dashboard";
import { Studio } from "./pages/Studio";
import { SubtitleEditor } from "./pages/SubtitleEditor";
import { VideoCompositor } from "./pages/VideoCompositor";
import { Projects } from "./pages/Projects";
import { Settings } from "./pages/Settings";
import { VoiceLibrary } from "./pages/VoiceLibrary";
import { NotFound } from "./pages/NotFound";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-tint">
          <div className="h-full w-1/3 animate-[shimmer_1.4s_linear_infinite] rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading && !user) return <FullPageLoader />;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?redirect=${redirect}`} replace />;
  }
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading && !user) return <FullPageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const loadSession = useAuth((s) => s.loadSession);
  useEffect(() => {
    // Resolve the auth state once on startup. Previously loadSession() was
    // only reachable from a guarded effect inside RequireAuth whose condition
    // could never be true on first render, which left `loading: true` forever
    // and pinned every auth-gated route to the full-page loader.
    void loadSession();
  }, [loadSession]);

  return (
    <>
      <ScrollToTop />
      <ToastHost />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/voices" element={<VoiceLibrary standalone />} />
        <Route
          path="/signin"
          element={
            <PublicOnly>
              <SignIn />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <SignUp />
            </PublicOnly>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <AppShell>
                <Dashboard />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/studio"
          element={
            <RequireAuth>
              <AppShell>
                <Studio />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/studio/subtitles"
          element={
            <RequireAuth>
              <AppShell>
                <SubtitleEditor />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/studio/video"
          element={
            <RequireAuth>
              <AppShell>
                <VideoCompositor />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/projects"
          element={
            <RequireAuth>
              <AppShell>
                <Projects />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/settings/*"
          element={
            <RequireAuth>
              <AppShell>
                <Settings />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
