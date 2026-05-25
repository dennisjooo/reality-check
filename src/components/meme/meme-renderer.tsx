"use client";

import type { PriceSnapshot } from "@/lib/chart-types";
import type { StickyMeme, RenderedMeme } from "@/lib/meme";
import { getMemeGeometry as calcMemeGeometry } from "@/lib/meme";
import Image from "next/image";

interface MemeRendererProps {
  memes: StickyMeme[];
  loadedMemeIds: Set<number>;
  priceSnapshot: PriceSnapshot | null;
  overlaySize: { width: number; height: number };
  speed: number;
  onMemeClick: (meme: StickyMeme) => void;
  onImageLoad: (memeId: number) => void;
}

export function MemeRenderer({
  memes,
  loadedMemeIds,
  priceSnapshot,
  overlaySize,
  speed,
  onMemeClick,
  onImageLoad,
}: MemeRendererProps) {
  const hasContent = memes.length > 0 && priceSnapshot?.getCoordinate;
  const renderedMemes: RenderedMeme[] =
    hasContent && overlaySize.width > 0
      ? memes
          .map(meme => {
            const geometry = calcMemeGeometry(
              meme,
              overlaySize.width,
              overlaySize.height,
              priceSnapshot.getCoordinate!,
              speed
            );
            if (!geometry) return null;
            return { meme, ...geometry };
          })
          .filter((item): item is RenderedMeme => item !== null)
      : [];

  return (
    <>
      <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
        {renderedMemes.map(
          ({
            meme,
            showLine,
            lineStartX,
            lineStartY,
            targetX,
            targetY,
          }) => {
            if (!showLine) return null;

            return (
              <line
                key={`line-${meme.id}`}
                x1={lineStartX}
                y1={lineStartY}
                x2={targetX}
                y2={targetY}
                stroke={
                  meme.type === "positive" ? "#34d399" : "#f87171"
                }
                strokeWidth="2"
                strokeDasharray="6,4"
                className="opacity-60"
              />
            );
          }
        )}
      </svg>

      {renderedMemes.map(({ meme, imgLeft, imgTop }) => {
        const isLoaded = loadedMemeIds.has(meme.id);
        return (
          <div
            key={meme.id}
            className={`absolute pointer-events-auto cursor-pointer drop-shadow-lg z-20 transition-[opacity,transform] duration-300 hover:scale-110 hover:z-30 ${
              isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-75"
            }`}
            style={{
              left: imgLeft,
              top: imgTop,
              width: 80,
              height: 80,
            }}
            onClick={e => {
              e.stopPropagation();
              onMemeClick(meme);
            }}
            title="Click to zoom"
          >
            <Image
              src={`/img/${meme.type === "positive" ? "positive" : "negative"}/${meme.filename}`}
              alt={`${meme.type} meme`}
              width={80}
              height={80}
              className="h-20 w-20 object-contain rounded-md"
              draggable={false}
              onLoad={() => onImageLoad(meme.id)}
            />
          </div>
        );
      })}
    </>
  );
}
