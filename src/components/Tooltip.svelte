<script lang="ts">
  import d3 from '../utils/d3-import';
  import { tick } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { TooltipStoreValue } from '../stores';
  import { getTooltipStoreDefaultValue } from '../stores';

  export let tooltipStore: Writable<TooltipStoreValue> | null = null;

  const V_GAP = 10;

  let tooltipConfig = getTooltipStoreDefaultValue();
  let style = '';
  let tooltip: HTMLElement | null = null;
  let initialized = false;
  let opacity = 0;
  let left = 0;
  let top = 0;

  const updateStyle = () => {
    if (tooltipConfig.width === 0) {
      style = `left: ${left}px; top: ${top}px;
        max-width: ${tooltipConfig.maxWidth}px;
        font-size: ${tooltipConfig.fontSize}px; opacity: ${opacity}`;
    } else {
      style = `left: ${left}px; top: ${top}px;
        width: ${tooltipConfig.width}px; max-width: ${tooltipConfig.maxWidth}px;
        font-size: ${tooltipConfig.fontSize}px; opacity: ${opacity}`;
    }
  };

  const initView = () => {
    if (tooltipStore !== null && tooltip !== null) {
      initialized = true;

      tooltipStore.subscribe(value => {
        if (value === null) {
          return;
        }

        if (value.show) {
          if (value.html === '') {
            value.html = ' ';
          }
          opacity = 1;
          left = value.x;
          top = value.y;
          tooltipConfig = value;
          tooltipConfig.width = 0;

          // Reposition the tooltip based on its height and width
          tick().then(() => {
            const tooltipBBox = tooltip?.getBoundingClientRect();
            if (tooltipBBox) {
              // Check if the element overflows the page (both left and right)
              // If so, we need to fix its width and try to position it again
              // to set its height
              if (
                left + tooltipBBox.width >= window.innerWidth - 2 ||
                left - tooltipBBox.width <= 2
              ) {
                tooltipConfig.width = Math.min(
                  2 * (window.innerWidth - left),
                  2 * left,
                  tooltipConfig.maxWidth
                );
                left -= tooltipConfig.width / 2;
                updateStyle();

                tick().then(() => {
                  const tooltipBBox = tooltip?.getBoundingClientRect();
                  if (tooltipBBox) {
                    if (tooltipConfig.orientation === 'n') {
                      top += tooltipBBox.height;
                      top += V_GAP;
                    } else {
                      top -= tooltipBBox.height;
                      top -= V_GAP;
                    }

                    opacity = 1;
                    updateStyle();
                  }
                });
              } else {
                tooltipConfig.width = 0;
                left -= tooltipBBox.width / 2;

                if (tooltipConfig.orientation === 'n') {
                  top += tooltipBBox.height;
                  top += V_GAP;
                } else {
                  top -= tooltipBBox.height;
                  top -= V_GAP;
                }

                opacity = 1;
                updateStyle();
              }
            }
          });
        } else {
          opacity = 0;
          tooltipConfig = value;
        }
        updateStyle();
      });
    }
  };

  $: tooltipStore && !initialized && tooltip && initView();
</script>

<style lang="scss">
  @import './define.scss';

  .tooltip {
    position: absolute;
    color: hsl(0, 0%, 95%);
    background-color: black;
    box-shadow: 0 0 1px hsla(0, 0%, 0%, 0.6), 0 0 3px hsla(0, 0%, 0%, 0.05);
    padding: 2px 6px 4px 6px;
    border-radius: 4px;
    opacity: 1;
    z-index: 20;
    visibility: visible;
    transition: opacity 150ms, visibility 150ms;
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    pointer-events: none;
    text-align: center;
    overflow-x: visible;

    &.hidden {
      visibility: hidden;
    }

    :global(.translate) {
      display: flex;
      flex-direction: row;
      align-items: center;
    }

    :global(.arrow) {
      position: relative;
      width: 20px;
      flex-shrink: 0;
      margin: auto 8px;
      height: 0;
      border-bottom: 1px solid $gray-600;

      &::after {
        content: '';
        width: 0;
        height: 0;
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        border-left: 6px solid $gray-600;
        position: absolute;
        right: -2px;
        top: -4.5px;
      }
    }

    :global(.tb) {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  }

  .arrow-up {
    position: absolute;
    top: -7px;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-bottom: 10px solid white;
  }

  .arrow-down {
    position: absolute;
    bottom: -17px;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-bottom: 10px solid transparent;
    border-top: 10px solid black;
  }
</style>

<div
  class="tooltip"
  {style}
  bind:this={tooltip}
  class:hidden={!tooltipConfig.show}
>
  <div
    class:arrow-up={tooltipConfig.orientation === 'n'}
    class:arrow-down={tooltipConfig.orientation === 's'}
  />
  {@html tooltipConfig.html}
</div>
