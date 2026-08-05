import { useEffect, useRef } from 'react';

export function useDialog(open: boolean): React.RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return ref;
}
