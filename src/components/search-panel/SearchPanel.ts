import type { Writable } from 'svelte/store';
import d3 from '../../utils/d3-import';
import type { SearchBarStoreValue } from '../../stores';
import { getSearchBarStoreDefaultValue } from '../../stores';

export class SearchPanel {
  component: HTMLElement;
  SearchPanelUpdated: () => void;

  searchBarStore: Writable<SearchBarStoreValue>;
  searchBarStoreValue: SearchBarStoreValue;

  constructor(
    component: HTMLElement,
    SearchPanelUpdated: () => void,
    searchBarStore: Writable<SearchBarStoreValue>
  ) {
    this.component = component;
    this.SearchPanelUpdated = SearchPanelUpdated;
    this.searchBarStore = searchBarStore;
    this.searchBarStoreValue = getSearchBarStoreDefaultValue();
    this.initStore();
  }

  initStore = () => {
    this.searchBarStore.subscribe(value => {
      this.searchBarStoreValue = value;
      this.SearchPanelUpdated();
      console.log(this.searchBarStoreValue);
    });
  };
}
