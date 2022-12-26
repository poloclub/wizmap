import { writable } from 'svelte/store';

export interface TooltipStoreValue {
  show: boolean;
  html: string;
  left: number;
  top: number;
  width: number;
  maxWidth: number;
  fontSize: number;
  orientation: string;
  mouseoverTimeout: number | null;
}

export const getTooltipStoreDefaultValue = (): TooltipStoreValue => {
  return {
    show: false,
    html: 'null',
    left: 0,
    top: 0,
    width: 0,
    maxWidth: 300,
    fontSize: 14,
    orientation: 's',
    mouseoverTimeout: null
  };
};

export const getTooltipStore = () => {
  return writable(getTooltipStoreDefaultValue());
};
