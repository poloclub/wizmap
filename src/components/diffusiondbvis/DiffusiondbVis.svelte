<script lang="ts">
  import Embedding from '../embedding/Embedding.svelte';
  import Packing from '../packing/Packing.svelte';
  import Tooltip from '../Tooltip.svelte';
  import { getTooltipStore } from '../../stores';

  let component: HTMLElement | null = null;
  let view = 'packing';

  // Initialize the stores to pass to child components
  const tooltipStore = getTooltipStore();
</script>

<style lang="scss">
  @import './DiffusiondbVis.scss';
</style>

<div class="diffusiondbvis-page">
  <Tooltip {tooltipStore} />

  <div class="main-app" bind:this={component}>
    {#if view === 'embedding'}
      <Embedding {tooltipStore} />
    {:else if view === 'packing'}
      <Packing {tooltipStore} />
    {/if}
  </div>
</div>
