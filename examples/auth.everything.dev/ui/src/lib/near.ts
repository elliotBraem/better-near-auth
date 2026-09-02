import { useNearAccountId as useNearAccountIdOf } from "better-near-auth/react";
import { useAuthClient } from "./auth";

export function useNearAccountId() {
  return useNearAccountIdOf(useAuthClient());
}
