<script lang="ts">
  import Embedding from '../embedding/Embedding.svelte';
  import Packing from '../packing/Packing.svelte';
  import Tooltip from '../Tooltip.svelte';
  import { getTooltipStore } from '../../stores';
  import logoDiffusionDB from '../../imgs/logo-diffusiondb.svg?raw';
  import iconGithub from '../../imgs/icon-github.svg?raw';

  let component: HTMLElement | null = null;
  let view = 'prompt-embedding';

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

  // Initialize the stores to pass to child components
  const tooltipStore = getTooltipStore();
</script>

<style lang="scss">
  @import './MapView.scss';
</style>

<div class="mapview-page">
  <Tooltip tooltipStore="{tooltipStore}" />
  <div id="popper-tooltip" class="hidden" role="tooltip">
    <span id="popper-content"></span>
    <div id="popper-arrow"></div>
  </div>

  <div class="app-wrapper">
    <!-- <div class="app-title">
      <div class="title-left">
        <span class="app-name"> WizMap </span>
      </div>

      <div class="title-right">
        <a class="title-link" href="https://github.com/anonacl/diffusiondb">
          {@html iconGithub}
        </a>
      </div>
    </div> -->

    <div class="main-app" bind:this="{component}">
      <div
        class="main-app-container"
        class:hidden="{view !== 'prompt-embedding'}"
      >
        <Embedding tooltipStore="{tooltipStore}" embeddingName="{'prompt'}" />
      </div>
    </div>
  </div>
</div>
