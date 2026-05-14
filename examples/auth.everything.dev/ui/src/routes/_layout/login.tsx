import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnderConstruction } from "@/components/under-construction";

type SearchParams = {
  redirect?: string;
};

type AuthMethod = "near" | "email" | "phone" | "passkey" | "anonymous" | "github";

type ConditionalPublicKeyCredential = typeof PublicKeyCredential & {
  isConditionalMediationAvailable?: () => Promise<boolean>;
};

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
      queryClient.getQueryData(sessionQueryOptions(context.authClient, initialSession).queryKey);

    if (session?.user) {
      const redirectTo = search.redirect?.startsWith("/") ? search.redirect : "/home";
      throw redirect({ to: redirectTo, search: {} });
    }
  },
  loader: ({ context }) => {
    const initialSession = context.session;

    void context.queryClient.prefetchQuery(sessionQueryOptions(context.authClient, initialSession));
  },
  component: LoginPage,
});

function getPasskeySupportError() {
  if (typeof window === "undefined") {
    return "Passkeys are only available in the browser.";
  }
  if (!window.isSecureContext) {
    return "Passkeys require HTTPS or localhost.";
  }
  if (!("PublicKeyCredential" in window)) {
    return "This browser does not support passkeys.";
  }
  return null;
}

function getPublicKeyCredentialConstructor() {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
    return null;
  }
  return window.PublicKeyCredential as ConditionalPublicKeyCredential;
}

function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
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
  const passkeySupportError = authMethod === "passkey" ? getPasskeySupportError() : null;

  const handleSuccess = useCallback(async (message: string) => {
    const redirectTo = redirect?.startsWith("/") ? redirect : "/home";
    toast.success(message);
    queryClient.removeQueries({ queryKey: ["passkeys"] });
    const { data: freshSession } = await auth.getSession();
    if (freshSession) {
      queryClient.setQueryData(["session"], freshSession);
    }
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    navigate({ to: redirectTo, replace: true, search: {} });
  }, [auth, navigate, queryClient, redirect]);

  const handleError = useCallback((error: { code?: string; message?: string } | Error) => {
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
  }, []);

  useEffect(() => {
    if (authMethod !== "passkey" || session?.user || getPasskeySupportError()) {
      return;
    }

    let isActive = true;

    void (async () => {
      const credential = getPublicKeyCredentialConstructor();
      const isConditionalAvailable = await credential?.isConditionalMediationAvailable?.();
      if (!isConditionalAvailable || !isActive) {
        return;
      }

      const result = await auth.signIn.passkey({
        autoFill: true,
        fetchOptions: {
          onSuccess: async () => {
            if (!isActive) return;
            await handleSuccess("Signed in with passkey");
          },
          // Conditional autofill failures are silent — the browser had no
          // credential to offer, the user dismissed, or Firefox rejected the
          // request.  Never show an error toast for a background probe.
          onError: () => {},
        },
      });

      // Same: swallow result errors from the background conditional request.
      void result;
    })().catch(() => {});

    return () => {
      isActive = false;
    };
  }, [auth, authMethod, handleError, handleSuccess, session?.user]);

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
    if (passkeySupportError) {
      toast.error(passkeySupportError);
      return;
    }

    setIsPending(true);
    let callbackHandled = false;
    try {
      const result = await auth.signIn.passkey({
        autoFill: false,
        fetchOptions: {
          onSuccess: async () => {
            callbackHandled = true;
            setIsPending(false);
            await handleSuccess("Signed in with passkey");
          },
          onError: (ctx) => {
            callbackHandled = true;
            setIsPending(false);
            handleError(new Error(ctx.error?.message || "Passkey sign in failed"));
          },
        },
      });
      if (!callbackHandled && result?.error) {
        setIsPending(false);
        handleError(new Error(result.error.message || "Passkey sign in failed"));
      } else if (!callbackHandled) {
        setIsPending(false);
      }
    } catch (error) {
      setIsPending(false);
      if (!callbackHandled) {
        handleError(error instanceof Error ? error : new Error("Passkey sign in failed"));
      }
    }
  };

  const handlePasskeySignUp = async () => {
    if (passkeySupportError) {
      toast.error(passkeySupportError);
      return;
    }
    setIsPending(true);
    try {
      let anonOk = false;
      await auth.signIn.anonymous({
        fetchOptions: {
          onSuccess: () => { anonOk = true; },
          onError: (ctx) => {
            handleError(new Error(ctx.error?.message || "Failed to create account"));
          },
        },
      });
      if (!anonOk) {
        setIsPending(false);
        return;
      }

      let callbackHandled = false;
      const result = await auth.passkey.addPasskey({
        fetchOptions: {
          onSuccess: async () => {
            callbackHandled = true;
            setIsPending(false);
            await handleSuccess("Passkey created — you're signed in");
          },
          onError: async (ctx) => {
            callbackHandled = true;
            setIsPending(false);
            await auth.signOut();
            handleError(new Error(ctx.error?.message || "Failed to create passkey"));
          },
        },
      });
      if (!callbackHandled) {
        setIsPending(false);
        if (result?.error) {
          await auth.signOut();
          handleError(new Error(result.error.message || "Failed to create passkey"));
        }
      }
    } catch (error) {
      setIsPending(false);
      await auth.signOut();
      handleError(error instanceof Error ? error : new Error("Failed to create passkey"));
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
            {passkeySupportError && (
              <p className="text-xs text-destructive text-center leading-relaxed">
                {passkeySupportError}
              </p>
            )}
            <Button
              onClick={handlePasskey}
              disabled={isPending || !!passkeySupportError}
              className="w-full"
            >
              {isPending ? "authenticating..." : "sign in with passkey"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePasskeySignUp}
              disabled={isPending || !!passkeySupportError}
              className="w-full"
            >
              {isPending ? "setting up..." : "sign up with passkey"}
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
            <UnderConstruction
              label="email"
              sourceFile="ui/src/routes/_layout/login.tsx"
              className="mx-auto w-full max-w-xs"
            />
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
            <UnderConstruction
              label="phone"
              sourceFile="ui/src/routes/_layout/login.tsx"
              className="mx-auto w-full max-w-xs"
            />
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
            <UnderConstruction
              label="github"
              sourceFile="ui/src/routes/_layout/login.tsx"
              className="mx-auto w-full max-w-xs"
            />
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
                className={`w-full capitalize ${method === "anonymous" ? "col-span-2" : ""} ${method === "near" && authMethod === "near" ? "!bg-green-600 hover:!bg-green-700 !border-green-600" : ""}`}
              >
                {method === "near" ? "NEAR" : method}
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
