<script lang="ts">
  import { getFooterStore, getSearchBarStore } from '../../stores';
  import Embedding from '../embedding/Embedding.svelte';
  import Footer from '../footer/Footer.svelte';
  import SearchPanel from '../search-panel/SearchPanel.svelte';

  let component: HTMLElement | null = null;
  // let datasetName = 'acl-abstracts';
  let datasetName = 'temp';
  let dataURL: string | null = null;
  let gridURL: string | null = null;
  let notebookMode = false;

  // Check url query to change dataset names
  if (window.location.search !== '') {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('dataset')) {
      datasetName = searchParams.get('dataset')!;
    }

    if (searchParams.has('dataURL') && searchParams.has('gridURL')) {
      dataURL = searchParams.get('dataURL') as string;
      gridURL = searchParams.get('gridURL') as string;
      console.log(dataURL, gridURL);
    }
  }

  if (import.meta.env.MODE === 'notebook') {
    notebookMode = true;
  }

  // Create stores for child components to consume
  const footerStore = getFooterStore();
  const searchBarStore = getSearchBarStore();
</script>

<style lang="scss">
  @import './MapView.scss';
</style>

<div class="mapview-page">
  <div id="popper-tooltip-top" class="popper-tooltip hidden" role="tooltip">
    <span class="popper-content"></span>
    <div class="popper-arrow"></div>
  </div>

  <div id="popper-tooltip-bottom" class="popper-tooltip hidden" role="tooltip">
    <span class="popper-content"></span>
    <div class="popper-arrow"></div>
  </div>

  <div class="app-wrapper">
    <div class="main-app" bind:this="{component}">
      <div class="main-app-container">
        <Embedding
          {datasetName}
          {dataURL}
          {gridURL}
          {footerStore}
          {searchBarStore}
          {notebookMode}
        />
      </div>
    </div>
  </div>

  <div class="footer-container">
    <Footer {footerStore} />
  </div>

  <div class="search-panel-container">
    <SearchPanel searchPanelStore="{searchBarStore}" />
  </div>
</div>
