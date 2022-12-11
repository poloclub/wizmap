<script lang="ts">
  import Embedding from '../embedding/Embedding.svelte';
  let component = null;
</script>

<style lang="scss">
  @import './DiffusiondbVis.scss';
</style>

<div class="diffusiondbvis-page">
  <div class="main-app" bind:this={component}>
    <div calss="view-container">
      <Embedding />
    </div>
  </div>
</div>
