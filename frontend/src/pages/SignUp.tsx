import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Github } from "lucide-react";
import { AuthLayout } from "../components/layout/AuthLayout";
import { TextField } from "../components/ui/TextField";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/Logo";
import { http } from "../lib/api";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import { GoogleIcon } from "../components/GoogleIcon";
import type { UserProfile } from "../lib/types";

const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters.").max(100),
    email: z.string().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "At least 8 characters.")
      .regex(/[a-z]/, "One lowercase letter.")
      .regex(/[A-Z]/, "One uppercase letter.")
      .regex(/[0-9]/, "One number.")
      .regex(/[^A-Za-z0-9]/, "One special character."),
    confirm: z.string(),
    terms: z.boolean().refine((v) => v === true, "You must accept the Terms and Privacy Policy."),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });

type FormValues = z.infer<typeof schema>;

const checks: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function SignUp() {
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState("");
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirm: "", terms: false },
  });

  const password = watch("password") ?? "";

  const onSubmit = async (values: FormValues) => {
    setServerError("");
    try {
      const { user } = await http.post<{ user: UserProfile }>(
        "/auth/signup",
        { name: values.name, email: values.email, password: values.password },
        { skipAuth: true },
      );
      setUser(user);
      toast.success("Account created", "Welcome to Soundwave AI! Check your inbox to verify your email.");
      navigate("/dashboard");
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  const startOAuth = (provider: "google" | "github") => {
    window.location.assign(`/api/v1/auth/oauth/${provider}`);
  };

  return (
    <AuthLayout
      footer={
        <p>
          Already have an account?{" "}
          <Link to="/signin" className="text-accent hover:text-accent-strong">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="mb-6 flex justify-center lg:hidden">
        <Logo withWordmark={false} />
      </div>
      <h1 className="text-2xl font-semibold text-fg">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Start generating voice content in seconds.</p>

      <div className="mt-6 grid grid-cols-1 gap-3">
        <Button variant="outline" type="button" onClick={() => startOAuth("google")}>
          <GoogleIcon className="h-5 w-5" /> Continue with Google
        </Button>
        <Button variant="outline" type="button" onClick={() => startOAuth("github")}>
          <Github className="h-5 w-5" /> Continue with GitHub
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs uppercase tracking-wide text-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <motion.form onSubmit={handleSubmit(onSubmit)} noValidate animate={isSubmitted && Object.keys(errors).length > 0 ? { x: [0, -6, 6, -4, 4, 0] } : {}} transition={{ duration: 0.4 }} className="space-y-4">
        <TextField label="Full Name" type="text" autoComplete="name" placeholder="Ada Lovelace" error={errors.name?.message} {...register("name")} />

        <TextField label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />

        <div>
          <TextField
            label="Password"
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.password?.message}
            rightSlot={
              <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? "Hide password" : "Show password"} className="text-faint hover:text-fg-soft">
                {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
            {...register("password")}
          />
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2" aria-label="Password requirements">
            {checks.map((c) => {
              const ok = c.test(password);
              return (
                <li key={c.label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-success" : "text-faint"}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-success" : "bg-tint-strong"}`} />
                  {c.label}
                </li>
              );
            })}
          </ul>
        </div>

        <TextField
          label="Confirm Password"
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirm?.message}
          rightSlot={
            <button type="button" onClick={() => setShowConfirm((s) => !s)} aria-label={showConfirm ? "Hide password" : "Show password"} className="text-faint hover:text-fg-soft">
              {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          {...register("confirm")}
        />

        <label className="flex items-start gap-2.5 text-sm text-fg-soft">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line-emphasis bg-sunken accent-accent" {...register("terms")} />
          <span className="min-w-0">
            I agree to the{" "}
            <a href="#" className="text-accent hover:text-accent-strong">Terms of Service</a> and{" "}
            <a href="#" className="text-accent hover:text-accent-strong">Privacy Policy</a>
          </span>
        </label>
        {errors.terms && <p className="text-sm text-danger">{errors.terms.message}</p>}

        {serverError && <p className="text-sm text-danger" role="alert">{serverError}</p>}

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          Create Account
        </Button>
      </motion.form>
    </AuthLayout>
  );
}
