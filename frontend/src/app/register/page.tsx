"use client";

import { Radar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiPost, ApiRequestError } from "@/lib/api";
import type { LoginResponse } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

const ROLES = ["Contributor", "Viewer", "TeamLead"] as const;

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  full_name: z.string().min(2, "Enter your full name"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(ROLES),
});

type RegisterForm = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof RegisterForm, string>>;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("Contributor");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = schema.safeParse({ email, full_name: fullName, password, role });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost<LoginResponse>("/auth/register", parsed.data);
      const token = res.data.access_token;
      setAuth(token, { email: parsed.data.email, name: parsed.data.full_name, role: parsed.data.role });
      toast({ title: "Account created", variant: "success" });
      router.push("/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Registration failed. Please try again.";
      toast({ title: "Registration failed", description: message, variant: "error" });
      setErrors({ email: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sentinel-600 shadow-glow">
            <Radar size={22} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            Create your Project Sentinel account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The agentic AI project co-ordinator
          </p>
        </div>

        <form onSubmit={onSubmit} className="panel space-y-4 p-6" noValidate>
          <div>
            <label htmlFor="full_name" className="mb-1 block text-xs font-medium text-muted-foreground">
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dana Ruiz"
              className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground/60"
            />
            {errors.full_name ? (
              <p className="mt-1 text-xs text-status-red">{errors.full_name}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground/60"
            />
            {errors.email ? (
              <p className="mt-1 text-xs text-status-red">{errors.email}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground/60"
            />
            {errors.password ? (
              <p className="mt-1 text-xs text-status-red">{errors.password}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-xs font-medium text-muted-foreground">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
              className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {errors.role ? (
              <p className="mt-1 text-xs text-status-red">{errors.role}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" loading={submitting}>
            Create account
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-sentinel-300 hover:underline">
              Sign in
            </Link>
          </p>
        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Protected by explainable, audit-ready decisioning.
        </p>
      </div>
    </div>
  );
}
