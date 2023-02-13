import { writable } from 'svelte/store';
import d3 from './utils/d3-import';

export interface FooterStoreValue {
  numPoints: number;
  curZoomTransform: d3.ZoomTransform;
  xScale: d3.ScaleLinear<number, number, never>;
}

export interface TooltipStoreValue {
  show: boolean;
  html: string;
  x: number;
  y: number;
  width: number;
  maxWidth: number;
  fontSize: number;
  orientation: string;
  mouseoverTimeout: number | null;
}

export const getFooterStoreDefaultValue = (): FooterStoreValue => {
  return {
    numPoints: 0,
    curZoomTransform: d3.zoomIdentity,
    xScale: d3.scaleLinear()
  };
};

export const getTooltipStoreDefaultValue = (): TooltipStoreValue => {
  return {
    show: false,
    html: 'null',
    x: 0,
    y: 0,
    width: 0,
    maxWidth: 300,
    fontSize: 14,
    orientation: 's',
    mouseoverTimeout: null
  };
};

export const getFooterStore = () => {
  return writable(getFooterStoreDefaultValue());
};

export const getTooltipStore = () => {
  return writable(getTooltipStoreDefaultValue());
};
