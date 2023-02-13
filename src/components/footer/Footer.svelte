<script lang="ts">
  import { onMount } from 'svelte';
  import { Footer } from './Footer';
  import type { EmbeddingInitSetting } from '../../types/embedding-types';
  import type { Writable } from 'svelte/store';
  import type { FooterStoreValue } from '../../stores';
  import iconGear from '../../imgs/icon-gear.svg?raw';

  export let footerStore: Writable<FooterStoreValue>;

  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let myFooter: Footer | null = null;

  const footerUpdated = () => {
    myFooter = myFooter;
  };

  onMount(() => {
    mounted = true;
  });

  /**
   * Initialize the embedding view.
   */
  const initView = () => {
    initialized = true;

    if (component && footerStore) {
      myFooter = new Footer(component, footerStore, footerUpdated);
    }
  };

  $: mounted && !initialized && component && footerStore && initView();
</script>

<style lang="scss">
  @import './Footer.scss';
</style>

<div class="footer-wrapper" bind:this="{component}">
  <div class="footer">
    <span class="name">WizMap </span>
    <div class="splitter"></div>
    <span><a href="https://github.com/poloclub/wizmap">Paper</a> </span>
    <div class="splitter"></div>
    <span><a href="https://github.com/poloclub/wizmap">Code</a> </span>
    <div class="splitter"></div>
    <span><a href="https://github.com/poloclub/wizmap">Video</a> </span>
    <div class="splitter"></div>
    <span>{myFooter ? myFooter.numPoints : '0'} data points</span>
    <div class="splitter"></div>
    <div class="scale-legend"></div>
  </div>
</div>
