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
  import iconFolder from '../../imgs/icon-folder.svg?raw';

  export let footerStore: Writable<FooterStoreValue>;

  let component: HTMLElement | null = null;
  let dialogElement: HTMLDialogElement | null = null;
  let mounted = false;
  let initialized = false;
  let myFooter: Footer | null = null;
  const scaleWidth = 50;

  let dataURLInput = '';
  let gridURLInput = '';

  const footerUpdated = () => {
    myFooter = myFooter;
  };

  const datasetClicked = () => {
    if (dialogElement === null) return;
    // Show modal
    try {
      dialogElement.showModal();
    } catch (e) {
      console.error(e);
    }
  };

  const useMyEmbeddingClicked = () => {
    // Encode the urls as query string
    if (dataURLInput !== '' && gridURLInput !== '') {
      const dataURL = encodeURIComponent(dataURLInput);
      const gridURL = encodeURIComponent(gridURLInput);
      const targetURL = `./?dataURL=${dataURL}&gridURL=${gridURL}`;
      dialogElement?.close();
      window.location.href = targetURL;
    }
  };

  onMount(() => {
    mounted = true;
    // datasetClicked();
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
  <dialog id="dataset-dialog" bind:this="{dialogElement}">
    <div class="header">Choose an Embedding</div>

    <div class="row-block">
      <div class="dataset-list">
        <ul>
          <li>
            <a href="./?dataset=diffusiondb"
              >DiffusionDB (1.8M text + 1.8M images)</a
            >
          </li>
          <li>
            <a href="./?dataset=acl-abstracts"> ACL Abstracts (63k text) </a>
          </li>
          <li>
            <a href="./?dataset=imdb"> IMDB Reviews (25k text) </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="separator"></div>

    <div class="header">My Own Embedding</div>

    <div class="input-form">
      <div class="row">
        <span class="row-header">
          Data JSON URL <a
            href="https://github.com/poloclub/wizmap#use-my-own-embeddings"
            target="_blank">(what is this?)</a
          >
        </span>
        <input placeholder="https://xxx.ndjson" bind:value="{dataURLInput}" />
      </div>

      <div class="row">
        <span class="row-header">
          Grid JSON URL <a
            href="https://github.com/poloclub/wizmap#use-my-own-embeddings"
            target="_blank">(what is this?)</a
          >
        </span>
        <input placeholder="https://xxx.json" bind:value="{gridURLInput}" />
      </div>
    </div>

    <div class="button-block">
      <button class="close-button" on:click="{() => useMyEmbeddingClicked()}"
        >Create</button
      >

      <button
        class="close-button"
        on:click="{() => {
          dialogElement?.close();
        }}">Close</button
      >
    </div>
  </dialog>

  <div class="zoom-control">
    <button
      class="zoom-button zoom-button-reset"
      on:click="{() => {
        datasetClicked();
      }}"><div class="svg-icon">{@html iconFolder}</div></button
    >
  </div>

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

    <a href="https://arxiv.org/abs/2306.09328"
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

    <a href="https://youtu.be/8fJG87QVceQ"
      ><span class="item">
        <span class="svg-icon">{@html iconPlay}</span>
        Video
      </span></a
    >
    <div class="splitter"></div>

    <button
      on:click="{() => {
        datasetClicked();
      }}"><span class="item"> {myFooter?.embeddingName} </span></button
    >
    <div class="splitter"></div>

    <span class="count">
      <span class="total-count" class:hidden="{false}"
        >{myFooter ? myFooter.numPoints : '0'} Data Points
      </span>
      <span class="subset-count" class:hidden="{true}">0 Data Points</span>
    </span>
    <div class="splitter"></div>
    <div class="scale-legend">
      <span class="sclae-num"
        >{myFooter ? myFooter.scaleDataWidth : '0.0000'}</span
      >
      <div class="scale-line" style="{`width: ${scaleWidth}px`}"></div>
    </div>
  </div>
</div>
