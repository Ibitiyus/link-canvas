import { usePageLoading } from "../components/PagePreloader";
import { isCloudRef } from "../cloud/projectAssets";
import { useEffect, useState } from "react";
import { getFile, isAssetRef } from "../model/fileStore";
import { signedAsset } from "../cloud/assets";
/** Object URLs are transient; only stable IndexedDB references are persisted. */
export function useAssetSource(value: string | null) {
  const [resolved, setResolved] = useState<{
    value: string;
    src: string;
    error: boolean;
  }>();
  useEffect(() => {
    if (!value || (!isAssetRef(value) && !isCloudRef(value))) return;
    let active = true;
    let url: string | undefined;
    (isCloudRef(value)
      ? signedAsset(value).then((src) => ({ src }))
      : getFile(value).then((file) => ({ src: URL.createObjectURL(file.blob) }))
    )
      .then(({ src }) => {
        if (!active) {
          if (src.startsWith("blob:")) URL.revokeObjectURL(src);
          return;
        }
        url = src;
        setResolved({ value, src: url, error: false });
      })
      .catch(() => {
        if (active) setResolved({ value, src: "", error: true });
      });
    return () => {
      active = false;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [value]);
  const local = !!value && (isAssetRef(value) || isCloudRef(value));
  const begin = usePageLoading();
  const loading = local && resolved?.value !== value;
  const error = local && resolved?.value === value && resolved.error;
  useEffect(() => {
    if (!begin || (!loading && !error)) return;
    const done = begin();
    if (error) done(true);
    return () => done();
  }, [begin, loading, error]);
  return {
    src: local
      ? resolved?.value === value
        ? resolved.src
        : ""
      : (value ?? ""),
    error,
    loading,
  };
}
