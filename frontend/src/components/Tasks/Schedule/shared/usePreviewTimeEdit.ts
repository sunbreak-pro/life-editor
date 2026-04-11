import { useState, useRef, useEffect, useCallback } from "react";
import {
  formatTime,
  adjustEndTimeForStartChange,
  clampEndTimeAfterStart,
} from "../../../../utils/timeGridUtils";

interface UsePreviewTimeEditOptions {
  startTime: string;
  endTime: string;
  title: string;
  onTimeChange?: (startTime: string, endTime: string) => void;
  onTitleChange?: (title: string) => void;
}

export function usePreviewTimeEdit({
  startTime,
  endTime,
  title,
  onTimeChange,
  onTitleChange,
}: UsePreviewTimeEditOptions) {
  const [editStartTime, setEditStartTime] = useState(startTime);
  const [editEndTime, setEditEndTime] = useState(endTime);
  const prevStartRef = useRef(editStartTime);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  useEffect(() => {
    setEditStartTime(startTime);
    setEditEndTime(endTime);
    prevStartRef.current = startTime;
  }, [startTime, endTime]);

  const handleStartTimeChange = useCallback(
    (h: number, m: number) => {
      const newStart = formatTime(h, m);
      const adjusted = adjustEndTimeForStartChange(
        prevStartRef.current,
        newStart,
        editEndTime,
      );
      prevStartRef.current = newStart;
      setEditStartTime(newStart);
      setEditEndTime(adjusted);
      onTimeChange?.(newStart, adjusted);
    },
    [editEndTime, onTimeChange],
  );

  const handleEndTimeChange = useCallback(
    (h: number, m: number) => {
      const newEnd = formatTime(h, m);
      const clamped = clampEndTimeAfterStart(editStartTime, newEnd);
      setEditEndTime(clamped);
      onTimeChange?.(editStartTime, clamped);
    },
    [editStartTime, onTimeChange],
  );

  const commitTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange?.(trimmed);
    }
    setIsEditingTitle(false);
  }, [titleDraft, title, onTitleChange]);

  const startEditingTitle = useCallback(() => {
    setTitleDraft(title);
    setIsEditingTitle(true);
  }, [title]);

  const cancelEditingTitle = useCallback(() => {
    setTitleDraft(title);
    setIsEditingTitle(false);
  }, [title]);

  return {
    editStartTime,
    editEndTime,
    handleStartTimeChange,
    handleEndTimeChange,
    isEditingTitle,
    titleDraft,
    setTitleDraft,
    commitTitle,
    startEditingTitle,
    cancelEditingTitle,
  };
}
