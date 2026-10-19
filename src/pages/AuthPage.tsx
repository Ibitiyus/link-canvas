import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Brand } from "../components/ui/Brand";
import { useAuth } from "../auth/AuthContext";
import { safeReturnPath, usernameError } from "../auth/usernames";
import {
  cloudConfigured,
  configurationError,
  requireCloud,
} from "../cloud/config";
import { cloudError } from "../cloud/errors";
export function AuthPage({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset";
}) {
  const auth = useAuth(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const next = safeReturnPath(params.get("next"));
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [username, setUsername] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setError("");
    setMessage("");
    setPassword("");
  }, [mode]);
  useEffect(() => {
    if (auth.session && mode !== "reset" && mode !== "forgot" && !auth.recovery)
      navigate(next, { replace: true });
  }, [auth.session, auth.recovery, mode, navigate, next]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const client = requireCloud();
      if (mode === "register") {
        const invalid = usernameError(username);
        if (invalid) throw new Error(invalid);
        const available = await client.rpc("username_available", {
          value: username,
        });
        if (available.error) throw available.error;
        if (!available.data)
          throw new Error("Это имя пользователя уже занято.");
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: `${location.origin}/login?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (!data.session)
          setMessage(
            "Проверьте почту и подтвердите email. После подтверждения войдите в аккаунт.",
          );
      } else if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate(next, { replace: true });
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage(
          "Если этот email зарегистрирован, на него придёт письмо со ссылкой для смены пароля.",
        );
      } else {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Пароль изменён. Теперь можно открыть личный кабинет.");
        setPassword("");
      }
    } catch (error) {
      setError(cloudError(error));
    } finally {
      setBusy(false);
    }
  };
  const title = {
    login: "Вход в ZIN",
    register: "Создайте аккаунт",
    forgot: "Восстановление пароля",
    reset: "Новый пароль",
  }[mode];
  return (
    <div className="account-page">
      <header>
        <Brand />
        <Link to="/editor">Продолжить без аккаунта ↗</Link>
      </header>
      <main className="auth-card">
        <span className="eyebrow">ВАШЕ ПРОСТРАНСТВО В ОБЛАКЕ</span>
        <h1>{title}</h1>
        <p>
          Локальная страница остаётся в этом браузере. После входа вы сможете
          выбрать её перенос в облако.
        </p>
        {!cloudConfigured && (
          <p className="account-notice" role="status">
            {configurationError ||
              "Облачный режим пока не подключён. Редактор и локальное сохранение доступны без регистрации."}
          </p>
        )}
        {auth.error && (
          <p role="alert" className="field-error">
            {auth.error}
          </p>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="account-notice">
            {message}
          </p>
        )}
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Имя пользователя
              <input
                aria-label="Имя пользователя"
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().trim())
                }
              />
              <small>
                Латинские буквы, цифры и _. Адрес страницы: /u/
                {username || "ваше_имя"}
              </small>
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              Пароль
              <input
                aria-label="Пароль"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small>Не меньше 8 символов.</small>
            </label>
          )}
          <button
            className="primary-button"
            disabled={
              busy ||
              !cloudConfigured ||
              auth.loading ||
              (mode === "reset" && !auth.session)
            }
          >
            {busy
              ? "Подождите…"
              : {
                  login: "Войти",
                  register: "Зарегистрироваться",
                  forgot: "Отправить письмо",
                  reset: "Сохранить пароль",
                }[mode]}
          </button>
        </form>
        {mode === "reset" && !auth.session && !auth.loading && (
          <p>
            Откройте действующую ссылку из письма для восстановления пароля.
          </p>
        )}
        <div className="auth-links">
          <Link to={`/login?next=${encodeURIComponent(next)}`}>Войти</Link>
          <Link to={`/register?next=${encodeURIComponent(next)}`}>
            Создать аккаунт
          </Link>
          <Link to="/forgot-password">Забыли пароль?</Link>
          <Link to="/dashboard">Личный кабинет</Link>
        </div>
      </main>
    </div>
  );
}
