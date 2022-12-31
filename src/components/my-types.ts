/**
 * Custom types for DiffusionDB-Vis
 */

export interface LabelData {
  tileX: number;
  tileY: number;
  tileCenterX: number;
  tileCenterY: number;
  pointX: number;
  pointY: number;
  name: string;
}

export interface DrawnLabel extends Rect {
  direction: Direction;
  /**
   * Density center point's x coordinate.
   */
  pointX: number;

  /**
   * Density center point's y coordinate.
   */
  pointY: number;

  /**
   * Topic tile's top left point's x coordinate.
   */
  tileX: number;

  /**
   * Topic tile's top left point's y coordinate.
   */
  tileY: number;

  /**
   * Whether to hide this label
   */
  toHide: boolean;

  /**
   * Label lines
   */
  lines: string[];

  /**
   * Label element's x coordinate.
   */
  labelX: number;

  /**
   * Label element's y coordinate.
   */
  labelY: number;

  /**
   * Unique identifier for this label.
   */
  labelID: number;
}

export enum Direction {
  top = 'top',
  bottom = 'bottom',
  left = 'left',
  right = 'right'
}

export interface TopicDataJSON {
  extent: [[number, number], [number, number]];
  data: TopicDataMap;
}

interface TopicDataMap {
  [level: string]: TopicData[];
}

/**
 * A topic center point (x, y, topic label)
 */
export type TopicData = [number, number, string];

/**
 * A UMAP data point (x, y, prompt)
 */
export type UMAPPointStreamData = [number, number, string];

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

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}
