import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { useProject } from "../state/ProjectContext";
import { ownerClient, cloudConfigured } from "./config";
import { uploadProject, pageAction } from "./assets";
import { isCloudRef, mapProjectSources, projectSources } from "./projectAssets";
import { DraftSynchronizer } from "./synchronizer";
import { projectSnapshot } from "./snapshot";
import { cloudError, RevisionConflict } from "./errors";
import { parseProject, STORAGE_KEY } from "../model/storage";
import { emptyProject } from "../model/defaults";
import type { Project } from "../model/types";
import type { Draft, Profile, PublishedPage, SyncStatus } from "./types";
interface SyncMeta {
  revision: number;
  snapshot: string;
}
const metaKey = (id: string) => `zin.cloud-sync.${id}`;
export const accountProjectKey = (id: string) => `zin.account-project.${id}`;
function cached<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}
interface Store {
  profile: Profile | null;
  draft: Draft | null;
  publication: PublishedPage | null;
  status: SyncStatus;
  detail: string;
  localProject: Project | null;
  ready: boolean;
  busy: boolean;
  migrationVerified: boolean;
  deleteLocalCopy: () => boolean;
  reconnect: () => Promise<void>;
  save: () => Promise<void>;
  importLocal: () => Promise<boolean>;
  reloadRemote: () => Promise<void>;
  overwriteRemote: () => Promise<void>;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
  rename: (value: string) => Promise<void>;
  cleanup: () => Promise<number>;
}
const Context = createContext<Store | null>(null);
export function CloudProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth(),
    owner = session?.user.id;
  const { project, replace, saveNow } = useProject();
  const latest = useRef(project);
  latest.current = project;
  const [profile, setProfile] = useState<Profile | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [publication, setPublication] = useState<PublishedPage | null>(null);
  const [status, setStatus] = useState<SyncStatus>(owner ? "loading" : "local"),
    [detail, setDetail] = useState(""),
    [ready, setReady] = useState(!owner),
    [busy, setBusy] = useState(false);
  const [localProject, setLocalProject] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? parseProject(raw) : null;
    } catch {
      return null;
    }
  });
  const [migrationVerified, setMigrationVerified] = useState(false);
  const engine = useRef<DraftSynchronizer | null>(null),
    generation = useRef(0),
    uploads = useRef(new Map<string, string>());
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const markError = useCallback((error: unknown) => {
    const conflict =
      error instanceof RevisionConflict ||
      (error &&
        typeof error === "object" &&
        "message" in error &&
        /REVISION_CONFLICT/.test(String(error.message)));
    setStatus(conflict ? "conflict" : "error");
    setDetail(cloudError(error));
    if (conflict) setReady(false);
  }, []);
  const connect = useCallback(
    (remote: Draft | null, snapshot: string) => {
      if (!owner) return;
      engine.current?.stop();
      engine.current = new DraftSynchronizer({
        revision: remote?.revision ?? 0,
        snapshot,
        latest: () => latest.current,
        upload: (project, signal) =>
          uploadProject(project, owner, uploads.current, signal, (label) => {
            if (activeOwner.current === owner) setDetail(label);
          }),
        save: async (value, revision) => {
          const { data, error } = await ownerClient(owner).rpc("save_draft", {
            value,
            expected_revision: revision,
          });
          if (error) {
            if (/REVISION_CONFLICT/.test(error.message))
              throw new RevisionConflict();
            throw error;
          }
          return data as Draft;
        },
        acknowledged: (saved, snapshot) => {
          if (activeOwner.current !== owner) return;
          setDraft(saved);
          try {
            localStorage.setItem(
              metaKey(owner),
              JSON.stringify({ revision: saved.revision, snapshot }),
            );
          } catch {
            /* local ProjectProvider separately reports quota */
          }
        },
      });
      setDraft(remote);
      setReady(true);
      setStatus(engine.current.dirty ? "pending" : remote ? "saved" : "local");
      setDetail("");
    },
    [owner],
  );
  const load = useCallback(
    async (forceCloud = false) => {
      if (!owner || !cloudConfigured) return;
      engine.current?.stop();
      const current = ++generation.current;
      setStatus("loading");
      setReady(false);
      try {
        const client = ownerClient(owner);
        const results = await Promise.all([
          client
            .from("profiles")
            .select("id,username")
            .eq("id", owner)
            .single(),
          client.from("drafts").select("*").eq("owner_id", owner).maybeSingle(),
          client
            .from("published_pages")
            .select("*")
            .eq("owner_id", owner)
            .maybeSingle(),
        ]);
        if (current !== generation.current || activeOwner.current !== owner)
          return;
        for (const result of results) if (result.error) throw result.error;
        const remote = results[1].data
          ? ({
              ...results[1].data,
              project: parseProject(JSON.stringify(results[1].data.project)),
            } as Draft)
          : null;
        setProfile(results[0].data as Profile);
        setPublication(results[2].data as PublishedPage | null);
        setDraft(remote);
        const meta = cached<SyncMeta>(metaKey(owner));
        const cacheExists = !!localStorage.getItem(accountProjectKey(owner));
        const local = latest.current;
        const dirty =
          cacheExists &&
          (meta
            ? projectSnapshot(local) !== meta.snapshot
            : projectSnapshot(local) !== projectSnapshot(emptyProject()));
        if (
          !forceCloud &&
          dirty &&
          (!meta || meta.revision !== (remote?.revision ?? 0))
        ) {
          setStatus("conflict");
          setDetail(
            "В браузере и в облаке есть разные изменения. Экспортируйте копию и выберите версию.",
          );
          setReady(false);
          return;
        }
        if (
          !forceCloud &&
          dirty &&
          meta &&
          meta.revision === (remote?.revision ?? 0)
        ) {
          connect(remote, meta.snapshot);
          return;
        }
        const opened = remote?.project ?? emptyProject();
        latest.current = opened;
        replace(opened);
        connect(remote, projectSnapshot(opened));
        if (remote)
          try {
            localStorage.setItem(
              metaKey(owner),
              JSON.stringify({
                revision: remote.revision,
                snapshot: projectSnapshot(opened),
              }),
            );
          } catch {}
      } catch (error) {
        if (current === generation.current) markError(error);
      }
    },
    [owner, replace, connect, markError],
  );
  useEffect(() => {
    if (owner) void load();
    return () => {
      generation.current++;
      engine.current?.stop();
    };
  }, [owner, load]);
  const save = useCallback(async () => {
    if (!owner) throw new Error("Для облачного сохранения войдите в аккаунт.");
    if (!ready || !engine.current)
      throw new Error("Сначала выберите версию проекта в личном кабинете.");
    const writer = engine.current;
    saveNow();
    setStatus("saving");
    setDetail("");
    try {
      await writer.save(true);
      if (activeOwner.current === owner && engine.current === writer) {
        setStatus(writer.dirty ? "pending" : "saved");
        setDetail("");
      }
    } catch (error) {
      if (activeOwner.current === owner && engine.current === writer)
        markError(error);
      throw error;
    }
  }, [owner, ready, saveNow, markError]);
  useEffect(() => {
    if (!owner || !ready || !engine.current?.dirty) return;
    setStatus("pending");
    const timer = window.setTimeout(() => {
      void save().catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [project, owner, ready, save]);
  useEffect(() => {
    const retry = () => {
      if (owner && !ready) void load();
      else if (owner && ready && engine.current?.dirty)
        void save().catch(() => {});
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [owner, ready, save, load]);
  const importLocal = async () => {
    if (!owner || !localProject) throw new Error("Локальный проект не найден.");
    setBusy(true);
    try {
      // Read the current revision; CAS still rejects a concurrent edit during transfer.
      const { data, error } = await ownerClient(owner)
        .from("drafts")
        .select("*")
        .eq("owner_id", owner)
        .maybeSingle();
      if (error) throw error;
      if (
        data &&
        !confirm(
          "Заменить облачный черновик локальной страницей? Опубликованная версия не изменится. Локальная копия останется в браузере.",
        )
      )
        return false;
      latest.current = localProject;
      setMigrationVerified(false);
      replace(localProject);
      connect(data as Draft | null, "");
      const writer = engine.current!;
      setStatus("saving");
      await writer.save();
      const verified = await ownerClient(owner)
        .from("drafts")
        .select("revision,project")
        .eq("owner_id", owner)
        .single();
      if (verified.error) throw verified.error;
      if (
        engine.current !== writer ||
        verified.data.revision !== writer.revision
      )
        throw new RevisionConflict();
      const expected = mapProjectSources(
        localProject,
        (source) => uploads.current.get(source) ?? source,
      );
      if (
        JSON.stringify(parseProject(JSON.stringify(verified.data.project))) !==
        JSON.stringify(parseProject(JSON.stringify(expected)))
      )
        throw new Error(
          "Проверка переноса не пройдена. Исходная локальная копия сохранена.",
        );
      const paths = [
        ...new Set(
          projectSources(expected)
            .filter(isCloudRef)
            .map((ref) => ref.slice(6)),
        ),
      ];
      if (paths.length) {
        const { data: files, error } = await ownerClient(owner)
          .from("assets")
          .select("path,state")
          .in("path", paths);
        if (error) throw error;
        if (
          paths.some(
            (path) =>
              !files.some(
                (file) => file.path === path && file.state === "ready",
              ),
          )
        )
          throw new Error(
            "Не все файлы перенесены. Исходная локальная копия сохранена.",
          );
      }
      setMigrationVerified(true);
      setStatus("saved");
      setDetail("Страница и файлы перенесены. Локальная копия сохранена.");
      return true;
    } catch (error) {
      markError(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const deleteLocalCopy = () => {
    if (!migrationVerified || !localProject) return false;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      !raw ||
      JSON.stringify(parseProject(raw)) !== JSON.stringify(localProject)
    )
      throw new Error(
        "Локальная страница изменилась после переноса. Повторите перенос или скачайте копию.",
      );
    if (
      !confirm(
        "Удалить исходную локальную страницу из этого браузера? Облачная версия сохранится. Файлы, используемые текущим редактором, останутся в браузере.",
      )
    )
      return false;
    localStorage.removeItem(STORAGE_KEY);
    setLocalProject(null);
    setMigrationVerified(false);
    return true;
  };
  const overwriteRemote = async () => {
    if (!owner) return;
    const { data, error } = await ownerClient(owner)
      .from("drafts")
      .select("*")
      .eq("owner_id", owner)
      .maybeSingle();
    if (error) throw error;
    if (
      !confirm(
        "Заменить облачный черновик текущей версией из этого браузера? Это не изменит публикацию.",
      )
    )
      return;
    connect(data as Draft | null, "");
    setStatus("saving");
    try {
      await engine.current!.save();
      setStatus("saved");
      setDetail("");
    } catch (error) {
      markError(error);
      throw error;
    }
  };
  const reloadRemote = async () => {
    if (engine.current?.dirty || status === "conflict" || status === "error") {
      if (
        !confirm(
          "Открыть облачную версию вместо изменений в этом браузере? Перед этим можно экспортировать текущую страницу в JSON.",
        )
      )
        return;
      try {
        localStorage.setItem(
          `zin.recovery.${owner}`,
          JSON.stringify(latest.current),
        );
      } catch {}
    }
    await load(true);
  };
  const publish = async () => {
    if (!owner) throw new Error("Для публикации войдите в аккаунт.");
    setBusy(true);
    try {
      await save();
      const result = await pageAction<{ page: PublishedPage }>(owner, {
        action: "publish",
        revision: engine.current!.revision,
      });
      if (activeOwner.current === owner) setPublication(result.page);
    } catch (error) {
      setDetail(cloudError(error));
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const unpublish = async () => {
    if (!owner) return;
    setBusy(true);
    try {
      const { error } = await ownerClient(owner).rpc("unpublish_page");
      if (error) throw error;
      setPublication(null);
    } finally {
      setBusy(false);
    }
  };
  const rename = async (value: string) => {
    if (!owner) return;
    const { error } = await ownerClient(owner).rpc("rename_username", {
      value,
    });
    if (error) throw error;
    setProfile(profile ? { ...profile, username: value } : null);
    setPublication(publication ? { ...publication, username: value } : null);
  };
  const cleanup = async () => {
    if (!owner) return 0;
    await save();
    const result = await pageAction<{ removed: number }>(owner, {
      action: "cleanup",
    });
    return result.removed;
  };
  return (
    <Context.Provider
      value={{
        profile,
        draft,
        publication,
        status,
        detail,
        localProject,
        ready,
        busy,
        migrationVerified,
        deleteLocalCopy,
        save,
        importLocal,
        reloadRemote,
        overwriteRemote,
        publish,
        unpublish,
        rename,
        cleanup,
        reconnect: () => load(),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCloud() {
  const value = useContext(Context);
  if (!value) throw new Error("CloudProvider missing");
  return value;
}
