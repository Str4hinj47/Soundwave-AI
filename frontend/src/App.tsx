import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastHost } from "./components/ui/ToastHost";
import { Logo } from "./components/Logo";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Studio } from "./pages/Studio";
import { SubtitleEditor } from "./pages/SubtitleEditor";
import { VideoCompositor } from "./pages/VideoCompositor";
import { Projects } from "./pages/Projects";
import { Settings } from "./pages/Settings";
import { Help } from "./pages/Help";
import { VoiceLibrary } from "./pages/VoiceLibrary";
import { JarvisExpert } from "./pages/JarvisExpert";
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

// NO AUTH VERSION — optimized for Jarvis, no login required
// All routes are public, root redirects to video editor
export default function App() {
  return (
    <>
      <ScrollToTop />
      <ToastHost />
      <Routes>
        {/* Root -> direct to video editor (your requested editing part) */}
        <Route path="/" element={<Navigate to="/studio/video" replace />} />
        <Route path="/signin" element={<Navigate to="/studio/video" replace />} />
        <Route path="/signup" element={<Navigate to="/studio/video" replace />} />
        <Route path="/pricing" element={<Navigate to="/studio/video" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/studio/video" replace />} />
        <Route path="/reset-password" element={<Navigate to="/studio/video" replace />} />
        <Route path="/verify-email" element={<Navigate to="/studio/video" replace />} />
        <Route path="/oauth/callback" element={<Navigate to="/studio/video" replace />} />

        {/* All editing routes — NO AUTH, inside AppShell */}
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
        <Route
          path="/jarvis"
          element={
            <AppShell>
              <JarvisExpert />
            </AppShell>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
