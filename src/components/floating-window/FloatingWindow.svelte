<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import iconCloseCircle from '../../imgs/icon-close-circle.svg?raw';
  import type { FloatingWindowStoreValue } from '../../stores';
  import { FloatingWindow } from './FloatingWindow';

  // Props
  export let floatingWindowStore: Writable<FloatingWindowStoreValue>;

  // Component variables
  let component: HTMLElement | null = null;
  let mounted = false;

  // View variables
  let floatingWindow: FloatingWindow | null = null;
  let initialized = false;

  onMount(() => {
    mounted = true;
  });

  onDestroy(() => {
    floatingWindow?.floatingWindowStoreUnsubscriber();
  });

  const floatingWindowUpdated = () => {
    floatingWindow = floatingWindow;
  };

  const initView = () => {
    initialized = true;
    if (component) {
      floatingWindow = new FloatingWindow({
        component,
        floatingWindowUpdated,
        floatingWindowStore
      });
    }
  };

  $: mounted && component && !initialized && floatingWindowStore && initView();
</script>

<style lang="scss">
  @use './FloatingWindow.scss' as *;
</style>

<div
  class="floating-window"
  bind:this="{component}"
  class:hidden="{floatingWindow === null ||
    floatingWindow.floatingWindowStoreValue.point === null}"
>
  <div
    class="window-header"
    on:mousedown="{e => floatingWindow?.headerMousedownHandler(e)}"
    on:click="{e => floatingWindow?.cancelEvent(e)}"
    on:keydown="{() => {}}"
    on:keyup="{() => {}}"
    on:keypress="{() => {}}"
  >
    <div class="window-info" title="Window">
      <span class="window-name">
        Point {floatingWindow?.floatingWindowStoreValue.point?.id}
      </span>
    </div>

    <div class="control-buttons">
      <div
        class="control-close"
        title="Close"
        on:click="{e => floatingWindow?.closeClicked(e)}"
        on:keydown="{() => {}}"
        on:keyup="{() => {}}"
        on:keypress="{() => {}}"
        on:mousedown="{e => floatingWindow?.cancelEvent(e)}"
      >
        <div class="svg-icon">
          {@html iconCloseCircle}
        </div>
      </div>
    </div>
  </div>

  <div
    class="content"
    on:mousedown="{e => floatingWindow?.contentMousedownHandler(e)}"
  >
    {#if floatingWindow?.formattedSections && floatingWindow.formattedSections.length > 0}
      {#each floatingWindow.formattedSections as section}
        {#if section.type === 'image'}
          <div class="section">
            <div class="section-header">Image</div>
            <div class="section-content">
              <img src="{section.content}" alt="{section.header}" />
            </div>
          </div>
        {:else if section.type === 'link'}
          <div class="section">
            <div class="section-header">{section.header}</div>
            <div class="section-content">
              <a href="{section.content}" target="_blank">{section.content}</a>
            </div>
          </div>
        {:else}
          <div class="section">
            <div class="section-header">{section.header}</div>
            <div class="section-content">{section.content}</div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
