import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { Skeleton } from "./ui/skeleton";
import type { Profile } from "better-near-auth";
import Markdown from "react-markdown";

interface NearProfileProps {
  accountId?: string;
  variant?: "badge" | "card";
  showAvatar?: boolean;
  showName?: boolean;
  className?: string;
}

export function NearProfile({
  accountId,
  variant = "badge",
  showAvatar = true,
  showName = true,
  className = "",
}: NearProfileProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const profileResponse = await authClient.near.getProfile(accountId);
        setProfile(profileResponse.data || null);
      } catch (err) {
        console.error("Failed to fetch NEAR profile:", err);
        setError("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [accountId]);

  const displayName = profile?.name;
  const avatarUrl =
    profile?.image?.url || profile?.image?.ipfs_cid
      ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}`
      : null;
  const backgroundUrl =
    profile?.backgroundImage?.url || profile?.backgroundImage?.ipfs_cid
      ? `https://ipfs.near.social/ipfs/${profile.backgroundImage.ipfs_cid}`
      : null;

  if (isLoading) {
    if (variant === "card") {
      return (
        <div className={`w-full ${className}`}>
          <div className="relative">
            <Skeleton className="h-32 w-full rounded-t-lg" />
            <div className="absolute -bottom-6 left-6">
              <Skeleton className="h-12 w-12 rounded-full border-4 border-background" />
            </div>
          </div>
          <div className="pt-8 px-6 pb-6">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-full mb-4" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex items-center justify-start space-x-3 w-24 ${className}`}
      >
        {showAvatar && (
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        )}
        {showName && <Skeleton className="h-4 w-16 flex-shrink-0" />}
      </div>
    );
  }

  if (error) {
    if (variant === "card") {
      return (
        <div className={`w-full bg-card rounded-lg border ${className}`}>
          <div className="p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-lg mx-auto mb-4">
              ?
            </div>
            <p className="text-sm text-muted-foreground">
              Failed to load profile
            </p>
            {accountId && (
              <p className="text-xs text-muted-foreground mt-1">{accountId}</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {showAvatar && (
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
            ?
          </div>
        )}
        {showName && <span className="text-sm text-gray-500">{accountId}</span>}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`w-full bg-card rounded-lg border overflow-hidden ${className}`}
      >
        {/* Background Image Header */}
        <div className="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600">
          {backgroundUrl && (
            <img
              src={backgroundUrl}
              alt="Profile background"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          {/* Avatar positioned over background */}
          <div className="absolute -bottom-6 left-6">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-background border-4 border-background">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${displayName} avatar`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm font-medium text-muted-foreground bg-muted">
                  {displayName?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="pt-8 px-6 pb-6">
          <h3 className="text-lg font-semibold mb-1">{displayName}</h3>
          {accountId && displayName !== accountId && (
            <p className="text-sm text-muted-foreground mb-3">@{accountId}</p>
          )}

          {profile?.description && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              <Markdown>{profile.description}</Markdown>
            </p>
          )}

          {/* Social Links */}
          {profile?.linktree && Object.keys(profile.linktree).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(profile.linktree).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-muted hover:bg-muted/80 transition-colors"
                >
                  {platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Badge variant (default)
  return (
    <div
      className={`flex items-center justify-start space-x-2 w-24 ${className}`}
    >
      {showAvatar && (
        <div className="h-6 w-6 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${displayName} avatar`}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs font-medium text-gray-600">
              {displayName?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      {showName && (
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium truncate text-left">
            {displayName}
          </span>
        </div>
      )}
    </div>
  );
}
