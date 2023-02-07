<script lang="ts">
  // import DiffusiondbVis from './src/components/diffusiondbvis/DiffusiondbVis.svelte';
  import MapView from './src/components/mapview/MapView.svelte';
</script>

<style></style>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Lato&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="stand-alone-page">
  <!-- <DiffusiondbVis /> -->
  <MapView />
</div>
