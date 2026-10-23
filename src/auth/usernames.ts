export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "dashboard",
  "editor",
  "help",
  "login",
  "logout",
  "moderator",
  "preview",
  "public",
  "register",
  "reset",
  "root",
  "settings",
  "storage",
  "supabase",
  "support",
  "system",
  "user",
  "users",
  "www",
  "zin",
]);
export function usernameError(value: string): string {
  if (!/^[a-z][a-z0-9_]{2,29}$/.test(value))
    return "От 3 до 30 символов: латинские строчные буквы, цифры и _. Начните с буквы.";
  if (RESERVED_USERNAMES.has(value)) return "Это имя зарезервировано системой.";
  return "";
}
export function safeReturnPath(value: string | null) {
  return ["/editor", "/dashboard", "/preview", "/explore"].includes(value ?? "")
    ? value!
    : "/dashboard";
}
