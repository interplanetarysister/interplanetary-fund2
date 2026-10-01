import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import SocialButtons from "@/components/auth/SocialButtons";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { safeAuthErrorMessage } from "@/lib/safe-auth-error";

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const validateRegistration = () => {
    const next = {};
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) next.email = "Enter a valid email address.";
    else if (/\.con$/i.test(cleanEmail)) next.email = "Check the email ending. Did you mean .com?";
    if (!cleanUsername) next.username = "Enter a username.";
    else if (cleanUsername.length > 80) next.username = "Keep your username under 80 characters.";
    if (!password) next.password = "Enter a password.";
    if (password !== confirmPassword) next.confirmPassword = "Passwords do not match.";
    return { next, cleanEmail };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const { next, cleanEmail } = validateRegistration();
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    setEmail(cleanEmail);
    setLoading(true);
    try {
      await base44.auth.register({ email: cleanEmail, password });
      setShowOtp(true);
    } catch (err) {
      setError(safeAuthErrorMessage("register"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        if (username.trim()) {
          try {
            await base44.auth.updateMe({ username: username.trim() });
          } catch {
            // Username save is best-effort; don't block login on it.
          }
        }
      }
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(safeAuthErrorMessage("verify"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(safeAuthErrorMessage("resend"));
    }
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a code to ${email}`}
      >
        {error && (
          <div role="alert" aria-live="polite" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <SocialButtons returnTo={safeReturnTo()} />

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="yourhandle"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setFieldErrors((v) => ({ ...v, username: "" })); }}
              className="pl-10 h-12"
              aria-invalid={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? "username-error" : undefined}
              required
            />
          </div>
          {fieldErrors.username && <p id="username-error" role="alert" className="text-sm text-destructive">{fieldErrors.username}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((v) => ({ ...v, email: "" })); }}
              className="pl-10 h-12"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              required
            />
          </div>
          {fieldErrors.email && <p id="email-error" role="alert" className="text-sm text-destructive">{fieldErrors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((v) => ({ ...v, password: "", confirmPassword: "" })); }}
              className="pl-10 h-12"
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              required
            />
          </div>
          {fieldErrors.password && <p id="password-error" role="alert" className="text-sm text-destructive">{fieldErrors.password}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((v) => ({ ...v, confirmPassword: "" })); }}
              className="pl-10 h-12"
              aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={fieldErrors.confirmPassword ? "confirm-error" : undefined}
              required
            />
          </div>
          {fieldErrors.confirmPassword && <p id="confirm-error" role="alert" className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>}
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}