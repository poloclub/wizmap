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
  let showControl = true;
  let selectedHoverMode = 'label';

  export let tooltipStore: Writable<TooltipStoreValue> | null = null;

  onMount(() => {
    mounted = true;
  });

  const updateEmbedding = () => {
    embedding = embedding;
  };

  const hoverModeClicked = (mode: string) => {
    if (selectedHoverMode !== mode) {
      embedding?.hoverModeChanged(mode);
    }
    selectedHoverMode = mode;
  };

  const displayCheckboxChanged = (e: InputEvent, checkbox: string) => {
    const newValue = (e.target as HTMLInputElement).checked;
    embedding?.displayCheckboxChanged(checkbox, newValue);
  };

  /**
   * Initialize the embedding view.
   */
  const initView = () => {
    initialized = true;

    if (component && tooltipStore) {
      embedding = new Embedding({ component, tooltipStore, updateEmbedding });
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
    <canvas class="topic-grid-canvas" />
    <svg class="embedding-svg" />
  </div>

  <div class="control-panel" class:shown={showControl}>
    <div class="header">Setting</div>

    <div class="splitter" />

    <div class="control-item">
      <div class="item-header">Display</div>

      <div class="control-row">
        <label for="checkbox-contour">Density Contour</label>
        <input
          type="checkbox"
          class="checkbox"
          id="checkbox-contour"
          name="checkbox-contour"
          checked
          on:input={e => displayCheckboxChanged(e, 'contour')}
        />
      </div>

      <div class="control-row">
        <label for="checkbox-grid">Label Grid</label>
        <input
          type="checkbox"
          class="checkbox"
          id="checkbox-grid"
          name="checkbox-grid"
          checked
          on:input={e => displayCheckboxChanged(e, 'grid')}
        />
      </div>

      <div class="control-row">
        <label for="checkbox-point">Data Points</label>
        <input
          type="checkbox"
          class="checkbox"
          id="checkbox-point"
          name="checkbox-point"
          on:input={e => displayCheckboxChanged(e, 'point')}
        />
      </div>
    </div>

    <div class="splitter" />

    <div class="control-item">
      <div class="control-row">
        <label class="item-header" for="slider-label-num"
          >Number of Labels</label
        >
        <span>{embedding ? `${embedding.curLabelNum}` : '1'}</span>
      </div>
      <input
        type="range"
        class="slider"
        id="slider-label-num"
        name="label-num"
        min="0"
        max={embedding ? `${embedding.maxLabelNum}` : '1'}
        on:input={e =>
          embedding ? embedding.labelNumSliderChanged(e) : () => {}}
      />
    </div>

    <div class="splitter" />

    <div class="control-item">
      <div class="item-header">Mouse Hover Mode</div>

      <div class="segmented-control">
        <div
          class="segmented-control-option"
          class:selected={selectedHoverMode === 'label'}
          on:click={() => {
            hoverModeClicked('label');
          }}
        >
          Label
        </div>
        <div
          class="segmented-control-option"
          class:selected={selectedHoverMode === 'point'}
          on:click={() => {
            hoverModeClicked('point');
          }}
        >
          Point
        </div>
        <div
          class="segmented-control-option"
          class:selected={selectedHoverMode === 'none'}
          on:click={() => {
            hoverModeClicked('none');
          }}
        >
          None
        </div>
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
