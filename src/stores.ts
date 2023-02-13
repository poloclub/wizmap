import { writable } from 'svelte/store';

export interface FooterStoreValue {
  numPoints: number;
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
    numPoints: 0
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
