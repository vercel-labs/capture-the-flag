"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const COOKIE_NAME = "match-web-secret";
const PARAM_NAME = "match-web-secret";

export function MatchWebSecretCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const secret = searchParams.get(PARAM_NAME);
    if (secret) {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(secret)}; path=/; SameSite=Lax`;
    }
  }, [searchParams]);

  return null;
}
