import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
function isServerKey(value: string) {
  if (value.startsWith("sb_secret_")) return true;
  try {
    return (
      JSON.parse(
        atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).role === "service_role"
    );
  } catch {
    return false;
  }
}
let validAddress = true;
try {
  if (url) validAddress = ["http:", "https:"].includes(new URL(url).protocol);
} catch {
  validAddress = false;
}
export const configurationError = !validAddress
  ? "Некорректный адрес Supabase. Проверьте настройки; локальный редактор доступен."
  : key && isServerKey(key)
    ? "В браузерной конфигурации указан серверный ключ. Используйте только publishable или anon key."
    : !!url !== !!key
      ? "Для облачного режима нужны адрес Supabase и публичный ключ."
      : "";
export const supabase =
  url && key && !configurationError
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
export const cloudConfigured = !!supabase;
export const cloudUrl = (url ?? "").replace(/\/$/, "");
export const cloudKey = key ?? "";
const configuredLimit = Number(import.meta.env.VITE_CLOUD_MAX_FILE_MB ?? 50);
export const maxCloudFileBytes =
  (Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : 50) *
  1024 *
  1024;
export function requireCloud() {
  if (!supabase)
    throw new Error(
      configurationError ||
        "Облачный режим пока не настроен. Локальный редактор доступен без аккаунта.",
    );
  return supabase;
}
/** Pin every request to the initiating user, even while another account signs in. */
export function ownerClient(ownerId: string) {
  requireCloud();
  return createClient(cloudUrl, cloudKey, {
    accessToken: async () => {
      const { data, error } = await requireCloud().auth.getSession();
      if (error || data.session?.user.id !== ownerId)
        throw new Error("SESSION_CHANGED");
      return data.session.access_token;
    },
  });
}
