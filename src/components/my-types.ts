/**
 * Custom types for DiffusionDB-Vis
 */

export interface LevelTileMap {
  [level: string]: LevelTileDataItem[];
}

export interface LevelTileDataItem {
  w: [string, number][];
  p: [number, number, number, number];
}

export interface TileDataItem {
  /**
   * Node ID
   */
  i: number;

  /**
   * Position [x0, y0, x1, y1]
   */
  p: [number, number, number, number];

  /**
   * Number of points in this tile
   */
  s: number;

  /**
   * Tile level in the quadtree
   */
  l: number;
}

export interface QuadtreeNode {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface GridData {
  grid: number[][];
  xRange: number[];
  yRange: number[];
}

export interface PromptPoint extends Point {
  id: number;
  visible: boolean;
}

export interface PromptUMAPData {
  xs: number[];
  ys: number[];
  prompts: string[];
}

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}
