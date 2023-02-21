<script lang="ts">
  import { onMount } from 'svelte';
  import { Footer } from './Footer';
  import type { EmbeddingInitSetting } from '../../types/embedding-types';
  import type { Writable } from 'svelte/store';
  import type { FooterStoreValue } from '../../stores';
  import iconPlus from '../../imgs/icon-plus.svg?raw';
  import iconMinus from '../../imgs/icon-minus.svg?raw';
  import iconHome from '../../imgs/icon-home.svg?raw';
  import iconGithub from '../../imgs/icon-github.svg?raw';
  import iconFile from '../../imgs/icon-file.svg?raw';
  import iconPlay from '../../imgs/icon-play.svg?raw';
  import iconWizmap from '../../imgs/icon-wizmap.svg?raw';

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
    <button
      class="zoom-button zoom-button-reset"
      on:click="{() => {
        myFooter?.zoomResetClicked();
      }}"><div class="svg-icon">{@html iconHome}</div></button
    >
  </div>

  <div class="zoom-control">
    <button
      class="zoom-button zoom-button-plus"
      on:click="{() => {
        myFooter?.zoomInClicked();
      }}"><div class="svg-icon">{@html iconPlus}</div></button
    >
    <button
      class="zoom-button zoom-button-minus"
      on:click="{() => {
        myFooter?.zoomOutClicked();
      }}"><div class="svg-icon">{@html iconMinus}</div></button
    >
  </div>

  <div class="footer">
    <span class="name"
      ><span class="svg-icon">{@html iconWizmap}</span>WizMap
    </span>
    <div class="splitter"></div>

    <a href="https://github.com/poloclub/wizmap"
      ><span class="item">
        <span class="svg-icon">{@html iconFile}</span>
        Paper
      </span></a
    >
    <div class="splitter"></div>

    <a href="https://github.com/poloclub/wizmap"
      ><span class="item">
        <span class="svg-icon">{@html iconGithub}</span>
        Code
      </span></a
    >
    <div class="splitter"></div>

    <a href="https://github.com/poloclub/wizmap"
      ><span class="item">
        <span class="svg-icon">{@html iconPlay}</span>
        Video
      </span></a
    >
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
