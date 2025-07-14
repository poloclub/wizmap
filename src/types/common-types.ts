/**
 * Common types.
 */

/**
 * Custom event for notebook message events
 */
export interface NotebookEvent extends Event {
  dataURL: string;
  gridURL: string;
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

export interface DragRegion {
  minLeft: number;
  maxLeft: number;
  minTop: number;
  maxTop: number;
}

/**
 * Position of an object
 */
export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}
