<script lang="ts">
  import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import iconCaret from '../../imgs/icon-caret-down.svg?raw';
  import iconContour2 from '../../imgs/icon-contour.svg?raw';
  import iconGrid from '../../imgs/icon-grid.svg?raw';
  import iconLabel from '../../imgs/icon-label.svg?raw';
  import iconPause from '../../imgs/icon-pause-solid.svg?raw';
  import iconPlay from '../../imgs/icon-play-solid.svg?raw';
  import iconPoint from '../../imgs/icon-point.svg?raw';
  import iconTime from '../../imgs/icon-time.svg?raw';
  import type {
    FloatingWindowStoreValue,
    FooterStoreValue,
    SearchBarStoreValue
  } from '../../stores';
  import type { NotebookEvent } from '../../types/common-types';
  import type {
    DataURLs,
    EmbeddingInitSetting
  } from '../../types/embedding-types';
  import FloatingWindow from '../floating-window/FloatingWindow.svelte';
  import { Embedding } from './Embedding';
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
    showLabel: true
  };

  export let datasetName: string;
  export let dataURL: string | null = null;
  export let gridURL: string | null = null;
  export let footerStore: Writable<FooterStoreValue>;
  export let searchBarStore: Writable<SearchBarStoreValue>;
  export let floatingWindowStore: Writable<FloatingWindowStoreValue>;
  export let notebookMode: boolean;

  // Resolve the embedding data files based on the embedding
  let DATA_BASE = `${import.meta.env.BASE_URL}data`;
  const CLOUD_BASE = 'https://pub-596951ee767949aba9096a18685c74bd.r2.dev';
  if (import.meta.env.MODE === 'vercel' || import.meta.env.MODE === 'github') {
    DATA_BASE = CLOUD_BASE;
  }
  const HF_BASE =
    'https://huggingface.co/datasets/xiaohk/embeddings/resolve/main';

  const dataURLs: DataURLs = {
    point: '',
    grid: ''
  };

  switch (datasetName) {
    case 'diffusiondb': {
      // dataURLs.point = DATA_BASE + '/diffusiondb/umap-mini.ndjson';
      dataURLs.point = CLOUD_BASE + '/diffusiondb/umap.ndjson';
      dataURLs.grid = CLOUD_BASE + '/diffusiondb/grid.json';
      break;
    }

    case 'acl-abstracts': {
      dataURLs.point = DATA_BASE + '/acl-abstracts/umap.ndjson';
      dataURLs.grid = DATA_BASE + '/acl-abstracts/grid.json';
      break;
    }

    case 'imdb': {
      dataURLs.point = HF_BASE + '/imdb/data.ndjson';
      dataURLs.grid = HF_BASE + '/imdb/grid.json';
      break;
    }

    case 'temp': {
      dataURLs.point = DATA_BASE + '/temp/data.ndjson';
      dataURLs.grid = DATA_BASE + '/temp/grid.json';
      break;
    }

    default: {
      console.error(`Unknown dataset name: ${datasetName}`);
    }
  }

  // If dataURL and gridURL are given, use them to override the default dataset
  if (dataURL && gridURL) {
    dataURLs.point = dataURL;
    dataURLs.grid = gridURL;
  }

  const anyTrue = (items: boolean[]) => items.reduce((a, b) => a || b);
  const allTrue = (items: boolean[]) => items.reduce((a, b) => a && b);

  onMount(() => {
    mounted = true;
  });

  const updateEmbedding = () => {
    myEmbedding = myEmbedding;
  };

  const displayCheckboxChanged = (
    e: InputEvent,
    checkbox: string,
    group: string | undefined = undefined
  ) => {
    const newValue = (e.target as HTMLInputElement).checked;
    myEmbedding?.displayCheckboxChanged(checkbox, newValue, group);
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
        searchBarStore,
        floatingWindowStore
      });
    }
  };

  // If it is notebook mode, we don't init the view until we get users' URLs
  if (notebookMode) {
    document.addEventListener('wizmapData', (e: Event) => {
      const notebookEvent = e as NotebookEvent;
      dataURLs.point = notebookEvent.dataURL;
      dataURLs.grid = notebookEvent.gridURL;
      initView();
    });
  }

  $: mounted && !initialized && component && !notebookMode && initView();
</script>

<style lang="scss">
  @use './Embedding.scss' as *;
</style>

<div class="embedding-wrapper" bind:this="{component}">
  <div class="grab-blocker"></div>
  <div class="embedding">
    <svg class="top-svg"></svg>
    <canvas class="search-point-canvas hidden"></canvas>
    <canvas class="embedding-canvas"></canvas>
    <canvas class="embedding-canvas-back"></canvas>
    <canvas class="topic-grid-canvas top"></canvas>
    <canvas class="topic-grid-canvas bottom"></canvas>
    <svg class="embedding-svg"></svg>
  </div>

  <div class="floating-window-wrapper">
    <FloatingWindow {floatingWindowStore} />
  </div>

  <div class="control-bar">
    <button
      class="item-wrapper"
      on:click="{() => {
        if (!myEmbedding || myEmbedding.groupNames === null) {
          myEmbedding?.displayCheckboxChanged(
            'contour',
            !myEmbedding.showContours[0]
          );
        } else {
          if (controlDisplayItem === 'contour') {
            controlDisplayItem = '';
          } else {
            if (controlDisplayItem === 'time') {
              myEmbedding?.displayCheckboxChanged('time', false);
            }
            controlDisplayItem = 'contour';
          }
        }
      }}"
    >
      <div
        class="item"
        class:activated="{myEmbedding
          ? anyTrue(myEmbedding.showContours)
          : false}"
      >
        <div class="svg-icon">{@html iconContour}</div>
        <div class="name">Contour</div>
        <div
          class="caret"
          class:hidden="{!myEmbedding || myEmbedding.groupNames === null}"
          class:activated="{controlDisplayItem === 'contour'}"
        >
          <div class="svg-icon">
            {@html iconCaret}
          </div>
        </div>
      </div>

      {#if myEmbedding?.groupNames !== null}
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
              checked="{defaultSetting.showContour}"
              on:input="{e =>
                displayCheckboxChanged(
                  e,
                  'contour',
                  myEmbedding?.groupNames[0]
                )}"
            />
            <label for="checkbox-contour-1">{myEmbedding?.groupNames[0]}</label>
          </div>

          <div class="control-row">
            <input
              type="checkbox"
              class="checkbox"
              id="checkbox-contour-2"
              name="checkbox-contour-2"
              checked="{defaultSetting.showContour}"
              on:input="{e =>
                displayCheckboxChanged(
                  e,
                  'contour',
                  myEmbedding?.groupNames[1]
                )}"
            />
            <label for="checkbox-contour-2">{myEmbedding?.groupNames[1]}</label>
          </div>
        </button>
      {/if}
    </button>
    <div class="flex-gap"></div>

    <button
      class="item-wrapper"
      on:click="{() => {
        if (!myEmbedding || myEmbedding.groupNames === null) {
          myEmbedding?.displayCheckboxChanged(
            'point',
            !myEmbedding.showPoints[0]
          );
        } else {
          if (controlDisplayItem === 'point') {
            controlDisplayItem = '';
          } else {
            if (controlDisplayItem === 'time') {
              myEmbedding?.displayCheckboxChanged('time', false);
            }
            controlDisplayItem = 'point';
          }
        }
      }}"
    >
      <div
        class="item"
        class:activated="{myEmbedding
          ? anyTrue(myEmbedding.showPoints)
          : false}"
      >
        <div class="svg-icon">{@html iconPoint}</div>
        <div class="name">Point</div>
        <div
          class="caret"
          class:hidden="{!myEmbedding || myEmbedding.groupNames === null}"
          class:activated="{controlDisplayItem === 'point'}"
        >
          <div class="svg-icon">
            {@html iconCaret}
          </div>
        </div>
      </div>

      {#if myEmbedding?.groupNames !== null}
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
              checked="{defaultSetting.showPoint}"
              on:input="{e =>
                displayCheckboxChanged(e, 'point', myEmbedding?.groupNames[0])}"
            />
            <label for="checkbox-point-1">{myEmbedding?.groupNames[0]}</label>
          </div>

          <div class="control-row">
            <input
              type="checkbox"
              class="checkbox"
              id="checkbox-point-2"
              name="checkbox-point-2"
              checked="{defaultSetting.showPoint}"
              on:input="{e =>
                displayCheckboxChanged(e, 'point', myEmbedding?.groupNames[1])}"
            />
            <label for="checkbox-point-2">{myEmbedding?.groupNames[1]}</label>
          </div>
        </button>
      {/if}
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
          if (controlDisplayItem === 'time') {
            myEmbedding?.displayCheckboxChanged('time', false);
          }
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
      disabled="{myEmbedding ? myEmbedding.timeCountMap === null : true}"
      on:click="{() => {
        if (controlDisplayItem === 'time') {
          controlDisplayItem = '';
          myEmbedding?.displayCheckboxChanged('time', false);
        } else {
          controlDisplayItem = 'time';
          myEmbedding?.displayCheckboxChanged('time', true);
        }
      }}"
    >
      <button class="item" class:activated="{controlDisplayItem === 'time'}">
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
