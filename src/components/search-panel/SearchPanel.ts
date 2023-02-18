import type { Writable } from 'svelte/store';
import d3 from '../../utils/d3-import';
// import type { FooterStoreValue } from '../../stores';
// import { getFooterStoreDefaultValue } from '../../stores';

export class SearchPanel {
  component: HTMLElement;
  SearchPanelUpdated: () => void;

  constructor(component: HTMLElement, SearchPanelUpdated: () => void) {
    this.component = component;
    this.SearchPanelUpdated = SearchPanelUpdated;

    this.initStore();
  }

  initStore = () => {
    // Pass
  };
}
