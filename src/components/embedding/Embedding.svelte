<script lang="ts">
  import { Embedding } from './Embedding';
  import { onMount } from 'svelte';

  let component: HTMLElement | null = null;
  let mounted = false;
  let initialized = false;
  let embedding: Embedding | null = null;

  onMount(() => {
    mounted = true;
  });

  /**
   * Initialize the embedding view.
   */
  const initView = () => {
    initialized = true;

    if (component) {
      embedding = new Embedding({ component });
    }
  };

  $: mounted && component && initView();
</script>

<style lang="scss">
  @import './Embedding.scss';
</style>

<div class="embedding-wrapper" bind:this={component}>
  <div class="embedding">
    <canvas class="embedding-canvas" />
    <svg class="embedding-svg" />
  </div>
</div>
