import { useEffect, useState } from "react";
import { getFile, isAssetRef } from "../model/fileStore";
/** Object URLs are transient; only stable IndexedDB references are persisted. */
export function useAssetSource(value: string | null) {
  const [resolved, setResolved] = useState<{
    value: string;
    src: string;
    error: boolean;
  }>();
  useEffect(() => {
    if (!value || !isAssetRef(value)) return;
    let active = true;
    let url: string | undefined;
    getFile(value)
      .then((file) => {
        if (!active) return;
        url = URL.createObjectURL(file.blob);
        setResolved({ value, src: url, error: false });
      })
      .catch(() => {
        if (active) setResolved({ value, src: "", error: true });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [value]);
  const local = !!value && isAssetRef(value);
  return {
    src: local
      ? resolved?.value === value
        ? resolved.src
        : ""
      : (value ?? ""),
    error: local && resolved?.value === value && resolved.error,
    loading: local && resolved?.value !== value,
  };
}
