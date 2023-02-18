<script lang="ts">
  import { onMount } from 'svelte';
  import { SearchPanel } from './SearchPanel';
  import type { Writable } from 'svelte/store';
  import type { FooterStoreValue } from '../../stores';
  import iconPlus from '../../imgs/icon-plus.svg?raw';
  import iconCancel from '../../imgs/icon-cancel.svg?raw';
  import iconSearch from '../../imgs/icon-search.svg?raw';

  export let searchPanelStore: Writable<FooterStoreValue>;

  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let mySearchPanel: SearchPanel | null = null;

  const searchPanelUpdated = () => {
    mySearchPanel = mySearchPanel;
  };

  onMount(() => {
    mounted = true;
  });

  /**
   * Initialize the embedding view.
   */
  const initView = () => {
    initialized = true;

    if (component && searchPanelStore) {
      mySearchPanel = new SearchPanel(component, searchPanelUpdated);
    }
  };

  $: mounted && !initialized && component && searchPanelStore && initView();
</script>

<style lang="scss">
  @import './SearchPanel.scss';
</style>

<div class="search-panel-wrapper" bind:this="{component}">
  <div class="search-bar">
    <div class="svg-icon search-icon">
      {@html iconSearch}
    </div>
    <input
      type="text"
      id="search-bar-input"
      name="search-query"
      placeholder="Search Embeddings"
    />
    <div class="svg-icon cancel-icon">
      {@html iconCancel}
    </div>
  </div>
</div>
