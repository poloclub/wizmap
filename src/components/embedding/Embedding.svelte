<script lang="ts">
  import { Embedding } from './Embedding';
  import { onMount } from 'svelte';
  import type { EmbeddingInitSetting } from '../../types/embedding-types';
  import type { Writable } from 'svelte/store';
  import type { FooterStoreValue } from '../../stores';
  import iconGear from '../../imgs/icon-gear.svg?raw';

  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let embedding: Embedding | null = null;
  let showControl = false;

  const defaultSetting: EmbeddingInitSetting = {
    showContour: true,
    showPoint: true,
    showGrid: false,
    showLabel: false,
    hover: 'point'
  };

  export let embeddingName = 'prompt';
  export let footerStore: Writable<FooterStoreValue>;

  onMount(() => {
    mounted = true;
  });

  const updateEmbedding = () => {
    embedding = embedding;
  };

  const hoverModeClicked = (mode: string) => {
    if (defaultSetting.hover !== mode) {
      embedding?.hoverModeChanged(mode);
    }

    if (mode === 'point' || mode === 'label' || mode === 'none') {
      defaultSetting.hover = mode;
    }
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

    if (component) {
      embedding = new Embedding({
        component,
        updateEmbedding,
        defaultSetting,
        embeddingName,
        footerStore
      });
    }
  };

  $: mounted && !initialized && component && initView();
</script>

<style lang="scss">
  @import './Embedding.scss';
</style>

<div class="embedding-wrapper" bind:this="{component}">
  <div class="embedding">
    <svg class="top-svg"></svg>
    <canvas class="embedding-canvas"></canvas>
    <canvas class="embedding-canvas-back"></canvas>
    <canvas class="topic-grid-canvas top"></canvas>
    <canvas class="topic-grid-canvas bottom"></canvas>
    <svg class="embedding-svg"></svg>
  </div>

  <div class="control-panel" class:shown="{showControl}">
    <div class="header">Setting</div>

    <div class="splitter"></div>

    <div class="control-item">
      <div class="item-header">Display</div>

      <div class="control-row">
        <input
          type="checkbox"
          class="checkbox"
          id="checkbox-contour"
          name="checkbox-contour"
          bind:checked="{defaultSetting.showContour}"
          on:input="{e => displayCheckboxChanged(e, 'contour')}"
        />
        <label for="checkbox-contour">Density Contour</label>
      </div>

      <div class="control-row">
        <input
          type="checkbox"
          class="checkbox"
          id="checkbox-point"
          name="checkbox-point"
          bind:checked="{defaultSetting.showPoint}"
          on:input="{e => displayCheckboxChanged(e, 'point')}"
        />
        <label for="checkbox-point">Data Points</label>
      </div>

      <div class="control-row">
        <input
          type="checkbox"
          class="checkbox"
          id="checkbox-grid"
          name="checkbox-grid"
          bind:checked="{defaultSetting.showGrid}"
          on:input="{e => displayCheckboxChanged(e, 'grid')}"
        />
        <label for="checkbox-grid">Label Grid</label>
      </div>
    </div>

    <div class="splitter"></div>

    <div class="control-item">
      <div class="item-header">Automatic Labeling</div>

      <div class="control-row">
        <input
          type="checkbox"
          class="checkbox"
          id="checkbox-label"
          name="checkbox-label"
          bind:checked="{defaultSetting.showLabel}"
          on:input="{e => displayCheckboxChanged(e, 'label')}"
        />
        <label for="checkbox-label">High Density Region</label>
      </div>
    </div>

    <div class="control-item slider-item">
      <div class="control-row">
        <label class="slider-label" for="slider-label-num"
          >Number of Labels</label
        >
        <span class="slider-count">0</span>
      </div>

      <input
        type="range"
        class="slider"
        id="slider-label-num"
        name="label-num"
        disabled="{!defaultSetting.showLabel}"
        min="0"
        max="0"
        on:input="{e =>
          embedding ? embedding.labelNumSliderChanged(e) : () => {}}"
      />
    </div>

    <div class="splitter"></div>

    <div class="control-item">
      <div class="item-header">Mouse Hover Mode</div>

      <div class="segmented-control">
        <div
          class="segmented-control-option"
          class:selected="{defaultSetting.hover === 'label'}"
          on:click="{() => {
            hoverModeClicked('label');
          }}"
          on:keypress="{() => {
            hoverModeClicked('label');
          }}"
        >
          Label
        </div>
        <div
          class="segmented-control-option"
          class:selected="{defaultSetting.hover === 'point'}"
          on:click="{() => {
            hoverModeClicked('point');
          }}"
          on:keypress="{() => {
            hoverModeClicked('point');
          }}"
        >
          Point
        </div>
        <div
          class="segmented-control-option"
          class:selected="{defaultSetting.hover === 'none'}"
          on:click="{() => {
            hoverModeClicked('none');
          }}"
          on:keypress="{() => {
            hoverModeClicked('none');
          }}"
        >
          None
        </div>
      </div>
    </div>
  </div>

  <div
    class="setting-icon"
    on:click="{() => {
      showControl = !showControl;
    }}"
    on:keypress="{() => {
      showControl = !showControl;
    }}"
  >
    <div class="icon-wrapper svg-icon" class:activated="{showControl}">
      {@html iconGear}
    </div>
  </div>
</div>
