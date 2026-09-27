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
import { Help } from "./pages/Help";
import { VoiceLibrary } from "./pages/VoiceLibrary";
import { AgentHub } from "./pages/AgentHub";
import { CreatorStudio } from "./pages/CreatorStudio";
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
    <div className="flex min-h-screen items-center justify-center bg-navy">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-gray-800">
          <div className="h-full w-1/3 animate-[shimmer_1.4s_linear_infinite] rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
        </div>
      </div>
    </div>
  );
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading && !user) return <FullPageLoader />;
  if (user?.singleUser) return <Navigate to="/studio" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Home: the full version shows the marketing landing; the single-user
// edition dives straight into the Studio (no sign-in, no pricing).
function HomeGate() {
  const { user, loading } = useAuth();
  if (loading && !user) return <FullPageLoader />;
  if (user?.singleUser) return <Navigate to="/studio" replace />;
  return <Landing />;
}

// The Voice Library is a public page (linked from the landing site), but when
// a signed-in user opens it from the sidebar it must stay inside the AppShell
// — otherwise the left navigation tabs vanish for that route.
function PricingGate() {
  const { user, loading } = useAuth();
  if (loading && !user) return <FullPageLoader />;
  if (user?.singleUser) return <Navigate to="/studio" replace />;
  return <Pricing />;
}

function VoiceLibraryRoute() {
  const { user, loading } = useAuth();
  if (loading && !user) return <FullPageLoader />;
  if (!user) return <VoiceLibrary standalone />;
  return (
    <AppShell>
      <VoiceLibrary standalone={false} />
    </AppShell>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <ToastHost />
      <Routes>
        <Route path="/" element={<HomeGate />} />
        <Route path="/pricing" element={<PricingGate />} />
        <Route path="/voices" element={<VoiceLibraryRoute />} />
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

        {/* Backward-compatible alias for /jarvis -> /agent */}
        <Route path="/jarvis" element={<Navigate to="/agent" replace />} />
        <Route path="/automation" element={<Navigate to="/agent" replace />} />

        {/* Studio and Agent routes inside AppShell */}
        <Route
          path="/agent"
          element={
            <AppShell>
              <AgentHub />
            </AppShell>
          }
        />
        <Route
          path="/creator"
          element={
            <AppShell>
              <CreatorStudio />
            </AppShell>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AppShell>
              <Dashboard />
            </AppShell>
          }
        />
        <Route
          path="/studio"
          element={
            <AppShell>
              <Studio />
            </AppShell>
          }
        />
        <Route
          path="/studio/subtitles"
          element={
            <AppShell>
              <SubtitleEditor />
            </AppShell>
          }
        />
        <Route
          path="/studio/video"
          element={
            <AppShell>
              <VideoCompositor />
            </AppShell>
          }
        />
        <Route
          path="/projects"
          element={
            <AppShell>
              <Projects />
            </AppShell>
          }
        />
        <Route
          path="/settings/*"
          element={
            <AppShell>
              <Settings />
            </AppShell>
          }
        />
        <Route
          path="/help"
          element={
            <AppShell>
              <Help />
            </AppShell>
          }
        />
        <Route
          path="/voices"
          element={
            <AppShell>
              <VoiceLibrary standalone={false} />
            </AppShell>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
