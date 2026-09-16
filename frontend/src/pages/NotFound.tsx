import { Link } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { Search } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-screen bg-app">
      <Navbar />
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-6xl font-extrabold text-gradient">404</p>
        <h1 className="mt-4 text-3xl font-bold text-fg-strong">Page not found</h1>
        <p className="mt-2 max-w-md text-fg-muted">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-btn bg-gradient-to-r from-primary to-accent px-6 font-semibold text-fg-strong hover:brightness-110"
          >
            Back to home
          </Link>
          <Link
            to="/voices"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-btn border border-border-strong px-6 font-semibold text-fg hover:border-primary/70 hover:text-fg-strong"
          >
            <Search className="h-4 w-4" /> Browse voices
          </Link>
        </div>
      </div>
    </div>
  );
}
