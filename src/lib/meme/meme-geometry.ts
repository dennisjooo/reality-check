import { memeFastFactor } from "@/lib/chart-constants";

export interface StickyMeme {
  type: "positive" | "negative";
  id: number;
  triggerTime: number;
  triggerPrice: number;
  filename: string;
}

export interface RenderedMeme {
  meme: StickyMeme;
  targetX: number;
  targetY: number;
  imgLeft: number;
  imgTop: number;
  lineStartX: number;
  lineStartY: number;
  showLine: boolean;
}

export function getMemeGeometry(
  meme: StickyMeme,
  overlayWidth: number,
  overlayHeight: number,
  getCoordinate: (time: number, price: number) => { x: number; y: number } | null,
  speed: number
): {
  targetX: number;
  targetY: number;
  imgLeft: number;
  imgTop: number;
  lineStartX: number;
  lineStartY: number;
  showLine: boolean;
} | null {
  const coords = getCoordinate(meme.triggerTime, meme.triggerPrice);
  if (!coords) return null;

  const targetX = coords.x;
  const targetY = coords.y;
  const speedFactor = memeFastFactor(speed);
  const offscreenMargin = 12;
  if (
    targetX < -offscreenMargin ||
    targetX > overlayWidth + offscreenMargin ||
    targetY < -offscreenMargin ||
    targetY > overlayHeight + offscreenMargin
  ) {
    return null;
  }
  const halfImg = 40;
  const baseOffsetX = targetX < overlayWidth * 0.33 ? 46 : -46;
  const imgOffsetX = baseOffsetX * (1 - speedFactor * 0.4);
  const baseOffsetY = meme.type === "positive" ? -45 : 40;
  const imgOffsetY = baseOffsetY * (1 - speedFactor * 0.35);
  const minConnector = Math.round(40 - speedFactor * 14);
  const maxConnector = Math.round(88 - speedFactor * 22);

  const minX = halfImg + 6;
  const maxX = Math.max(minX, overlayWidth - halfImg - 6);
  const minY = halfImg + 6;
  const maxY = Math.max(minY, overlayHeight - halfImg - 6);

  let imgCenterX = Math.max(minX, Math.min(targetX + imgOffsetX, maxX));
  let imgCenterY = Math.max(minY, Math.min(targetY + imgOffsetY, maxY));

  let dx = targetX - imgCenterX;
  let dy = targetY - imgCenterY;
  let dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < minConnector || dist > maxConnector) {
    const fallbackDx = meme.type === "positive" ? 0.7 : 0.4;
    const fallbackDy = meme.type === "positive" ? 0.7 : -0.9;
    const unitX = dist > 0 ? dx / dist : fallbackDx;
    const unitY = dist > 0 ? dy / dist : fallbackDy;
    const targetDist = Math.min(maxConnector, Math.max(minConnector, dist || minConnector));

    imgCenterX = targetX - unitX * targetDist;
    imgCenterY = targetY - unitY * targetDist;

    imgCenterX = Math.max(minX, Math.min(imgCenterX, maxX));
    imgCenterY = Math.max(minY, Math.min(imgCenterY, maxY));

    dx = targetX - imgCenterX;
    dy = targetY - imgCenterY;
    dist = Math.sqrt(dx * dx + dy * dy);
  }

  const unitX = dist > 0 ? dx / dist : 0;
  const unitY = dist > 0 ? dy / dist : 0;
  const edgePadding = 4;
  const lineStartRadius = Math.max(10, halfImg - edgePadding);
  const lineStartX = imgCenterX + unitX * lineStartRadius;
  const lineStartY = imgCenterY + unitY * lineStartRadius;
  const showLine = dist > 10;

  return {
    targetX,
    targetY,
    imgLeft: imgCenterX - halfImg,
    imgTop: imgCenterY - halfImg,
    lineStartX,
    lineStartY,
    showLine,
  };
}

export function isAnchorTooClose(
  targetTime: number,
  targetPrice: number,
  memes: StickyMeme[],
  getCoordinate: (time: number, price: number) => { x: number; y: number } | null
): boolean {
  const target = getCoordinate(targetTime, targetPrice);
  if (!target) return false;

  const minAnchorDistance = 50;
  const minAnchorDistanceSq = minAnchorDistance * minAnchorDistance;

  for (const existing of memes) {
    const existingCoords = getCoordinate(existing.triggerTime, existing.triggerPrice);
    if (!existingCoords) continue;
    const dx = existingCoords.x - target.x;
    const dy = existingCoords.y - target.y;
    if (dx * dx + dy * dy < minAnchorDistanceSq) {
      return true;
    }
  }
  return false;
}
