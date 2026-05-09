import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getAuthClient } from "@/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { sessionQueryOptions } from "@/lib/session";

type SearchParams = {
  redirect?: string;
};

type AuthMethod = "near" | "email" | "phone" | "passkey" | "anonymous" | "github";

export const Route = createFileRoute("/_layout/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    const { queryClient } = context;
    const initialSession = context.session;
    const session =
      initialSession ??
      queryClient.getQueryData(sessionQueryOptions(initialSession, context.runtimeConfig).queryKey);

    if (session?.user) {
      const redirectTo = search.redirect?.startsWith("/") ? search.redirect : "/home";
      throw redirect({ to: redirectTo, search: {} });
    }
  },
  loader: ({ context }) => {
    const initialSession = context.session;

    void context.queryClient.prefetchQuery(
      sessionQueryOptions(initialSession, context.runtimeConfig),
    );
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { runtimeConfig } = Route.useRouteContext();
  const auth = getAuthClient(runtimeConfig);
  const { data: session } = useQuery(sessionQueryOptions(undefined, runtimeConfig));
  const { redirect } = Route.useSearch();
  const [authMethod, setAuthMethod] = useState<AuthMethod>("anonymous");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const handleSuccess = async (message: string) => {
    const redirectTo = redirect?.startsWith("/") ? redirect : "/home";
    toast.success(message);
    const { data: freshSession } = await auth.getSession();
    if (freshSession) {
      queryClient.setQueryData(["session"], freshSession);
    }
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    navigate({ to: redirectTo, replace: true, search: {} });
  };

  const handleError = (error: { code?: string; message?: string } | Error) => {
    const code = "code" in error ? error.code : undefined;
    const message = "message" in error ? error.message : "Failed to sign in";

    if (code === "UNAUTHORIZED_NONCE_REPLAY") {
      toast.error("Sign-in already used");
    } else if (code === "UNAUTHORIZED_INVALID_SIGNATURE") {
      toast.error("Invalid signature");
    } else if (code === "SIGNER_NOT_AVAILABLE") {
      toast.error("NEAR wallet not available");
    } else {
      toast.error(message || "Failed to sign in");
    }
  };

  const handleNear = async () => {
    setIsPending(true);
    await auth.signIn.near({
      onSuccess: async () => {
        setIsPending(false);
        await handleSuccess("Signed in with NEAR");
      },
      onError: (error) => {
        setIsPending(false);
        handleError(error);
      },
    });
  };

  const handlePasskey = async () => {
    setIsPending(true);
    try {
      await auth.signIn.passkey({
        autoFill: false,
        fetchOptions: {
          onSuccess: async () => {
            setIsPending(false);
            await handleSuccess("Signed in with passkey");
          },
          onError: (ctx) => {
            setIsPending(false);
            handleError(new Error(ctx.error?.message || "Passkey sign in failed"));
          },
        },
      });
    } catch {
      setIsPending(false);
    }
  };

  const handleAnonymous = async () => {
    setIsPending(true);
    try {
      await auth.signIn.anonymous({
        fetchOptions: {
          onSuccess: async () => {
            setIsPending(false);
            await handleSuccess("Started anonymous session");
          },
          onError: (ctx) => {
            setIsPending(false);
            handleError(new Error(ctx.error?.message || "Anonymous sign in failed"));
          },
        },
      });
    } catch {
      setIsPending(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setIsPending(true);
    try {
      await auth.signIn.email({
        email,
        password,
        fetchOptions: {
          onSuccess: async () => {
            setIsPending(false);
            await handleSuccess("Signed in successfully");
          },
          onError: (ctx) => {
            setIsPending(false);
            handleError(new Error(ctx.error?.message || "Sign in failed"));
          },
        },
      });
    } catch {
      setIsPending(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setIsPending(true);
    try {
      await auth.signUp.email({
        email,
        password,
        name: email.split("@")[0],
        fetchOptions: {
          onSuccess: async () => {
            setIsPending(false);
            await handleSuccess("Account created! Check your email to verify.");
          },
          onError: (ctx) => {
            setIsPending(false);
            handleError(new Error(ctx.error?.message || "Sign up failed"));
          },
        },
      });
    } catch {
      setIsPending(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setIsPending(true);
    try {
      await auth.phoneNumber.sendOtp({
        phoneNumber,
        fetchOptions: {
          onSuccess: () => {
            setOtpSent(true);
            toast.success("Verification code sent!");
          },
          onError: (ctx) => handleError(new Error(ctx.error?.message || "Failed to send code")),
        },
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 4) {
      toast.error("Please enter the verification code");
      return;
    }
    setIsPending(true);
    try {
      await auth.phoneNumber.verify({
        phoneNumber,
        code: otpCode,
        fetchOptions: {
          onSuccess: async () => {
            setIsPending(false);
            await handleSuccess("Signed in with phone");
          },
          onError: (ctx: { error?: { message?: string } }) => {
            setIsPending(false);
            handleError(new Error(ctx.error?.message || "Invalid code"));
          },
        },
      });
    } catch {
      setIsPending(false);
    }
  };

  const handleGithub = async () => {
    setIsPending(true);
    try {
      await auth.signIn.social({
        provider: "github",
        callbackURL: redirect?.startsWith("/") ? redirect : "/home",
        fetchOptions: {
          onSuccess: () => handleSuccess("Signed in with GitHub"),
          onError: (ctx) => handleError(new Error(ctx.error?.message || "GitHub sign in failed")),
        },
      });
    } finally {
      setIsPending(false);
    }
  };

  if (session?.user) {
    const redirectTo = redirect?.startsWith("/") ? redirect : "/home";
    return <Navigate to={redirectTo} replace search={{}} />;
  }

  const renderAuthMethod = () => {
    switch (authMethod) {
      case "near":
        return (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Connect your NEAR wallet for on-chain identity
            </p>
            <Button onClick={handleNear} disabled={isPending} className="w-full">
              {isPending ? "connecting..." : "connect NEAR wallet"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Recommended for blockchain features
            </p>
          </div>
        );

      case "passkey":
        return (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Use Face ID, Touch ID, or security key
            </p>
            <Button onClick={handlePasskey} disabled={isPending} className="w-full">
              {isPending ? "authenticating..." : "sign in with passkey"}
            </Button>
          </div>
        );

      case "anonymous":
        return (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Start without creating an account or saving persistent data
            </p>
            <Button onClick={handleAnonymous} disabled={isPending} className="w-full">
              {isPending ? "starting..." : "continue anonymously"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Your session will not persist after you sign out
            </p>
          </div>
        );

      case "email":
        return (
          <div className="space-y-6">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
            />
            <Button
              onClick={isSignUp ? handleEmailSignUp : handleEmailSignIn}
              disabled={isPending}
              className="w-full"
            >
              {isPending
                ? isSignUp
                  ? "creating..."
                  : "signing in..."
                : isSignUp
                  ? "create account"
                  : "sign in"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={isPending}
              className="w-full"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </Button>
          </div>
        );

      case "phone":
        return (
          <div className="space-y-6">
            {!otpSent ? (
              <>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
                <Button onClick={handleSendOtp} disabled={isPending} className="w-full">
                  {isPending ? "sending..." : "send code"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Enter your phone number to receive a verification code
                </p>
              </>
            ) : (
              <>
                <Input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center tracking-widest"
                />
                <Button onClick={handleVerifyOtp} disabled={isPending} className="w-full">
                  {isPending ? "verifying..." : "verify & sign in"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  disabled={isPending}
                  className="w-full"
                >
                  Use different phone number
                </Button>
              </>
            )}
          </div>
        );

      case "github":
        return (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Sign in with your GitHub account
            </p>
            <Button onClick={handleGithub} disabled={isPending} className="w-full">
              {isPending ? "redirecting..." : "sign in with GitHub"}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-[70vh] w-full flex items-start justify-center px-6 pt-[15vh] animate-fade-in">
      <div className="w-full max-w-sm space-y-8">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {(["anonymous", "near", "github", "passkey", "email", "phone"] as AuthMethod[]).map(
            (method) => (
              <Button
                key={method}
                variant={authMethod === method ? "default" : "outline"}
                size="sm"
                onClick={() => setAuthMethod(method)}
                disabled={isPending}
                className={`w-full capitalize ${method === "anonymous" ? "col-span-2" : ""}`}
              >
                {method}
              </Button>
            ),
          )}
        </div>

        <div className="animate-fade-in-up" key={authMethod}>
          {renderAuthMethod()}
        </div>

        {authMethod !== "near" && (
          <div className="pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              You can link a NEAR wallet later for on-chain features
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
