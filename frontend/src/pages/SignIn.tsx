import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../components/layout/AuthLayout";
import { TextField } from "../components/ui/TextField";
import { Button } from "../components/ui/Button";
import { http } from "../lib/api";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import { GoogleIcon } from "../components/GoogleIcon";
import { useOAuthProviders } from "../hooks/useOAuthProviders";
import type { UserProfile } from "../lib/types";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type FormValues = z.infer<typeof schema>;

export function SignIn() {
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState("");
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const oauth = useOAuthProviders();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError("");
    try {
      const { user } = await http.post<{ user: UserProfile }>(
        "/auth/signin",
        { email: values.email, password: values.password },
        { skipAuth: true },
      );
      setUser(user);
      toast.success("Welcome back", `Signed in as ${user.name}.`);
      const redirect = params.get("redirect");
      navigate(redirect && redirect.startsWith("/") ? redirect : "/dashboard");
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  const startOAuth = () => {
    window.location.assign("/api/v1/auth/oauth/google");
  };

  return (
    <AuthLayout
      footer={
        <p>
          Don't have an account?{" "}
          <Link to="/signup" className="sw-link">
            Sign up
          </Link>
        </p>
      }
    >
      <h1 className="text-2xl font-bold text-fg-strong">Welcome back</h1>
      <p className="mt-1 text-sm text-fg-muted">Sign in to continue to your studio.</p>

      {/* OAuth button only renders when the server has Google configured —
          otherwise it would dead-end at a "not available" page. */}
      {oauth?.google && (
        <>
          <div className="mt-6">
            <Button variant="outline" type="button" fullWidth onClick={startOAuth}>
              <GoogleIcon className="h-5 w-5" /> Continue with Google
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-surface-2" />
            <span className="text-xs uppercase tracking-wide text-fg-subtle">or</span>
            <span className="h-px flex-1 bg-surface-2" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <TextField label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />

        <div>
          <TextField
            label="Password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            rightSlot={
              <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? "Hide password" : "Show password"} className="text-fg-subtle hover:text-fg-muted">
                {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
            {...register("password")}
          />
          <div className="mt-1.5 flex items-center justify-end">
            <Link to="/forgot-password" className="sw-link text-sm">
              Forgot password?
            </Link>
          </div>
        </div>

        {serverError && <p className="text-sm text-danger" role="alert">{serverError}</p>}

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
}
