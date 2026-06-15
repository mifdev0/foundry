"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders, getCurrentUserId, scopedKey } from "@/lib/auth-client";

type AvatarProps = {
  size?: number;
  className?: string;
};

export default function Avatar({ size = 36, className = "" }: AvatarProps) {
  const [avatar, setAvatar] = useState<string>("");

  useEffect(() => {
    const sync = async () => {
      const userId = await getCurrentUserId();
      try {
        const response = await fetch("/api/profile", { cache: "no-store", headers: await getAuthHeaders() });
        if (response.ok) {
          const body = (await response.json()) as { profile?: { avatar_url?: string | null } };
          const avatarUrl = body.profile?.avatar_url ?? "";
          setAvatar(avatarUrl || window.localStorage.getItem(scopedKey(userId, "avatar")) || "");
          if (avatarUrl) window.localStorage.setItem(scopedKey(userId, "avatar"), avatarUrl);
          return;
        }
      } catch {
        // Keep local fallback below.
      }

      setAvatar(window.localStorage.getItem(scopedKey(userId, "avatar")) ?? "");
    };
    const handleSync = () => void sync();
    handleSync();
    window.addEventListener("storage", handleSync);
    window.addEventListener("foundry-profile-updated", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("foundry-profile-updated", handleSync);
    };
  }, []);

  if (avatar) {
    return <img src={avatar} alt="Avatar profil" className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
  }

  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-primary-container font-bold text-white ${className}`} style={{ width: size, height: size }}>
      M
    </span>
  );
}
