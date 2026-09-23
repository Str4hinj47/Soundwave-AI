import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastHost } from "./components/ui/ToastHost";
import { AppShell } from "./components/layout/AppShell";
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

// Soundwave AI Suite — Autonomous Shorts Agent + Voice Studio
export default function App() {
  return (
    <>
      <ScrollToTop />
      <ToastHost />
      <Routes>
        {/* Root -> direct to video compositor */}
        <Route path="/" element={<Navigate to="/studio/video" replace />} />
        <Route path="/signin" element={<Navigate to="/studio/video" replace />} />
        <Route path="/signup" element={<Navigate to="/studio/video" replace />} />
        <Route path="/pricing" element={<Navigate to="/studio/video" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/studio/video" replace />} />
        <Route path="/reset-password" element={<Navigate to="/studio/video" replace />} />
        <Route path="/verify-email" element={<Navigate to="/studio/video" replace />} />
        <Route path="/oauth/callback" element={<Navigate to="/studio/video" replace />} />

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
