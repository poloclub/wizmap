<script lang="ts">
  import Embedding from '../embedding/Embedding.svelte';
  import Packing from '../packing/Packing.svelte';
  import Tooltip from '../Tooltip.svelte';
  import { getTooltipStore } from '../../stores';
  import logoDiffusionDB from '../../imgs/logo-diffusiondb.svg?raw';
  import iconGithub from '../../imgs/icon-github.svg?raw';

  let component: HTMLElement | null = null;
  let view = 'embedding';

  // Initialize the stores to pass to child components
  const tooltipStore = getTooltipStore();
</script>

<style lang="scss">
  @import './DiffusiondbVis.scss';
</style>

<div class="diffusiondbvis-page">
  <Tooltip {tooltipStore} />

  <div class="app-wrapper">
    <div class="app-title">
      <div class="title-left">
        <div class="app-icon">
          {@html logoDiffusionDB}
        </div>
        <span class="app-name"> DiffusionDB Explorer </span>
      </div>

      <div class="title-right">
        <div class="title-link">
          {@html iconGithub}
          <!-- <a href="https://github.com/poloclub/diffusiondb">Code</a> -->
        </div>
      </div>
    </div>

    <div class="main-app" bind:this={component}>
      <div class="main-app-container" class:hidden={view !== 'embedding'}>
        <Embedding {tooltipStore} />
      </div>

      <div class="main-app-container" class:hidden={view !== 'phrase'}>
        <Packing {tooltipStore} />
      </div>
    </div>

    <div class="app-tabs">
      <button
        class="tab"
        class:selected={view === 'embedding'}
        on:click={() => {
          view = 'embedding';
        }}
        data-text="Prompt Embedding">Prompt Embedding</button
      >
      <span class="splitter" />
      <button
        class="tab"
        class:selected={view === 'phrase'}
        on:click={() => {
          view = 'phrase';
        }}
        data-text="Popular Phrases">Popular Phrases</button
      >
    </div>
  </div>
</div>
