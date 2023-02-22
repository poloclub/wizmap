<script lang="ts">
  import Embedding from '../embedding/Embedding.svelte';
  import Footer from '../footer/Footer.svelte';
  import SearchPanel from '../search-panel/SearchPanel.svelte';
  import { getFooterStore, getSearchBarStore } from '../../stores';
  import Packing from '../packing/Packing.svelte';
  import logoDiffusionDB from '../../imgs/logo-diffusiondb.svg?raw';
  import iconGithub from '../../imgs/icon-github.svg?raw';

  let component: HTMLElement | null = null;
  let view = 'prompt-embedding';
  let datasetName = 'diffusiondb';

  // Check for url hash (/#phrase)
  if (window.location.hash) {
    const hash = window.location.hash.slice(1);

    switch (hash) {
      case 'phrase': {
        view = 'phrase';
        break;
      }

      case 'prompt-embedding': {
        view = 'prompt-embedding';
        break;
      }

      case 'image-embedding': {
        view = 'image-embedding';
        break;
      }

      default: {
        break;
      }
    }
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
      <div
        class="main-app-container"
        class:hidden="{view !== 'prompt-embedding'}"
      >
        <Embedding
          datasetName="{datasetName}"
          footerStore="{footerStore}"
          searchBarStore="{searchBarStore}"
        />
      </div>
    </div>
  </div>

  <div class="footer-container">
    <Footer footerStore="{footerStore}" />
  </div>

  <div class="search-panel-container">
    <SearchPanel searchPanelStore="{searchBarStore}" />
  </div>
</div>
