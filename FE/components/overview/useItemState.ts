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
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === "state_not_found") {
          lastSavedRef.current = {
            checkedIds: [],
            locationText: null,
            notesText: null
          };
          return;
        }
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

