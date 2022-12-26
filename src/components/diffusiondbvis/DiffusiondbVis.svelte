<script lang="ts">
  import Embedding from '../embedding/Embedding.svelte';
  import Tooltip from '../Tooltip.svelte';
  import { getTooltipStore } from '../../stores';
  let component = null;

  // Initialize the stores to pass to child components
  const tooltipStore = getTooltipStore();
</script>

<style lang="scss">
  @import './DiffusiondbVis.scss';
</style>

<div class="diffusiondbvis-page">
  <Tooltip {tooltipStore} />
  <div class="main-app" bind:this={component}>
    <Embedding {tooltipStore} />
  </div>
</div>
