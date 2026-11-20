"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { IoArrowForward, IoClose } from "react-icons/io5";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { TiltCard } from "@/components/CardSurface";

const strings = defineStrings({
  fr: { close: "Fermer", open: "Voir la sortie" },
  en: { close: "Close", open: "See the outing" },
});

/**
 * One card held up on its own, over the scrim: to look at, to tilt under
 * the pointer, and for a run's card the way to its outing. A click outside
 * or Escape closes it; a click on the card does not.
 */
export function CardViewer({ open, onClose, href, label, children }: {
  open: boolean;
  onClose: () => void;
  /** The outing the card was dealt from, for a run's card. */
  href?: string;
  label: string;
  children: ReactNode;
}) {
  const s = useStrings(strings);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="card-viewer"
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className="card-viewer-body">
          <TiltCard>{children}</TiltCard>
          <div className="card-viewer-actions">
            {href ? (
              <Link href={href} className="header-button primary press">
                {s.open}
                <IoArrowForward size={17} aria-hidden />
              </Link>
            ) : null}
            <button type="button" className="header-button press" onClick={onClose}>
              <IoClose size={18} aria-hidden />
              {s.close}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
