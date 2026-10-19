import { Link, useNavigate } from "react-router-dom";
import { Cloud, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useCloud } from "../cloud/CloudContext";
import { useProject } from "../state/ProjectContext";
export function CloudBar() {
  const { session } = useAuth(),
    cloud = useCloud(),
    { saveNow, notify } = useProject(),
    navigate = useNavigate();
  const labels = {
    loading: "Подключение к облаку…",
    local: "Локальная копия",
    saved: "Облако: сохранено",
    saving: cloud.detail || "Сохранение в облако…",
    pending: "Облако: есть несохранённые изменения",
    error: "Облако: не сохранено",
    conflict: "Облако: выберите версию",
  };
  return (
    <div className={`cloud-bar cloud-${cloud.status}`}>
      <span role="status">
        <Cloud size={14} />
        {session
          ? labels[cloud.status]
          : "Локальный проект · сохраняется в браузере"}
      </span>
      <div>
        <button
          disabled={
            !!session &&
            (!cloud.ready || cloud.busy || cloud.status === "saving")
          }
          onClick={() => {
            if (!session) {
              if (saveNow()) navigate("/login?next=/dashboard");
              return;
            }
            void cloud
              .save()
              .catch(() =>
                notify(
                  "Облачное сохранение не выполнено. Подробности доступны в личном кабинете.",
                ),
              );
          }}
        >
          Сохранить в облако
        </button>
        <Link
          to={session ? "/dashboard" : "/login?next=/dashboard"}
          onClick={() => saveNow()}
        >
          Опубликовать
        </Link>
        <Link to="/dashboard" aria-label="Личный кабинет">
          <UserRound size={14} />
          <span>{session ? "Кабинет" : "Войти"}</span>
        </Link>
      </div>
    </div>
  );
}
