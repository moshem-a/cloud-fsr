import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { Close } from "../icons/index.tsx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  width?: number | string;
  closeOnOverlayClick?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 540,
  closeOnOverlayClick = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-back"
      onClick={(e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        style={{ width: typeof width === "number" ? `${width}px` : width }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="modal-head">
            <div className="modal-title">{title}</div>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              aria-label="Close"
              onClick={onClose}
            >
              <Close size={16} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
