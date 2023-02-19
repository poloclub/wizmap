<script lang="ts">
  import { onMount } from 'svelte';
  import { SearchPanel } from './SearchPanel';
  import type { Writable } from 'svelte/store';
  import type { SearchBarStoreValue } from '../../stores';
  import d3 from '../../utils/d3-import';
  import iconPlus from '../../imgs/icon-plus.svg?raw';
  import iconCancel from '../../imgs/icon-cancel.svg?raw';
  import iconSearch from '../../imgs/icon-search.svg?raw';

  export let searchPanelStore: Writable<SearchBarStoreValue>;

  // Components
  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let mySearchPanel: SearchPanel | null = null;

  // Component states
  let inputFocused = false;
  let searchScrolled = false;
  let maxListLength = 100;
  const numberFormatter = d3.format(',');

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
      mySearchPanel = new SearchPanel(
        component,
        searchPanelUpdated,
        searchPanelStore
      );
    }
  };

  $: mounted && !initialized && component && searchPanelStore && initView();
</script>

<style lang="scss">
  @import './SearchPanel.scss';
</style>

<div class="search-panel-wrapper" bind:this="{component}">
  <div class="search-list-container">
    <div class="search-list">
      <div class="header-gap" class:hidden="{!searchScrolled}"></div>

      {#if mySearchPanel !== null}
        <div
          class="result-list"
          on:scroll="{e => {
            searchScrolled = e.target.scrollTop > 0;
          }}"
        >
          <div class="count-label">
            {numberFormatter(mySearchPanel.searchBarStoreValue.results.length)} Search
            Rsults
          </div>
          {#each mySearchPanel.searchBarStoreValue.results.slice(0, maxListLength) as result, i}
            <div class="item">{result} {i}</div>
          {/each}

          <div
            class="add-more-button"
            on:click="{() => {
              maxListLength += 100;
            }}"
          >
            Show more
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="search-bar" class:focused="{inputFocused}">
    <div class="svg-icon search-icon">
      {@html iconSearch}
    </div>
    <input
      type="text"
      id="search-bar-input"
      name="search-query"
      placeholder="Search Embeddings"
      spellcheck="false"
      on:focus="{() => {
        inputFocused = true;
      }}"
      on:blur="{() => {
        inputFocused = false;
      }}"
    />
    <div class="svg-icon cancel-icon">
      {@html iconCancel}
    </div>
  </div>
</div>
