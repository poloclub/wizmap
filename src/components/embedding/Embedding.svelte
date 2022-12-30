<script lang="ts">
  import { Embedding } from './Embedding';
  import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { TooltipStoreValue } from '../../stores';
  import { getTooltipStoreDefaultValue } from '../../stores';
  import iconGear from '../../imgs/icon-gear.svg?raw';

  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let embedding: Embedding | null = null;
  let showControl = false;

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

  <div class="control-panel" class:shown={showControl}>
    <div class="header">Setting</div>

    <div class="splitter" />

    <div class="control-item">
      <div class="control-row">
        <label for="slider-label-num">Num of Labels</label>
        <span>20</span>
      </div>
      <input
        type="range"
        class="slider"
        id="slider-label-num"
        name="label-num"
        min="0"
        max="25"
      />
    </div>

    <div class="splitter" />

    <div class="control-item">
      <div class="control-row">
        <label for="checkbox-point">Show Points</label>
        <input
          type="checkbox"
          class="checkbox"
          id="checkbox-point"
          name="checkbox-point"
        />
      </div>
    </div>
  </div>

  <div
    class="setting-icon svg-icon"
    class:activated={showControl}
    on:click={() => {
      showControl = !showControl;
    }}
  >
    {@html iconGear}
  </div>
</div>
