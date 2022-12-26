<script lang="ts">
  import { Embedding } from './Embedding';
  import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { TooltipStoreValue } from '../../stores';
  import { getTooltipStoreDefaultValue } from '../../stores';

  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let embedding: Embedding | null = null;

  export let tooltipStore: Writable<TooltipStoreValue> | null = null;

  onMount(() => {
    mounted = true;
  });

  /**
   * Initialize the embedding view.
   */
  const initView = () => {
    initialized = true;

    if (component) {
      embedding = new Embedding({ component, tooltipStore });
    }
  };

  $: mounted && component && tooltipStore && initView();
</script>

<style lang="scss">
  @import './Embedding.scss';
</style>

<div class="embedding-wrapper" bind:this={component}>
  <div class="embedding">
    <svg class="top-svg" />
    <canvas class="embedding-canvas" />
    <canvas class="embedding-canvas-back" />
    <svg class="embedding-svg" />
  </div>
</div>
