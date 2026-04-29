import {
  type Placement,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { type ReactNode, cloneElement, isValidElement, useId, useRef } from "react";
import { createPortal } from "react-dom";

export type PopoverPlacement = Placement;

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** A single React element that becomes the trigger. We attach a ref + ARIA. */
  trigger: ReactNode;
  placement?: PopoverPlacement;
  children?: ReactNode;
  /** Pixels offset from the trigger. Default 8. */
  offsetPx?: number;
}

export function Popover({
  open,
  onClose,
  trigger,
  placement = "bottom-start",
  offsetPx = 8,
  children,
}: PopoverProps) {
  const arrowRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
    placement,
    middleware: [offset(offsetPx), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context, { outsidePress: true, escapeKey: true });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger, {
        ref: refs.setReference,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
        ...getReferenceProps(),
        // biome-ignore lint/suspicious/noExplicitAny: cloneElement loses generic types
      } as any)
    : trigger;

  return (
    <>
      {triggerEl}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={refs.setFloating}
            id={id}
            style={floatingStyles}
            className="popover"
            {...getFloatingProps()}
          >
            <div ref={arrowRef} />
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
