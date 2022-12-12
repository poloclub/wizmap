/**
 * Custom types for DiffusionDB-Vis
 */

export interface PromptPoint extends Point {
  promptID: number;
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
