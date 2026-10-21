import { recoveryState } from "./session";
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
    const watchdog = window.setTimeout(() => {
      if (active && !eventSeen) {
        setError(
          "Проверка сессии задерживается. Локальный редактор доступен; для облачной версии проверьте подключение и войдите снова.",
        );
        setLoading(false);
      }
    }, 10000);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      eventSeen = true;
      clearTimeout(watchdog);
      if (active) {
        setSession(next);
        setLoading(false);
        setRecovery((previous) => recoveryState(previous, event));
        setError("");
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        clearTimeout(watchdog);
        if (active && !eventSeen) {
          setSession(data.session);
          setError(error ? cloudError(error) : "");
          setLoading(false);
        }
      })
      .catch((error) => {
        clearTimeout(watchdog);
        if (active && !eventSeen) {
          setError(cloudError(error));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      clearTimeout(watchdog);
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
