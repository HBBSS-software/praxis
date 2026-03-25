import { useRef, type MouseEvent, type PointerEvent } from 'react';

function updateSelectionRange(
  orderedIds: number[],
  selectedIds: number[],
  targetId: number,
  checked: boolean,
  lastSelectedId: number | null,
  useRange: boolean
) {
  const nextSelected = new Set(selectedIds);

  if (useRange && lastSelectedId !== null) {
    const currentIndex = orderedIds.indexOf(targetId);
    const lastIndex = orderedIds.indexOf(lastSelectedId);

    if (currentIndex !== -1 && lastIndex !== -1) {
      const [start, end] = currentIndex < lastIndex ? [currentIndex, lastIndex] : [lastIndex, currentIndex];

      for (const id of orderedIds.slice(start, end + 1)) {
        if (checked) {
          nextSelected.add(id);
        } else {
          nextSelected.delete(id);
        }
      }

      return orderedIds.filter((id) => nextSelected.has(id));
    }
  }

  if (checked) {
    nextSelected.add(targetId);
  } else {
    nextSelected.delete(targetId);
  }

  return orderedIds.filter((id) => nextSelected.has(id));
}

export function useShiftMultiSelect() {
  const shiftPressedRef = useRef(false);
  const lastSelectedIdRef = useRef<number | null>(null);

  return {
    captureShiftKey: (event: MouseEvent | PointerEvent) => {
      shiftPressedRef.current = event.shiftKey;
    },
    updateSelection: (
      orderedIds: number[],
      selectedIds: number[],
      targetId: number,
      checked: boolean
    ) => {
      const nextSelected = updateSelectionRange(
        orderedIds,
        selectedIds,
        targetId,
        checked,
        lastSelectedIdRef.current,
        shiftPressedRef.current
      );

      lastSelectedIdRef.current = targetId;
      shiftPressedRef.current = false;

      return nextSelected;
    },
    resetSelectionAnchor: () => {
      lastSelectedIdRef.current = null;
      shiftPressedRef.current = false;
    }
  };
}
