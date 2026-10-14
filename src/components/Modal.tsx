"use client";

import type { ReactNode } from "react";
import Icon from "@/components/Icon";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md animate-sheet-in flex-col rounded-t-3xl bg-white p-5 shadow-float sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-borda-forte sm:hidden" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-primaria-escura">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-fundo-rosa text-primaria transition hover:bg-primaria/15 active:scale-95"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="-mx-1 overflow-y-auto px-1 pb-1">{children}</div>
      </div>
    </div>
  );
}
