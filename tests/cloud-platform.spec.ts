import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const url = process.env.VITE_SUPABASE_URL!,
  key = process.env.VITE_SUPABASE_ANON_KEY!;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url))
  throw new Error(
    "Only loopback Supabase is permitted in cloud browser tests.",
  );
const admin = createClient(url, process.env.ZIN_TEST_SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users: string[] = [];
const KEY = "link-canvas.project.v1";
const FONT =
  "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2";
function wave() {
  const size = 44100 * 4 * 65,
    b = Buffer.alloc(44 + size);
  b.write("RIFF");
  b.writeUInt32LE(36 + size, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(44100, 24);
  b.writeUInt32LE(176400, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(size, 40);
  return b;
}
async function register(page: Page) {
  const username = `browser${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
    email = `${username}@example.test`,
    password = "Zin-test-password-42!";
  users.push(username);
  await page.goto("/register");
  await page.getByLabel("Имя пользователя", { exact: true }).fill(username);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: `@${username}`, exact: true }),
  ).toBeVisible();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();
  if (error) throw error;
  return { username, email, password, id: data.id };
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function serverText(id: string) {
  const { data, error } = await admin
    .from("drafts")
    .select("project")
    .eq("owner_id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.project.blocks.find((b: { type: string }) => b.type === "text")
    ?.content;
}
async function reset(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/editor");
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
}
async function add(page: Page, name: string) {
  await page
    .getByRole("button", { name: `Добавить: ${name}`, exact: true })
    .click();
}
async function migrate(page: Page) {
  await expect(
    page.getByRole("button", {
      name: "Перенести локальную страницу",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Перенести локальную страницу", exact: true })
    .click();
  await expect(
    page.getByText("Перенос проверен. Исходная локальная копия сохранена.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 90000 });
}
async function editText(page: Page, text: string) {
  await page.goto("/editor");
  await page.locator(".type-text").first().click();
  if (await page.getByLabel("Название группы", { exact: true }).isVisible()) {
    await page.getByRole("button", { name: /^Слои/ }).click();
    await page
      .getByRole("button", {
        name: "Редактировать отдельно: Текст",
        exact: true,
      })
      .click();
  }
  await page.getByLabel("Текст", { exact: true }).fill(text);
}
test.afterEach(async () => {
  for (const username of users.splice(0)) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (!data) continue;
    for (const bucket of ["zin-drafts", "zin-public"]) {
      const { data: files } = await admin.storage
        .from(bucket)
        .list(data.id, { limit: 1000 });
      for (const item of files ?? []) {
        if (item.id)
          await admin.storage.from(bucket).remove([`${data.id}/${item.name}`]);
        else {
          const prefix = `${data.id}/${item.name}`,
            { data: children } = await admin.storage
              .from(bucket)
              .list(prefix, { limit: 1000 });
          if (children?.length)
            await admin.storage
              .from(bucket)
              .remove(children.map((f) => `${prefix}/${f.name}`));
        }
      }
    }
    await admin.auth.admin.deleteUser(data.id);
  }
});

test("migrates all eight block types and fonts, publishes to an anonymous device, and keeps drafts separate", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await reset(page);
  await add(page, "Текст");
  await page
    .getByLabel("Текст", { exact: true })
    .fill("Локальная страница ZIN");
  await page.getByLabel("Файл шрифта", { exact: true }).setInputFiles(FONT);
  await expect(page.getByLabel("Шрифт блока", { exact: true })).toHaveValue(
    /^font:/,
  );
  for (const kind of [
    "Ссылка",
    "Изображение",
    "GIF",
    "Видео",
    "Музыка",
    "QR-код",
    "Декор",
  ]) {
    await add(page, kind);
    if (kind === "Изображение" || kind === "GIF")
      await page
        .getByLabel(
          `Файл: ${kind === "GIF" ? "Ссылка на GIF" : "Ссылка на изображение"}`,
          { exact: true },
        )
        .setInputFiles("tests/fixtures/animated.gif");
    if (kind === "Видео")
      await page
        .getByLabel("Файл видео", { exact: true })
        .setInputFiles("tests/fixtures/clip.webm");
    if (kind === "Музыка")
      await page.getByLabel("Файл музыки", { exact: true }).setInputFiles({
        name: "test.wav",
        mimeType: "audio/wav",
        buffer: wave(),
      });
    if (["Изображение", "GIF", "Видео", "Музыка"].includes(kind))
      await expect(
        page
          .getByPlaceholder("Используется загруженный файл", { exact: true })
          .first(),
      ).toBeVisible();
    if (kind === "Декор") {
      await page.getByLabel("X", { exact: true }).fill("-80");
      await page.getByLabel("Y", { exact: true }).fill("-40");
    }
    await expect(
      page.getByRole("button", { name: "Сохранено", exact: true }),
    ).toBeVisible();
  }
  // New editor metadata must survive guest migration, cloud saving and publication.
  await page.getByLabel("Закрепить положение", { exact: true }).check();
  await page
    .getByRole("button", { name: "На задний план", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Слои/ }).click();
  await page.keyboard.press("Escape");
  await page
    .locator(".layer-select")
    .filter({ hasText: "Текст" })
    .first()
    .click();
  await page.getByText("Анимация и эффекты", { exact: true }).click();
  await page.getByLabel("Тип анимации", { exact: true }).selectOption("float");
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  const guest = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page
    .getByRole("button", { name: "Сохранить в облако", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
  const user = await register(page);
  await migrate(page);
  const cloudDraft = await admin
    .from("drafts")
    .select("project")
    .eq("owner_id", user.id)
    .single();
  expect(cloudDraft.error).toBeNull();
  expect(cloudDraft.data!.project.groups).toHaveLength(0);
  expect(
    cloudDraft.data!.project.blocks.find(
      (b: { type: string }) => b.type === "text",
    ).effects.animation.type,
  ).toBe("float");
  expect(
    cloudDraft.data!.project.blocks.find(
      (b: { type: string }) => b.type === "decoration",
    ),
  ).toMatchObject({ locked: true, layer: 0 });
  expect(
    JSON.parse((await page.evaluate((key) => localStorage.getItem(key), KEY))!),
  ).toEqual(JSON.parse(guest!));
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(
    page.getByText("Страница опубликована.", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const address = await page.locator(".public-address").getAttribute("href");
  expect(address).toBe(`/u/${user.username}`);
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  try {
    await visitor.goto(address!);
    await expect(visitor.locator("[data-block-id]")).toHaveCount(8);
    await expect(
      visitor.locator(
        ".canvas-block:has(.type-text) > .effect-root > .effect-animation",
      ),
    ).toHaveCSS("animation-name", "zin-float");
    await expect(
      visitor.locator(".free-block:has(.type-decoration)"),
    ).toHaveCSS("z-index", "1");
    await expect(
      visitor.locator(
        ".grid-cell,.drag-handle,.resize-handle,.editor-toolbar,.cloud-bar",
      ),
    ).toHaveCount(0);
    expect(
      await visitor.evaluate((key) => localStorage.getItem(key), KEY),
    ).toBeNull();
    await expect(visitor.locator(".text-content")).toHaveText(
      "Локальная страница ZIN",
    );
    await expect
      .poll(() =>
        visitor
          .locator(".block-content img")
          .evaluateAll((nodes) =>
            nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        visitor.evaluate(() =>
          [...document.fonts].some(
            (f) => f.family.startsWith("LCFont-") && f.status === "loaded",
          ),
        ),
      )
      .toBe(true);
    await visitor
      .getByRole("button", { name: "Воспроизвести музыку", exact: true })
      .click();
    await expect
      .poll(() =>
        visitor
          .locator("audio")
          .evaluate((a: HTMLAudioElement) => a.currentTime),
      )
      .toBeGreaterThan(0);
    await visitor.locator("video").evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play();
    });
    await expect
      .poll(() =>
        visitor
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.currentTime),
      )
      .toBeGreaterThan(0);
    await expect(visitor.locator("svg.qr-code")).toBeVisible();
    await expect(visitor.locator(".type-qrcode a")).toHaveAttribute(
      "href",
      "https://example.com/",
    );
    await editText(page, "Новый приватный черновик");
    await expect
      .poll(() => serverText(user.id))
      .toBe("Новый приватный черновик");
    await visitor.reload();
    await expect(visitor.locator(".text-content")).toHaveText(
      "Локальная страница ZIN",
    );
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    try {
      await login(other, user.email, user.password);
      await other
        .getByRole("link", { name: "Редактировать", exact: true })
        .click();
      await expect(other.locator(".text-content")).toHaveText(
        "Новый приватный черновик",
      );
      await expect
        .poll(() =>
          other
            .locator(".block-content img")
            .evaluateAll((nodes) =>
              nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
            ),
        )
        .toBe(true);
      const downloading = other.waitForEvent("download");
      await other
        .getByRole("button", { name: "Экспорт JSON", exact: true })
        .click();
      const stream = await (await downloading).createReadStream(),
        chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(chunk);
      const backup = JSON.parse(Buffer.concat(chunks).toString());
      expect(Object.keys(backup.assets).length).toBeGreaterThanOrEqual(5);
    } finally {
      await otherContext.close();
    }
    await page
      .getByRole("link", { name: "Личный кабинет", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Обновить публикацию", exact: true })
      .click();
    await expect(
      page.getByText("Страница опубликована.", { exact: true }),
    ).toBeVisible();
    await visitor.reload();
    await expect(visitor.locator(".text-content")).toHaveText(
      "Новый приватный черновик",
    );
    const renamed = `${user.username}x`;
    users.push(renamed);
    await page
      .getByLabel("Новое имя пользователя", { exact: true })
      .fill(renamed);
    await page
      .getByRole("button", { name: "Изменить имя", exact: true })
      .click();
    await expect(page.locator(".public-address")).toHaveAttribute(
      "href",
      `/u/${renamed}`,
    );
    await visitor.goto(address!);
    await expect(
      visitor.getByRole("heading", { name: "ВЫ ВЫШЛИ ЗА РАМКИ.", exact: true }),
    ).toBeVisible();
    await visitor.goto(`/u/${renamed}`);
    await expect(visitor.locator("[data-block-id]")).toHaveCount(8);
    await expect(
      visitor.locator(".free-block:has(.type-decoration)"),
    ).toHaveCSS("z-index", "1");
    await page
      .getByRole("button", { name: "Снять с публикации", exact: true })
      .click();
    await expect(
      page.getByText("Страница снята с публикации.", { exact: true }),
    ).toBeVisible();
    await visitor.reload();
    await expect(
      visitor.getByRole("heading", { name: "ВЫ ВЫШЛИ ЗА РАМКИ.", exact: true }),
    ).toBeVisible();
  } finally {
    await visitorContext.close();
  }
});

test("conflicts require a choice, offline changes recover, and accounts stay isolated", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await reset(page);
  await add(page, "Текст");
  await page.getByLabel("Текст", { exact: true }).fill("Начало");
  const user = await register(page);
  await migrate(page);
  const revisionBeforeCancel = (
    await admin
      .from("drafts")
      .select("revision")
      .eq("owner_id", user.id)
      .single()
  ).data!.revision;
  page.removeAllListeners("dialog");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Перенести локальную страницу", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Перенести локальную страницу",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page.getByText("Перенос проверен. Исходная локальная копия сохранена.", {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    (
      await admin
        .from("drafts")
        .select("revision")
        .eq("owner_id", user.id)
        .single()
    ).data!.revision,
  ).toBe(revisionBeforeCancel);
  page.on("dialog", (dialog) => dialog.accept());
  const secondContext = await browser.newContext(),
    second = await secondContext.newPage();
  second.on("dialog", (dialog) => dialog.accept());
  try {
    await login(second, user.email, user.password);
    await second
      .getByRole("link", { name: "Редактировать", exact: true })
      .click();
    await expect(second.locator(".text-content")).toHaveText("Начало");
    await editText(page, "Изменено на первом устройстве");
    await expect
      .poll(() => serverText(user.id))
      .toBe("Изменено на первом устройстве");
    await second.locator(".type-text").click();
    await second
      .getByLabel("Текст", { exact: true })
      .fill("Изменено на втором устройстве");
    await expect(second.locator(".cloud-bar")).toContainText(
      "выберите версию",
      { timeout: 15000 },
    );
    expect(await serverText(user.id)).toBe("Изменено на первом устройстве");
    await second
      .getByRole("link", { name: "Личный кабинет", exact: true })
      .click();
    await second
      .getByRole("button", { name: "Заменить облачный черновик", exact: true })
      .click();
    await expect
      .poll(() => serverText(user.id))
      .toBe("Изменено на втором устройстве");
    await editText(second, "Перед отключением");
    await expect.poll(() => serverText(user.id)).toBe("Перед отключением");
    await secondContext.setOffline(true);
    await expect(second.locator(".cloud-bar")).toContainText("Нет сети");
    await secondContext.setOffline(false);
    await expect(second.locator(".cloud-bar")).toContainText(
      "Облако: сохранено",
    );
    await secondContext.setOffline(true);
    await second
      .getByLabel("Текст", { exact: true })
      .fill("Работа без интернета");
    await expect(second.locator(".cloud-bar")).toContainText(
      /Нет сети|не сохранено/,
      {
        timeout: 15000,
      },
    );
    await expect
      .poll(() =>
        second.evaluate(
          (id) =>
            JSON.parse(localStorage.getItem(`zin.account-project.${id}`)!)
              .blocks[0].content,
          user.id,
        ),
      )
      .toBe("Работа без интернета");
    expect(await serverText(user.id)).toBe("Перед отключением");
    await secondContext.setOffline(false);
    await expect.poll(() => serverText(user.id)).toBe("Работа без интернета");
    await expect(second.locator(".cloud-bar")).toContainText(
      "Облако: сохранено",
    );
    await second
      .getByRole("link", { name: "Личный кабинет", exact: true })
      .click();
    await second.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(second).toHaveURL(/\/login/);
    const another = await register(second);
    expect(another.id).not.toBe(user.id);
    await second
      .getByRole("link", { name: "Редактировать", exact: true })
      .click();
    await expect(second.locator("[data-block-id]")).toHaveCount(0);
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("drafts")
          .select("owner_id")
          .eq("owner_id", another.id);
        return data?.length;
      })
      .toBe(0);
  } finally {
    await secondContext.close();
  }
});

test("email password recovery opens the reset form and accepts the new password", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const user = await register(page);
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page
    .getByRole("button", { name: "Отправить письмо", exact: true })
    .click();
  await expect(
    page.getByText(
      "Если этот email зарегистрирован и почтовый провайдер настроен, будет отправлена ссылка для смены пароля. Проверьте входящие и спам.",
      { exact: true },
    ),
  ).toBeVisible();
  let messageId = "";
  await expect
    .poll(async () => {
      const result = await request.get(
        `${process.env.ZIN_TEST_MAILPIT_URL}/api/v1/messages`,
      );
      const body = await result.json();
      const message = body.messages?.find(
        (item: { To: { Address: string }[] }) =>
          item.To.some((to) => to.Address === user.email),
      );
      messageId = message?.ID ?? "";
      return messageId;
    })
    .not.toBe("");
  const result = await request.get(
      `${process.env.ZIN_TEST_MAILPIT_URL}/api/v1/message/${messageId}`,
    ),
    body = await result.json();
  const link = (body.Text as string).match(
    /https?:\/\/[^\s<>]+\/auth\/v1\/verify\?[^\s<>]+/,
  )?.[0];
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect(page).toHaveURL(/\/reset-password/);
  await expect(
    page.getByRole("button", { name: "Сохранить пароль", exact: true }),
  ).toBeEnabled();
  const next = "New-Zin-password-42!";
  await page.getByLabel("Пароль", { exact: true }).fill(next);
  await page
    .getByRole("button", { name: "Сохранить пароль", exact: true })
    .click();
  await expect(
    page.getByText("Пароль изменён. Теперь можно открыть личный кабинет.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Личный кабинет", exact: true }).click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await login(page, user.email, next);
  await expect(
    page.getByRole("heading", { name: `@${user.username}`, exact: true }),
  ).toBeVisible();
});

test("a starter with owned media becomes a real cloud draft and published page", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await page.goto("/templates");
  await page
    .locator('[data-template-id="music-artist"]')
    .getByRole("button", { name: "Использовать", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Заменить страницу", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  const guest = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(
    guest.blocks.some(
      (b: { type: string; url: string }) =>
        b.type === "audio" && b.url.startsWith("asset:"),
    ),
  ).toBe(true);
  const user = await register(page);
  await migrate(page);
  const draft = await admin
    .from("drafts")
    .select("project")
    .eq("owner_id", user.id)
    .single();
  expect(draft.error).toBeNull();
  expect(draft.data!.project.page.title).toBe("NO SIGNAL / NEW SOUND");
  expect(
    draft.data!.project.blocks.find((b: { type: string }) => b.type === "audio")
      .url,
  ).toMatch(/^cloud:/);
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(
    page.getByText("Страница опубликована.", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const context = await browser.newContext(),
    visitor = await context.newPage();
  try {
    await visitor.goto(`/u/${user.username}`);
    await expect(visitor.locator("[data-block-id]")).toHaveCount(
      guest.blocks.length,
    );
    await expect(visitor.locator(".anim-float")).toHaveCount(1);
    await expect(visitor.locator("img").first()).toBeVisible();
    await visitor
      .getByRole("button", { name: "Воспроизвести музыку", exact: true })
      .click();
    await expect
      .poll(() =>
        visitor
          .locator("audio")
          .evaluate((e: HTMLAudioElement) => e.currentTime),
      )
      .toBeGreaterThan(0);
    await visitor.locator("video").evaluate((e: HTMLVideoElement) => e.play());
    await expect
      .poll(() =>
        visitor
          .locator("video")
          .evaluate((e: HTMLVideoElement) => e.currentTime),
      )
      .toBeGreaterThan(0);
    const pub = await admin
      .from("published_pages")
      .select("project")
      .eq("username", user.username)
      .single();
    expect(pub.error).toBeNull();
    const sources = pub
      .data!.project.blocks.flatMap((b: { url: string; imageUrl: string }) => [
        b.url,
        b.imageUrl,
      ])
      .filter((s: string) => s.includes("/storage/"));
    expect(sources.length).toBeGreaterThan(2);
    for (const src of sources) expect((await fetch(src)).ok).toBe(true);
    // Cancelling a replacement after sign-in must preserve both the active and server draft.
    await page.goto("/templates");
    await page
      .locator('[data-template-id="blank-canvas"]')
      .getByRole("button", { name: "Использовать", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("облачный черновик");
    await page.getByRole("button", { name: "Отмена", exact: true }).click();
    const unchanged = await admin
      .from("drafts")
      .select("project")
      .eq("owner_id", user.id)
      .single();
    expect(unchanged.data!.project.page.title).toBe("NO SIGNAL / NEW SOUND");
  } finally {
    await context.close();
  }
});

test("an edit during delayed initial cloud load survives and requires a version choice", async ({
  page,
}) => {
  test.setTimeout(60000);
  const user = await register(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route("**/rest/v1/drafts*", async (route) => {
    if (route.request().method() === "GET") {
      started = true;
      await gate;
    }
    await route.continue();
  });
  await page.goto("/editor");
  await expect.poll(() => started).toBe(true);
  await add(page, "Текст");
  await page
    .getByLabel("Текст", { exact: true })
    .fill("Изменено во время подключения");
  const previous = await page.evaluate((id) => {
    const key = `zin.account-project.${id}`,
      raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    return raw;
  }, user.id);
  release();
  await expect(page.locator(".cloud-bar")).toContainText("выберите версию");
  await expect(page.locator(".text-content")).toHaveText(
    "Изменено во время подключения",
  );
  if (previous)
    await page.evaluate(
      ({ id, raw }) => localStorage.setItem(`zin.account-project.${id}`, raw),
      { id: user.id, raw: previous },
    );
  await page.getByRole("link", { name: "Личный кабинет", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Заменить облачный черновик", exact: true })
    .click();
  await expect
    .poll(() => serverText(user.id))
    .toBe("Изменено во время подключения");
});

test("a failed Supabase save keeps local work and succeeds after retry", async ({
  page,
}) => {
  const user = await register(page);
  await page.goto("/editor");
  await expect(page.locator(".cloud-bar")).not.toContainText("Подключение");
  await page.route("**/rest/v1/rpc/save_draft", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "internal database detail must stay hidden" },
    }),
  );
  await add(page, "Текст");
  await page
    .getByLabel("Текст", { exact: true })
    .fill("Сохраняем несмотря на сбой");
  await expect(page.locator(".cloud-bar")).toContainText("не сохранено", {
    timeout: 15000,
  });
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem(`zin.account-project.${id}`)!).blocks[0]
          .content,
      user.id,
    ),
  ).toBe("Сохраняем несмотря на сбой");
  await expect(page.locator("body")).not.toContainText(
    "internal database detail",
  );
  await page.unroute("**/rest/v1/rpc/save_draft");
  await page
    .getByRole("button", { name: "Сохранить в облако", exact: true })
    .click();
  await expect
    .poll(() => serverText(user.id))
    .toBe("Сохраняем несмотря на сбой");
  await expect(page.locator(".cloud-bar")).toContainText("Облако: сохранено");
});

test("Explore real cloud: voluntary listing, cover, metadata snapshot, rename, hide and unpublish", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const user = await register(page);
  const panel = page.getByRole("region", { name: "Публикация в галерее" });
  await expect(
    panel.getByRole("checkbox", { name: "Показывать мой ZIN в галерее" }),
  ).not.toBeChecked();
  await panel
    .getByLabel("Название ZIN", { exact: true })
    .fill("Творческий мир в галерее");
  await panel
    .getByLabel("Краткое описание")
    .fill("Фото, музыка и свободные коллажи");
  await panel
    .getByLabel("Категория", { exact: true })
    .selectOption("Photography");
  await panel
    .getByLabel("Обложка для галереи")
    .setInputFiles("tests/fixtures/explore-cover.jpg");
  await expect(panel.getByAltText("Выбранная обложка")).toBeVisible();
  await panel
    .getByRole("button", { name: "Сохранить до публикации", exact: true })
    .click();
  await expect(panel.getByRole("status")).toContainText("Настройки сохранены");
  await panel.getByRole("checkbox").check();
  await expect(panel.getByRole("status")).toContainText("Участие включено");
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  try {
    await publicPage.goto(`/explore?q=${user.username}`);
    await expect(
      publicPage.getByRole("heading", { name: "Ничего не найдено" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Опубликовать", exact: true })
      .click();
    await expect(page.locator(".publication-badge")).toHaveText("Опубликована");
    await publicPage.reload();
    const card = publicPage.locator(`[data-username="${user.username}"]`);
    await expect(card).toContainText("Творческий мир в галерее");
    await expect(card.locator("img")).toHaveAttribute(
      "src",
      /^data:image\/jpeg;base64,/,
    );
    await publicPage
      .getByRole("button", { name: `Сообщить о странице @${user.username}` })
      .click();
    await publicPage
      .getByRole("dialog")
      .getByRole("link", { name: "Войти", exact: true })
      .click();
    await publicPage.getByLabel("Email", { exact: true }).fill(user.email);
    await publicPage.getByLabel("Пароль", { exact: true }).fill(user.password);
    await publicPage
      .getByRole("button", { name: "Войти", exact: true })
      .click();
    await expect(publicPage).toHaveURL(/\/explore$/);
    await publicPage
      .getByRole("button", { name: `Сообщить о странице @${user.username}` })
      .click();
    await publicPage
      .getByRole("dialog")
      .getByRole("textbox")
      .fill("Проверка закрытого механизма жалоб");
    await publicPage
      .getByRole("button", { name: "Отправить жалобу", exact: true })
      .click();
    await expect(publicPage.getByRole("dialog")).toContainText(
      "Жалоба принята",
    );
    await publicPage
      .getByRole("button", { name: "Закрыть", exact: true })
      .click();
    const report = await admin
      .from("explore_reports")
      .select("details")
      .eq("subject_id", user.id)
      .single();
    expect(report.data?.details).toBe("Проверка закрытого механизма жалоб");
    // Return to a narrow owner dashboard; keyboard form fields must remain reachable.
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await panel.getByLabel("Краткое описание").focus();
      await expect(panel.getByLabel("Краткое описание")).toBeFocused();
    }
    await panel
      .getByLabel("Название ZIN", { exact: true })
      .fill("Неопубликованное новое название");
    await panel
      .getByRole("button", { name: "Сохранить до публикации", exact: true })
      .click();
    await expect(panel.getByRole("status")).toContainText(
      "Настройки сохранены",
    );
    await publicPage.reload();
    await expect(card).toContainText("Творческий мир в галерее");
    await expect(card).not.toContainText("Неопубликованное");
    await panel
      .getByRole("button", { name: "Опубликовать представление", exact: true })
      .click();
    await expect(panel.getByRole("status")).toContainText(
      "Представление опубликовано",
    );
    await publicPage.reload();
    await expect(card).toContainText("Неопубликованное новое название");
    await panel.getByRole("checkbox").uncheck();
    await expect(panel.getByRole("status")).toContainText("Участие выключено");
    await publicPage.reload();
    await expect(publicPage.locator(".explore-card")).toHaveCount(0);
    await publicPage.goto(`/u/${user.username}`);
    await expect(publicPage.locator(".public-page")).toBeVisible();
    await panel.getByRole("checkbox").check();
    await expect(panel.getByRole("status")).toContainText("Участие включено");
    await admin.rpc("moderate_explore", {
      page_username: user.username,
      hide: true,
      moderation_reason: "Browser test",
    });
    await publicPage.goto(`/explore?q=${user.username}`);
    await expect(publicPage.locator(".explore-card")).toHaveCount(0);
    await panel.getByRole("checkbox").uncheck();
    await expect(panel.getByRole("status")).toContainText("Участие выключено");
    await panel.getByRole("checkbox").check();
    await expect(panel.getByRole("status")).toContainText("Участие включено");
    await publicPage.reload();
    await expect(publicPage.locator(".explore-card")).toHaveCount(0);
    await admin.rpc("moderate_explore", {
      page_username: user.username,
      hide: false,
    });
    await page.route("**/rest/v1/rpc/set_explore_visibility", (route) =>
      route.fulfill({
        status: 503,
        json: { message: "private server detail" },
      }),
    );
    await panel.getByRole("checkbox").uncheck();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("checkbox")).toBeChecked();
    await expect(panel).not.toContainText("private server detail");
    await page.unroute("**/rest/v1/rpc/set_explore_visibility");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Снять с публикации", exact: true })
      .click();
    await expect(page.locator(".publication-badge")).toHaveText(
      "Не опубликована",
    );
    await publicPage.reload();
    await expect(publicPage.locator(".explore-card")).toHaveCount(0);
    await page.reload();
    await expect(panel.getByRole("checkbox")).toBeChecked();
    await expect(panel.getByLabel("Название ZIN", { exact: true })).toHaveValue(
      "Неопубликованное новое название",
    );
  } finally {
    await visitor.close();
  }
});
