"use client";

import { createPortal } from "react-dom";
import Image from "next/image";
import type { StickyMeme } from "@/lib/meme";

interface MemeLightboxProps {
  meme: StickyMeme;
  onClose: () => void;
}

export function MemeLightbox({ meme, onClose }: MemeLightboxProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
      onClick={e => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative animate-in zoom-in fade-in duration-200 w-[70vw] h-[70vh]"
        onClick={e => e.stopPropagation()}
      >
        <Image
          src={`/img/${meme.type === "positive" ? "positive" : "negative"}/${meme.filename}`}
          alt={`${meme.type} meme zoomed`}
          fill
          className="object-contain rounded-xl shadow-2xl"
          draggable={false}
        />
        <button
          className="absolute -top-3 -right-3 z-10 bg-foreground/80 text-background rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-foreground transition-colors cursor-pointer"
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  );
}
