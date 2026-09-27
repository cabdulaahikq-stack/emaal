import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, setAuthToken, ApiError } from "../api/client";
import type { User } from "../api/types";

const TOKEN_KEY = "emaal.token";
const USER_KEY = "emaal.user";

// expo-secure-store has no web implementation; localStorage is fine for the
// web preview build (used only for local dev/QA, not a real deployment target).
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface AuthState {
  status: "loading" | "signedOut" | "locked" | "unlocked";
  user: User | null;
  signup: (input: { fullName: string; phone: string; password: string; pin: string }) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const [token, storedUser] = await Promise.all([storage.getItem(TOKEN_KEY), storage.getItem(USER_KEY)]);
      if (token && storedUser) {
        setAuthToken(token);
        setUser(JSON.parse(storedUser));
        setStatus("locked"); // a saved session always re-requires the PIN before use
      } else {
        setStatus("signedOut");
      }
    })();
  }, []);

  const persistSession = useCallback(async (token: string, nextUser: User) => {
    setAuthToken(token);
    await storage.setItem(TOKEN_KEY, token);
    await storage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const signup = useCallback<AuthState["signup"]>(
    async (input) => {
      const res = await api.post<{ token: string; user: User }>("/auth/signup", input);
      await persistSession(res.token, res.user);
      setStatus("unlocked");
    },
    [persistSession],
  );

  const login = useCallback<AuthState["login"]>(
    async (phone, password) => {
      const res = await api.post<{ token: string; user: User }>("/auth/login", { phone, password });
      await persistSession(res.token, res.user);
      setStatus("unlocked");
    },
    [persistSession],
  );

  const unlock = useCallback<AuthState["unlock"]>(async (pin) => {
    await api.post("/auth/verify-pin", { pin });
    setStatus("unlocked");
  }, []);

  const logout = useCallback(async () => {
    setAuthToken(null);
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(() => ({ status, user, signup, login, unlock, logout }), [status, user, signup, login, unlock, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
