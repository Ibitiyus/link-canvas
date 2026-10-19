import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../cloud/config";
import { cloudError } from "../cloud/errors";
interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string;
  recovery: boolean;
  signOut: () => Promise<void>;
}
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(!!supabase),
    [error, setError] = useState(""),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true,
      eventSeen = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      eventSeen = true;
      if (active) {
        setSession(next);
        setLoading(false);
        setRecovery(event === "PASSWORD_RECOVERY");
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !eventSeen) {
          setSession(data.session);
          setError(error ? cloudError(error) : "");
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setError(cloudError(error));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const signOut = async () => {
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) throw error;
    setSession(null);
    setRecovery(false);
  };
  return (
    <Context.Provider value={{ session, loading, error, recovery, signOut }}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
