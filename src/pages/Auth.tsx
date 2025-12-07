import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign In State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign Up State
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // 2FA State
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

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

        // Request OTP BEFORE signing out to ensure we have a valid session token
        const { data: otpResponse, error: otpError } = await supabase.functions.invoke('send-otp-email', {
          body: { userId: signInData.user.id, email }
        });

        console.log('OTP Response:', otpResponse);

        if (otpError) {
          console.error('OTP Invoke Error:', otpError);
          throw new Error(otpError.message || 'Failed to invoke OTP function');
        }

        // Check the success flag from our function (which now returns 200 even on error)
        if (otpResponse && !otpResponse.success) {
          console.error('OTP Function Logic Error:', otpResponse);
          throw new Error(
            `Failed at step: ${otpResponse.failed_at_step || 'unknown'} - ${otpResponse.error || 'Unknown error'}`
          );
        }

        toast.success("Verification code sent to your email");

        // NOW we can receive the OTP, so strict security might want to sign out.
        // But for better UX (and to keep session valid if they need to Resend), 
        // we can keep them signed in but "locked" behind the OTP screen.
        // However, existing logic preferred sign out. Let's sign out NOW.
        await supabase.auth.signOut();

        // Store credentials for later re-login
        setPendingEmail(email);
        setPendingPassword(password);
        setPendingUserId(signInData.user.id);

        setShowOtpInput(true);
        setLoading(false);
        return;
        return;
      }

      // Normal login flow (no 2FA)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Successfully signed in!");
      navigate("/dashboard");
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: pendingEmail,
        password: pendingPassword,
      });

      if (signInError) throw signInError;

      toast.success("Successfully signed in!");
      navigate("/dashboard");
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

    try {
      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      toast.success("Account created successfully! Please sign in.");
    } catch (err: any) {
      console.error("Sign up error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // OTP Verification Screen
  if (showOtpInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
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
              className="w-full"
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input
                    id="fullname"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign Up
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
