import { createAuthClient } from "better-auth/react";
import { siwnClient } from "better-near-auth/client";

const getServerUrl = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl) {
    return envUrl;
  }
  // Default to localhost:3000 for development
  return import.meta.env.DEV ? "http://localhost:3000" : undefined;
};

const serverUrl = getServerUrl();

export const authClient = createAuthClient({
  baseURL: serverUrl || "http://localhost:3000",
  plugins: [
    siwnClient({
      domain: "better-near-auth.near",
      networkId: "mainnet",
    }),
  ],
});
