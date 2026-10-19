export class RevisionConflict extends Error {
  constructor() {
    super(
      "На другом устройстве уже сохранена новая версия. Выберите, какую версию открыть.",
    );
  }
}
export function cloudError(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  if (/REVISION_CONFLICT|40001/.test(message))
    return "Черновик изменён на другом устройстве. Выберите версию в личном кабинете.";
  if (/Invalid login credentials/i.test(message))
    return "Неверный email или пароль.";
  if (/Email not confirmed/i.test(message))
    return "Подтвердите email по ссылке из письма.";
  if (
    /already registered|already.*exist|duplicate key|profiles_username_key/i.test(
      message,
    )
  )
    return "Такой email или имя пользователя уже занято.";
  if (/Database error saving new user/i.test(message))
    return "Не удалось зарегистрироваться. Возможно, имя уже занято; проверьте его и повторите.";
  if (/RATE_LIMIT|rate limit|too many|429/i.test(message))
    return "Слишком много запросов. Подождите немного и повторите.";
  if (/Password.*least|weak_password/i.test(message))
    return "Пароль не соответствует требованиям. Используйте не меньше 8 символов.";
  if (/SESSION_CHANGED|JWT|session.*missing|NOT_AUTHENTICATED/i.test(message))
    return "Сессия завершена или изменена. Войдите в аккаунт заново.";
  if (/ASSET_NOT_READY/i.test(message))
    return "Один из файлов ещё не загружен или больше недоступен. Загрузите его заново.";
  if (/FILE_TOO_LARGE|exceeded.*size|413/i.test(message))
    return "Файл превышает ограничение облачного хранилища. Проверьте настройки лимита.";
  if (/PUBLICATION_BUSY/i.test(message))
    return "Публикация уже выполняется. Подождите её завершения.";
  if (/PUBLICATION_CANCELLED/i.test(message))
    return "Публикация отменена. Текущий черновик сохранён.";
  if (/INVALID_USERNAME/i.test(message))
    return "Недопустимое имя пользователя.";
  if (/fetch|network|offline|Failed to send/i.test(message))
    return "Нет связи с облаком. Изменения остаются в этом браузере; повторите сохранение после подключения.";
  // Our actionable Russian errors can be shown directly; server internals stay out of UI.
  return /[А-Яа-яЁё]/.test(message)
    ? message
    : "Не удалось выполнить запрос к облаку. Повторите попытку; если ошибка сохраняется, проверьте настройку Supabase.";
}
