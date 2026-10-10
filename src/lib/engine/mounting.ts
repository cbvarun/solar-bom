import type { ModuleSpec, StructureSpec } from "./types";

export interface RowLayout {
  rows: number[]; // modules per row
  railLengthsM: number[]; // per row, length of each rail
}

/** Build a row layout from modules-per-row (portrait, rails run along the row). */
export function buildRows(count: number, modulesPerRow: number, rowsHint?: number | null): number[] {
  if (rowsHint && rowsHint > 0) {
    const base = Math.floor(count / rowsHint);
    const extra = count % rowsHint;
    return Array.from({ length: rowsHint }, (_, i) => base + (i < extra ? 1 : 0)).filter((n) => n > 0);
  }
  const rows: number[] = [];
  let left = count;
  while (left > 0) {
    rows.push(Math.min(modulesPerRow, left));
    left -= modulesPerRow;
  }
  return rows;
}

export function rowRailLengthM(modulesInRow: number, mod: ModuleSpec, s: StructureSpec): number {
  const mm = modulesInRow * mod.widthMm + (modulesInRow - 1) * s.moduleGapMm + 2 * s.railOverhangMm;
  return mm / 1000;
}

export interface MountingQuantities {
  railPieces: number;
  railTotalM: number;
  splices: number;
  endClamps: number;
  midClamps: number;
  supports: number | null;
  supportBasis: string;
}

/**
 * Rails, splices and clamps follow from the module layout and the
 * manufacturer's clamping arrangement. Supports (and therefore anchors) need
 * the engineered support spacing; without it they are left undetermined.
 */
export function mountingQuantities(
  rows: number[],
  mod: ModuleSpec,
  s: StructureSpec,
  supportSpacingM: number | null,
): MountingQuantities {
  let railPieces = 0;
  let railTotalM = 0;
  let splices = 0;
  let endClamps = 0;
  let midClamps = 0;
  let supports = 0;
  for (const n of rows) {
    const len = rowRailLengthM(n, mod, s);
    const piecesPerRail = Math.ceil(len / s.railStockLengthM);
    railPieces += piecesPerRail * s.railsPerRow;
    railTotalM += len * s.railsPerRow;
    splices += (piecesPerRail - 1) * s.railsPerRow;
    endClamps += 2 * s.railsPerRow * s.endClampsPerRailEnd;
    midClamps += (n - 1) * s.railsPerRow * s.midClampsPerJointPerRail;
    if (supportSpacingM && supportSpacingM > 0) {
      supports += (Math.ceil(len / supportSpacingM) + 1) * s.railsPerRow;
    }
  }
  return {
    railPieces,
    railTotalM: Math.round(railTotalM * 100) / 100,
    splices,
    endClamps,
    midClamps,
    supports: supportSpacingM && supportSpacingM > 0 ? supports : null,
    supportBasis: supportSpacingM ? `ceil(rail length ÷ ${supportSpacingM} m) + 1 per rail` : "requires engineered support spacing",
  };
}
