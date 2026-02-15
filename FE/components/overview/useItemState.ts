import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, getItemState, putItemState, type OverviewTargetType } from "@/lib/api";

type CheckedById = Record<string, boolean>;

function toCheckedById(ids: string[]): CheckedById {
  const next: CheckedById = {};
  ids.forEach((id) => {
    next[id] = true;
  });
  return next;
}

function toCheckedIds(map: CheckedById): string[] {
  return Object.entries(map)
    .filter(([, checked]) => checked)
    .map(([id]) => id);
}

const EMPTY_BASELINE = {
  checkedIds: [] as string[],
  locationText: null as string | null,
  notesText: null as string | null
};

export function useItemState(params: {
  targetType: OverviewTargetType;
  targetKey: string;
}) {
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [checkedById, setCheckedById] = useState<CheckedById>({});
  const [locationText, setLocationText] = useState<string>("");
  const [notesText, setNotesText] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const lastSavedRef = useRef<{
    checkedIds: string[];
    locationText: string | null;
    notesText: string | null;
  } | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setIsLoadingState(true);

    void (async () => {
      try {
        const payload = await getItemState({
          targetType: params.targetType,
          targetKey: params.targetKey
        });
        if (cancelled) return;

        setCheckedById(toCheckedById(payload.checkedIds ?? []));
        setLocationText(payload.locationText ?? "");
        setNotesText(payload.notesText ?? "");

        lastSavedRef.current = {
          checkedIds: payload.checkedIds ?? [],
          locationText: payload.locationText ?? null,
          notesText: payload.notesText ?? null
        };
      } catch {
        if (cancelled) return;
        // Always initialise the baseline so the auto-save mechanism works
        // regardless of whether the record doesn't exist yet ("state_not_found")
        // or the request failed for any other reason.
        lastSavedRef.current = { ...EMPTY_BASELINE };
      } finally {
        if (!cancelled) setIsLoadingState(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.targetKey, params.targetType]);

  const currentPayload = useMemo(() => {
    return {
      checkedIds: toCheckedIds(checkedById),
      locationText: locationText.trim().length > 0 ? locationText.trim() : null,
      notesText: notesText.trim().length > 0 ? notesText.trim() : null
    };
  }, [checkedById, locationText, notesText]);

  // Refs so the flush helpers always see the latest values.
  const currentPayloadRef = useRef(currentPayload);
  currentPayloadRef.current = currentPayload;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Flush: fire-and-forget save if there are unsaved changes.
  const flush = useRef(() => {});
  flush.current = () => {
    const baseline = lastSavedRef.current;
    if (!baseline) return;
    const p = currentPayloadRef.current;
    const changed =
      JSON.stringify(baseline.checkedIds) !== JSON.stringify(p.checkedIds) ||
      baseline.locationText !== p.locationText ||
      baseline.notesText !== p.notesText;
    if (!changed) return;
    const t = paramsRef.current;
    void putItemState({
      targetType: t.targetType,
      targetKey: t.targetKey,
      checkedIds: p.checkedIds,
      locationText: p.locationText,
      notesText: p.notesText
    });
  };

  // Debounced autosave
  useEffect(() => {
    const baseline = lastSavedRef.current;
    if (!baseline) {
      return;
    }

    const changed =
      JSON.stringify(baseline.checkedIds) !== JSON.stringify(currentPayload.checkedIds) ||
      baseline.locationText !== currentPayload.locationText ||
      baseline.notesText !== currentPayload.notesText;

    if (!changed) {
      return;
    }

    setSaveError(null);

    const handle = setTimeout(() => {
      void (async () => {
        setIsSaving(true);
        try {
          const saved = await putItemState({
            targetType: params.targetType,
            targetKey: params.targetKey,
            checkedIds: currentPayload.checkedIds,
            locationText: currentPayload.locationText,
            notesText: currentPayload.notesText
          });

          lastSavedRef.current = {
            checkedIds: saved.checkedIds ?? [],
            locationText: saved.locationText ?? null,
            notesText: saved.notesText ?? null
          };
        } catch (error) {
          const message =
            error instanceof ApiError && error.code === "db_schema_out_of_date"
              ? "Server database schema is out of date."
              : error instanceof Error
                ? error.message
                : "failed to save";
          setSaveError(message);
        } finally {
          setIsSaving(false);
        }
      })();
    }, 700);

    return () => clearTimeout(handle);
  }, [currentPayload, params.targetKey, params.targetType]);

  // Flush unsaved changes when navigating away (client-side navigation).
  useEffect(() => {
    return () => { flush.current(); };
  }, []);

  // Flush unsaved changes when the browser tab is closed.
  useEffect(() => {
    const handler = () => flush.current();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return {
    isLoadingState,
    checkedById,
    setCheckedById,
    locationText,
    setLocationText,
    notesText,
    setNotesText,
    isSaving,
    saveError,
    resetChecked: () => setCheckedById({})
  };
}
