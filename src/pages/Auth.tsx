import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff, Mail, Lock, User,
  Check, X, KeyRound, Chrome
} from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

// Password strength calculation
const getPasswordStrength = (password: string) => {
  let score = 0;
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  if (checks.length) score += 20;
  if (checks.uppercase) score += 20;
  if (checks.lowercase) score += 20;
  if (checks.number) score += 20;
  if (checks.special) score += 20;

  return { score, checks };
};

const getStrengthLabel = (score: number) => {
  if (score <= 20) return { label: "Very Weak", color: "bg-destructive" };
  if (score <= 40) return { label: "Weak", color: "bg-orange-500" };
  if (score <= 60) return { label: "Fair", color: "bg-yellow-500" };
  if (score <= 80) return { label: "Good", color: "bg-blue-500" };
  return { label: "Strong", color: "bg-success" };
};

export const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("signin");

  // Sign In State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up State
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // 2FA State
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  const passwordStrength = getPasswordStrength(signUpPassword);
  const strengthInfo = getStrengthLabel(passwordStrength.score);

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  // Helper function to check if user needs to see subscription page first
  const checkAndRedirectNewUser = async (userId: string) => {
    try {
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('subscription_shown')
        .eq('id', userId)
        .single();

      // If subscription_shown is false or null, redirect to subscription page
      if (!(profile as any)?.subscription_shown) {
        // Mark as shown
        await (supabase as any)
          .from('profiles')
          .update({ subscription_shown: true })
          .eq('id', userId);

        toast.success("Welcome! Please select a subscription plan.");
        navigate("/subscription-management");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking subscription_shown:", error);
      return false;
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
        }
      });

      if (error) throw error;
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin + '/auth?reset=true',
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // First check if user has 2FA enabled
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('id, two_factor_enabled')
        .eq('email', email.toLowerCase())
        .single();

      // If user has 2FA enabled, we need to verify credentials first, then show OTP
      if (profileData?.two_factor_enabled) {
        // Verify credentials by attempting sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Credentials are valid - immediately sign out and request OTP
        await supabase.auth.signOut();

        // Request OTP
        const { data: otpResponse, error: otpError } = await supabase.functions.invoke('send-otp-email', {
          body: { userId: signInData.user.id, email }
        });

        if (otpError) {
          throw new Error(otpError.message || 'Failed to invoke OTP function');
        }

        if (otpResponse && !otpResponse.success) {
          throw new Error(
            `Failed at step: ${otpResponse.failed_at_step || 'unknown'} - ${otpResponse.error || 'Unknown error'}`
          );
        }

        toast.success("Verification code sent to your email");
        await supabase.auth.signOut();

        // Store credentials for later re-login
        setPendingEmail(email);
        setPendingPassword(password);
        setPendingUserId(signInData.user.id);

        setShowOtpInput(true);
        setLoading(false);
        return;
      }

      // Normal login flow (no 2FA)
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if first-time user - redirect to subscription page
      const redirected = await checkAndRedirectNewUser(signInData.user.id);
      if (!redirected) {
        toast.success("Successfully signed in!");
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify OTP
      const response = await supabase.functions.invoke('verify-otp', {
        body: {
          userId: pendingUserId,
          code: otp
        }
      });

      if (response.error || !response.data?.success) {
        throw new Error(response.data?.error || 'Invalid or expired code');
      }

      // OTP verified - now complete the login
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: pendingEmail,
        password: pendingPassword,
      });

      if (signInError) throw signInError;

      // Check if first-time user - redirect to subscription page
      const redirected = await checkAndRedirectNewUser(signInData.user.id);
      if (!redirected) {
        toast.success("Successfully signed in!");
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke('send-otp-email', {
        body: { email: pendingEmail }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send OTP');
      }

      toast.success("New verification code sent to your email");
      setOtp("");
    } catch (err: any) {
      console.error("Resend OTP error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowOtpInput(false);
    setShowForgotPassword(false);
    setResetEmailSent(false);
    setOtp("");
    setPendingUserId(null);
    setPendingEmail("");
    setPendingPassword("");
    setError(null);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!agreeToTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      setLoading(false);
      return;
    }

    if (signUpPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (passwordStrength.score < 60) {
      setError("Please choose a stronger password");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: window.location.origin + '/auth',
        },
      });

      if (error) throw error;

      toast.success("Account created! Please check your email to verify.");
      setActiveTab("signin");
    } catch (err: any) {
      console.error("Sign up error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Screen
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white dark px-4">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              {resetEmailSent
                ? "Check your email for the reset link"
                : "Enter your email to receive a reset link"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {resetEmailSent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-success" />
                </div>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{forgotEmail}</strong>.
                  Please check your inbox and spam folder.
                </p>
                <Button
                  variant="outline"
                  onClick={handleBackToLogin}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter your email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full gradient-primary" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send Reset Link
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackToLogin}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // OTP Verification Screen
  if (showOtpInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white dark px-4">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter the 6-digit code sent to<br />
              <span className="font-medium text-foreground">{pendingEmail}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
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

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleVerifyOtp}
              className="w-full gradient-primary"
              disabled={loading || otp.length !== 6}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify & Sign In
            </Button>

            <div className="flex items-center justify-between text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToLogin}
                className="gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={handleResendOtp}
                disabled={loading}
              >
                Resend Code
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Code expires in 10 minutes
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white dark px-4 py-8">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center mb-3 shadow-glow">
            <Lock className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to Xrozen</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Google Sign In Button */}
          <Button
            variant="outline"
            className="w-full mb-4 h-11 font-medium"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <Chrome className="w-5 h-5 mr-2" />
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 h-auto text-xs text-primary"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full gradient-primary h-11" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullname"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showSignUpPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    >
                      {showSignUpPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>

                  {/* Password Strength Indicator */}
                  {signUpPassword && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between text-xs">
                        <span>Password Strength</span>
                        <span className={`font-medium ${strengthInfo.color.replace('bg-', 'text-')}`}>
                          {strengthInfo.label}
                        </span>
                      </div>
                      <Progress value={passwordStrength.score} className="h-1.5" />
                      <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.length ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.length ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          8+ characters
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.uppercase ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.uppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          Uppercase
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.lowercase ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.lowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          Lowercase
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.number ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.number ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          Number
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.special ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.special ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          Special char
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pl-10 pr-10 ${confirmPassword && confirmPassword !== signUpPassword ? 'border-destructive' : ''}`}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {confirmPassword && confirmPassword !== signUpPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>

                {/* Terms Checkbox */}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                    I agree to the <a href="/terms" className="text-primary hover:underline">Terms of Service</a> and{" "}
                    <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                  </label>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full gradient-primary h-11"
                  disabled={loading || !agreeToTerms || passwordStrength.score < 60 || confirmPassword !== signUpPassword}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
