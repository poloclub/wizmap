import { tick } from 'svelte';
import type { Unsubscriber, Writable } from 'svelte/store';
import {
  getFloatingWindowStoreDefaultValue,
  type FloatingWindowStoreValue
} from '../../stores';
import type {
  DragRegion,
  Padding,
  Point,
  Position
} from '../../types/common-types';
import type {
  GridData,
  HighlightedPromptPoint
} from '../../types/embedding-types';
import d3 from '../../utils/d3-import';
import { joinPath } from '../../utils/utils';

interface FormattedSection {
  type: 'text' | 'image' | 'link';
  header: string;
  content: string;
}

export class FloatingWindow {
  floatingWindowUpdated: () => void;

  svg: d3.Selection<d3.BaseType, unknown, null, undefined>;
  padding: Padding;
  width: number;
  height: number;
  dragRegion: DragRegion;

  floatingWindowStore: Writable<FloatingWindowStoreValue>;
  floatingWindowStoreValue: FloatingWindowStoreValue;
  floatingWindowStoreUnsubscriber: Unsubscriber;

  // DOM element
  node: HTMLElement;

  // Content
  formattedSections: FormattedSection[] = [];

  constructor({
    component,
    floatingWindowStore,
    floatingWindowUpdated,
    width = 200,
    height = 200
  }: {
    component: HTMLElement;
    floatingWindowStore: Writable<FloatingWindowStoreValue>;
    floatingWindowUpdated: () => void;
    width?: number;
    height?: number;
  }) {
    this.floatingWindowUpdated = floatingWindowUpdated;
    this.width = width;
    this.height = height;
    this.node = component;

    // Figure out the dragging region for the window
    const page = this.node.parentNode?.parentNode as HTMLElement;
    const pageBBox = page.getBoundingClientRect();
    this.dragRegion = {
      minLeft: 0,
      maxLeft: pageBBox.width - this.width,
      minTop: 0,
      maxTop: pageBBox.height - this.height - 50
    };

    // Init the stores
    this.floatingWindowStore = floatingWindowStore;
    this.floatingWindowStoreValue = getFloatingWindowStoreDefaultValue();
    this.floatingWindowStoreUnsubscriber = this.floatingWindowStore.subscribe(
      value => {
        this.floatingWindowStoreValue = value;
        // Format the content for display
        if (
          this.floatingWindowStoreValue.point &&
          this.floatingWindowStoreValue.gridData
        ) {
          this.formattedSections = this.formatContent(
            this.floatingWindowStoreValue.point,
            this.floatingWindowStoreValue.gridData
          );
        } else {
          this.formattedSections = [];
        }
        this.floatingWindowUpdated();
      }
    );

    // Initialize the svg
    this.svg = d3
      .select(component)
      .select('svg.tree-svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewbox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'none');

    // Configure the view size
    this.padding = {
      top: 20,
      bottom: 20,
      left: 0,
      right: 0
    };

    this.width = width - this.padding.left - this.padding.right;
    this.height = height - this.padding.top - this.padding.bottom;

    // Show the window
    this.floatingWindowUpdated();
  }

  formatContent(
    point: HighlightedPromptPoint,
    gridData: GridData
  ): FormattedSection[] {
    const sections: FormattedSection[] = [];
    // Case 1: If the point is an image, we show it in one image section
    if (
      gridData.image !== undefined &&
      gridData.image.imageGroup == point.groupID
    ) {
      const imageURL = joinPath(gridData.image.imageURLPrefix, point.prompt);
      sections.push({
        type: 'image',
        header: 'Image',
        content: imageURL
      });
      return sections;
    }

    // Case 2: If the point is a json object, we show it in multiple sections
    if (gridData.jsonPoint !== undefined) {
      if (
        gridData.jsonPoint.groupLabels == undefined ||
        (point.groupID !== undefined &&
          gridData.jsonPoint.groupLabels.includes(point.groupID))
      ) {
        const jsonData = JSON.parse(point.prompt) as Record<string, string>;
        const textKey = gridData.jsonPoint.textKey;

        // If the image key is set, we show the image
        const imageKey =
          gridData.jsonPoint.largeImageKey || gridData.jsonPoint.imageKey;
        const imageURLPrefix =
          gridData.jsonPoint.largeImageURLPrefix ||
          gridData.jsonPoint.imageURLPrefix;
        if (imageKey && imageURLPrefix) {
          const image = joinPath(imageURLPrefix, jsonData[imageKey]);
          sections.push({
            type: 'image',
            header: 'Image',
            content: image
          });
        }

        // Add text
        sections.push({
          type: 'text',
          header: 'Text',
          content: jsonData[textKey]
        });

        // Add all other json fields
        const usedKeys = new Set([
          textKey,
          gridData.jsonPoint.imageKey,
          gridData.jsonPoint.largeImageKey
        ]);
        for (const key in jsonData) {
          if (!usedKeys.has(key)) {
            sections.push({
              type: gridData.jsonPoint.linkFieldKeys?.includes(key)
                ? 'link'
                : 'text',
              header: key,
              content: jsonData[key]
            });
          }
        }
      }
      return sections;
    }

    // Case 3: Everything else, we show it in one text section
    sections.push({
      type: 'text',
      header: 'Text',
      content: point.prompt
    });
    return sections;
  }

  /**
   * Handler for close icon clicking event
   * @param e Mouse event
   */
  closeClicked = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.floatingWindowStoreValue.point = null;
    this.floatingWindowStore.set(this.floatingWindowStoreValue);
    this.floatingWindowUpdated();
  };

  /**
   * Cancel the event
   * @param e Mouse event
   */
  cancelEvent = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * Handler for mousedown event on the window header
   * @param e Mouse event
   */
  headerMousedownHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Register the offset from the initial click position to the div location
    const lastMousePoint: Point = {
      x: e.pageX,
      y: e.pageY
    };

    // Handling dragging mouse move
    const mousemoveHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      let newX = this.node.offsetLeft + e.pageX - lastMousePoint.x;
      let newY = this.node.offsetTop + e.pageY - lastMousePoint.y;

      // Clamp the window inside the dragging region
      newX = Math.max(this.dragRegion.minLeft, newX);
      newX = Math.min(this.dragRegion.maxLeft, newX);
      newY = Math.max(this.dragRegion.minTop, newY);
      newY = Math.min(this.dragRegion.maxTop, newY);

      lastMousePoint.x = e.pageX;
      lastMousePoint.y = e.pageY;

      this.node.style.left = `${newX}px`;
      this.node.style.top = `${newY}px`;
    };

    // Cancel the dragging when mouse is up
    const mouseupHandler = () => {
      document.removeEventListener('mousemove', mousemoveHandler, true);
      document.removeEventListener('mouseup', mouseupHandler, true);
      document.body.style.cursor = 'default';
    };

    // Bind the mouse event listener to the document so we can track the
    // movement if outside the header region
    document.addEventListener('mousemove', mousemoveHandler, true);
    document.addEventListener('mouseup', mouseupHandler, true);
    document.body.style.cursor = 'move';
  };

  /**
   * Handler for mousedown event on the content element
   * @param e Mouse event
   */
  contentMousedownHandler = (e: MouseEvent) => {};
}
