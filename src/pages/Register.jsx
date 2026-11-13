import React, { useState } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { runtimeContract } from "@/lib/runtimeContract";
import { appParams } from "@/lib/app-params";
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
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);

  React.useEffect(() => {
    if (!showOtp || resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds(Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000))), 1000);
    return () => window.clearTimeout(timer);
  }, [showOtp, resendAvailableAt, resendSeconds]);

  // Match the login transport: web requests use the current origin, while
  // native Android uses the canonical Base44 HTTPS endpoint.
  const authRequest = async (operation, payload) => {
    const appId = runtimeContract.appId || appParams.appId;
    if (!appId) throw new Error("IFund app ID unavailable");
    const path = `/api/apps/${encodeURIComponent(appId)}/auth/${operation}`;
    const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
    if (native) {
      const response = await CapacitorHttp.post({
        url: `https://interplanetaryfund.base44.app${path}`,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        data: payload,
      });
      if (response.status < 200 || response.status >= 300) {
        const error = new Error("Authentication request failed");
        error.status = response.status;
        throw error;
      }
      return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    }
    const response = await fetch(path, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = new Error("Authentication request failed");
      error.status = response.status;
      throw error;
    }
    return response.json().catch(() => ({}));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authRequest("register", { email: email.trim().toLowerCase(), password });
      setOtpCode("");
      setShowOtp(true);
      setResendAvailableAt(Date.now() + 60000);
      setResendSeconds(60);
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
      const result = await authRequest("verify-otp", { email: email.trim().toLowerCase(), otp_code: otpCode });
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
      const requestedReturn = safeReturnTo();
      if (requestedReturn !== "/" && requestedReturn !== "/onboarding") {
        sessionStorage.setItem("ifund_post_onboarding_return_to", requestedReturn);
      }
      window.location.href = "/onboarding";
    } catch (err) {
      setError(safeAuthErrorMessage("verify"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || loading || Date.now() < resendAvailableAt) return;
    setError("");
    setResending(true);
    try {
      await authRequest("resend-otp", { email: email.trim().toLowerCase() });
      setOtpCode("");
      setResendAvailableAt(Date.now() + 60000);
      setResendSeconds(60);
      toast({
        title: "Verification requested",
        description: "If delivery is available, a new code will arrive shortly. Check your inbox and spam folder.",
      });
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      if (status === 429) {
        setResendAvailableAt(Date.now() + 60000);
        setResendSeconds(60);
        setError("Too many code requests. Wait a minute before trying again.");
      } else {
        setError(safeAuthErrorMessage("resend"));
      }
    } finally {
      setResending(false);
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
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
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
          <button type="button" onClick={handleResend} disabled={resending || loading || resendSeconds > 0} className="text-primary font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
            {resending ? "Requesting..." : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
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
      <SocialButtons returnTo="/onboarding" />

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <p className="text-sm text-muted-foreground">After verification, you will review and accept our <Link className="underline text-primary" to="/terms">Terms of Service</Link> and <Link className="underline text-primary" to="/privacy">Privacy Policy</Link> before using IFund account features.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
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
              onChange={(e) => setUsername(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
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
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
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
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
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
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
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