<script lang="ts">
  import { Embedding } from './Embedding';
  import { onMount } from 'svelte';
  import type {
    EmbeddingInitSetting,
    DataURLs
  } from '../../types/embedding-types';
  import type { Writable } from 'svelte/store';
  import type { FooterStoreValue, SearchBarStoreValue } from '../../stores';
  import iconContour2 from '../../imgs/icon-contour.svg?raw';
  import iconPoint from '../../imgs/icon-point.svg?raw';
  import iconLabel from '../../imgs/icon-label.svg?raw';
  import iconGrid from '../../imgs/icon-grid.svg?raw';
  import iconTime from '../../imgs/icon-time.svg?raw';
  import iconCaret from '../../imgs/icon-caret-down.svg?raw';
  import iconPlay from '../../imgs/icon-play-solid.svg?raw';
  import iconPause from '../../imgs/icon-pause-solid.svg?raw';
  const iconContour = iconContour2.replaceAll('black', 'currentColor');

  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let myEmbedding: Embedding | null = null;
  let controlDisplayItem = '';

  const defaultSetting: EmbeddingInitSetting = {
    showContour: true,
    showPoint: true,
    showGrid: false,
    showLabel: false,
    timeInspectMode: false
  };

  export let datasetName = 'diffusiondb';
  export let footerStore: Writable<FooterStoreValue>;
  export let searchBarStore: Writable<SearchBarStoreValue>;

  // Resolve the embedding data files based on the embedding
  let DATA_BASE = `${import.meta.env.BASE_URL}data`;
  if (import.meta.env.PROD) {
    DATA_BASE = 'https://pub-596951ee767949aba9096a18685c74bd.r2.dev';
  }

  const dataURLs: DataURLs = {
    point: '',
    grid: '',
    topic: ''
  };

  switch (datasetName) {
    case 'diffusiondb': {
      dataURLs.point = DATA_BASE + '/diffusiondb/umap-1m.ndjson';
      dataURLs.grid = DATA_BASE + '/diffusiondb/umap-1m-grid.json';
      dataURLs.topic = DATA_BASE + '/diffusiondb/umap-1m-topic-data.json';
      break;
    }

    case 'acl-abstracts': {
      dataURLs.point = DATA_BASE + '/acl-abstracts/umap.ndjson';
      dataURLs.grid = DATA_BASE + '/acl-abstracts/grid.json';
      dataURLs.topic = DATA_BASE + '/acl-abstracts/topic.json';
      break;
    }

    default: {
      console.error(`Unknown dataset name: ${datasetName}`);
    }
  }

  onMount(() => {
    mounted = true;
  });

  const updateEmbedding = () => {
    myEmbedding = myEmbedding;
  };

  const displayCheckboxChanged = (e: InputEvent, checkbox: string) => {
    const newValue = (e.target as HTMLInputElement).checked;
    myEmbedding?.displayCheckboxChanged(checkbox, newValue);
  };

  /**
   * Initialize the embedding view.
   */
  const initView = () => {
    initialized = true;

    if (component) {
      myEmbedding = new Embedding({
        component,
        updateEmbedding,
        defaultSetting,
        dataURLs,
        footerStore,
        searchBarStore
      });
    }
  };

  $: mounted && !initialized && component && initView();
</script>

<style lang="scss">
  @import './Embedding.scss';
</style>

<div class="embedding-wrapper" bind:this="{component}">
  <div class="grab-blocker"></div>
  <div class="embedding">
    <svg class="top-svg"></svg>
    <canvas class="embedding-canvas"></canvas>
    <canvas class="embedding-canvas-back"></canvas>
    <canvas class="topic-grid-canvas top"></canvas>
    <canvas class="topic-grid-canvas bottom"></canvas>
    <svg class="embedding-svg"></svg>
  </div>

  <div class="control-bar">
    <button
      class="item-wrapper"
      on:click="{() => {
        if (controlDisplayItem === 'contour') {
          controlDisplayItem = '';
        } else {
          controlDisplayItem = 'contour';
        }
      }}"
    >
      <div class="item" class:activated="{defaultSetting.showContour}">
        <div class="svg-icon">{@html iconContour}</div>
        <div class="name">Contour</div>
        <div class="caret" class:activated="{controlDisplayItem === 'contour'}">
          <div class="svg-icon">
            {@html iconCaret}
          </div>
        </div>
      </div>

      <button
        class="menu contour-menu"
        class:hidden="{controlDisplayItem !== 'contour'}"
        on:click="{e => {
          e.stopPropagation();
        }}"
      >
        <div class="control-row">
          <input
            type="checkbox"
            class="checkbox"
            id="checkbox-contour-1"
            name="checkbox-contour-1"
            bind:checked="{defaultSetting.showContour}"
            on:input="{e => displayCheckboxChanged(e, 'contour')}"
          />
          <label for="checkbox-contour-1">Prompts</label>
        </div>

        <div class="control-row">
          <input
            type="checkbox"
            class="checkbox"
            id="checkbox-contour-2"
            name="checkbox-contour-2"
            bind:checked="{defaultSetting.showContour}"
            on:input="{e => displayCheckboxChanged(e, 'contour')}"
          />
          <label for="checkbox-contour-2">Images</label>
        </div>
      </button>
    </button>
    <div class="flex-gap"></div>

    <button
      class="item-wrapper"
      on:click="{() => {
        if (controlDisplayItem === 'point') {
          controlDisplayItem = '';
        } else {
          controlDisplayItem = 'point';
        }
      }}"
    >
      <div class="item" class:activated="{defaultSetting.showPoint}">
        <div class="svg-icon">{@html iconPoint}</div>
        <div class="name">Point</div>
        <div class="caret" class:activated="{controlDisplayItem === 'point'}">
          <div class="svg-icon">
            {@html iconCaret}
          </div>
        </div>
      </div>

      <button
        class="menu point-menu"
        class:hidden="{controlDisplayItem !== 'point'}"
        on:click="{e => {
          e.stopPropagation();
        }}"
      >
        <div class="control-row">
          <input
            type="checkbox"
            class="checkbox"
            id="checkbox-point-1"
            name="checkbox-point-1"
            bind:checked="{defaultSetting.showPoint}"
            on:input="{e => displayCheckboxChanged(e, 'point')}"
          />
          <label for="checkbox-point-1">Prompts</label>
        </div>

        <div class="control-row">
          <input
            type="checkbox"
            class="checkbox"
            id="checkbox-point-2"
            name="checkbox-point-2"
            bind:checked="{defaultSetting.showPoint}"
            on:input="{e => displayCheckboxChanged(e, 'point')}"
          />
          <label for="checkbox-point-2">Images</label>
        </div>
      </button>
    </button>
    <div class="flex-gap"></div>

    <button
      class="item-wrapper"
      on:click="{() => {
        if (defaultSetting.showGrid) {
          defaultSetting.showGrid = false;
          myEmbedding?.displayCheckboxChanged('grid', false);
        } else {
          defaultSetting.showGrid = true;
          myEmbedding?.displayCheckboxChanged('grid', true);
        }
      }}"
    >
      <div class="item" class:activated="{defaultSetting.showGrid}">
        <div class="svg-icon">{@html iconGrid}</div>
        <div class="name">Grid</div>
      </div>
    </button>
    <div class="flex-gap"></div>

    <button
      class="item-wrapper"
      on:click="{() => {
        if (controlDisplayItem === 'label') {
          controlDisplayItem = '';
        } else {
          controlDisplayItem = 'label';
        }
      }}"
    >
      <div class="item" class:activated="{defaultSetting.showLabel}">
        <div class="svg-icon">{@html iconLabel}</div>
        <div class="name">Label</div>
        <div class="caret" class:activated="{controlDisplayItem === 'label'}">
          <div class="svg-icon">
            {@html iconCaret}
          </div>
        </div>
      </div>

      <button
        class="menu label-menu"
        class:hidden="{controlDisplayItem !== 'label'}"
        on:click="{e => {
          e.stopPropagation();
        }}"
      >
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
              myEmbedding ? myEmbedding.labelNumSliderChanged(e) : () => {}}"
          />
        </div>
      </button>
    </button>
    <div class="flex-gap"></div>

    <button
      class="item-wrapper"
      on:click="{() => {
        if (controlDisplayItem === 'time') {
          controlDisplayItem = '';
          defaultSetting.timeInspectMode = false;
        } else {
          controlDisplayItem = 'time';
          defaultSetting.timeInspectMode = true;
        }
      }}"
    >
      <button class="item" class:activated="{defaultSetting.timeInspectMode}">
        <div class="svg-icon">{@html iconTime}</div>
        <div class="name">Time</div>
        <div class="caret" class:activated="{controlDisplayItem === 'time'}">
          <div class="svg-icon">
            {@html iconCaret}
          </div>
        </div>
      </button>

      <button
        class="menu time-menu"
        class:hidden="{controlDisplayItem !== 'time'}"
        on:click="{e => {
          e.stopPropagation();
        }}"
      >
        <div class="control-row">
          <div class="play-pause-button">
            <button
              class="svg-icon"
              class:hidden="{myEmbedding
                ? myEmbedding.playingTimeSlider
                : false}"
            >
              {@html iconPlay}
            </button>
            <button
              class="svg-icon"
              class:hidden="{myEmbedding
                ? !myEmbedding.playingTimeSlider
                : true}"
            >
              {@html iconPause}
            </button>
          </div>

          <div class="slider-container">
            <div class="back-slider"></div>

            <div class="slider">
              <div class="range-track"></div>
              <div
                class="middle-thumb"
                id="time-slider-middle-thumb"
                tabindex="-1"
              >
                <div class="thumb-label thumb-label-middle">
                  <span class="thumb-label-span"></span>
                </div>
              </div>
            </div>

            <div class="slider-svg-container">
              <svg class="slider-svg"> </svg>
            </div>
          </div>
        </div>
      </button>
    </button>
  </div>
</div>
