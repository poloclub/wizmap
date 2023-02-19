<script lang="ts">
  import { onMount } from 'svelte';
  import { Footer } from './Footer';
  import type { EmbeddingInitSetting } from '../../types/embedding-types';
  import type { Writable } from 'svelte/store';
  import type { FooterStoreValue } from '../../stores';
  import iconPlus from '../../imgs/icon-plus.svg?raw';
  import iconMinus from '../../imgs/icon-minus.svg?raw';
  import iconHome from '../../imgs/icon-home.svg?raw';

  export let footerStore: Writable<FooterStoreValue>;

  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let myFooter: Footer | null = null;
  const scaleWidth = 50;

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
      myFooter = new Footer(component, scaleWidth, footerStore, footerUpdated);
    }
  };

  $: mounted && !initialized && component && footerStore && initView();
</script>

<style lang="scss">
  @import './Footer.scss';
</style>

<div class="footer-wrapper" bind:this="{component}">
  <div class="zoom-control">
    <button class="zoom-button zoom-button-reset"
      ><div class="svg-icon">{@html iconHome}</div></button
    >
  </div>

  <div class="zoom-control">
    <button class="zoom-button zoom-button-plus"
      ><div class="svg-icon">{@html iconPlus}</div></button
    >
    <button class="zoom-button zoom-button-minus"
      ><div class="svg-icon">{@html iconMinus}</div></button
    >
  </div>

  <div class="footer">
    <span class="name">WizMap </span>
    <div class="splitter"></div>
    <span><a href="https://github.com/poloclub/wizmap">Paper</a> </span>
    <div class="splitter"></div>
    <span><a href="https://github.com/poloclub/wizmap">Code</a> </span>
    <div class="splitter"></div>
    <span><a href="https://github.com/poloclub/wizmap">Video</a> </span>
    <div class="splitter"></div>
    <span>{myFooter ? myFooter.numPoints : '0'} Data points</span>
    <div class="splitter"></div>
    <div class="scale-legend">
      <span class="sclae-num"
        >{myFooter ? myFooter.scaleDataWidth : '0.0000'}</span
      >
      <div class="scale-line" style="{`width: ${scaleWidth}px`}"></div>
    </div>
  </div>
</div>