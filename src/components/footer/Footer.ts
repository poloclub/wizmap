import type { Writable } from 'svelte/store';
import d3 from '../../utils/d3-import';
import type { FooterStoreValue } from '../../stores';

export class Footer {
  component: HTMLElement;
  footerStore: Writable<FooterStoreValue>;
  numPoints: string;
  footerUpdated: () => void;
  formatter: (x: number) => string;

  constructor(
    component: HTMLElement,
    footerStore: Writable<FooterStoreValue>,
    footerUpdated: () => void
  ) {
    this.component = component;
    this.footerStore = footerStore;
    this.numPoints = '0';
    this.formatter = d3.format(',');
    this.footerUpdated = footerUpdated;

    this.initStore();
  }

  initStore = () => {
    this.footerStore.subscribe(value => {
      this.numPoints = this.formatter(value.numPoints);
      this.footerUpdated();
    });
  };
}
