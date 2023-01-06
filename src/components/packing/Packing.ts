import d3 from '../../utils/d3-import';
import type { Size, Padding, Point } from '../../types/common-types';
import type { PhraseTreeData } from '../../types/packing-types';
import { timeit, round, yieldToMain } from '../../utils/utils';

import { getLatoTextWidth } from '../../utils/text-width';
import type { Writable } from 'svelte/store';
import type { TooltipStoreValue } from '../../stores';
import { getTooltipStoreDefaultValue } from '../../stores';
import { config } from '../../config/config';

const DEBUG = config.debug;

/**
 * Class for the circle packing view
 */

export class Packer {
  svg: d3.Selection<HTMLElement, unknown, null, undefined>;
  /** The size of the BBox of the SVG element */
  svgFullSize: Size;
  /** The size of the drawing space of the SVG element */
  svgSize: Size;
  svgPadding: Padding;

  xScale: d3.ScaleLinear<number, number, never>;
  yScale: d3.ScaleLinear<number, number, never>;
  component: HTMLElement;
  updatePacker: () => void;

  // Circle packing
  pack: d3.HierarchyCircularNode<PhraseTreeData> | null = null;

  // Stores
  tooltipStore: Writable<TooltipStoreValue>;
  tooltipStoreValue: TooltipStoreValue = getTooltipStoreDefaultValue();

  /**
   *
   * @param args Named parameters
   * @param args.component The component
   */
  constructor({
    component,
    tooltipStore,
    updatePacker
  }: {
    component: HTMLElement;
    tooltipStore: Writable<TooltipStoreValue>;
    updatePacker: () => void;
  }) {
    this.component = component;
    this.updatePacker = updatePacker;

    // Initialize the SVG
    this.svg = d3.select(this.component).select('.packing-svg');
    this.svgFullSize = { width: 0, height: 0 };
    const svgBBox = this.svg.node()?.getBoundingClientRect();
    if (svgBBox !== undefined) {
      this.svgFullSize.width = svgBBox.width;
      this.svgFullSize.height = svgBBox.height;
    }

    this.svgPadding = {
      top: 5,
      bottom: 5,
      left: 5,
      right: 5
    };
    this.svgSize = {
      width:
        this.svgFullSize.width - this.svgPadding.left - this.svgPadding.right,
      height:
        this.svgFullSize.width - this.svgPadding.top - this.svgPadding.bottom
    };

    // Initialize SVG layers
    this.svg
      .append('g')
      .attr('class', 'content')
      .attr(
        'transform',
        `translate(${this.svgPadding.left}, ${this.svgPadding.top})`
      );

    // Subscribe the store
    this.tooltipStore = tooltipStore;
    this.tooltipStore.subscribe(value => {
      this.tooltipStoreValue = value;
    });

    // d3.pack() uses [0, 1] ranges by default
    this.xScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([0, this.svgSize.width]);

    this.yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([this.svgSize.height, 0]);

    this.initData().then(() => {
      // Draw the circle packing after loading the data
      this.drawCirclePacking();
    });
  }

  /**
   * Load the data
   */
  initData = async () => {
    const jsonURL = `${import.meta.env.BASE_URL}data/phrases-tree.json`;
    const phraseData = (await d3.json(jsonURL)) as PhraseTreeData;
    console.log(phraseData);

    const root = d3
      .hierarchy(phraseData, d => d.c)
      .sum(d => d.v)
      .sort((a, b) => b.value! - a.value!);

    this.pack = d3
      .pack<PhraseTreeData>()
      .padding(3)
      .size([this.svgSize.width, this.svgSize.height])(root);
  };

  drawCirclePacking = () => {
    if (this.pack === null) return;
    const content = this.svg.select('g.content');

    const enterFunc = (
      enter: d3.Selection<
        d3.EnterElement,
        d3.HierarchyCircularNode<PhraseTreeData>,
        d3.BaseType,
        unknown
      >
    ) => {
      const group = enter
        .append('g')
        .attr('class', d => `circle-group circle-group-${d.depth}`)
        .attr('transform', d => `translate(${d.x - d.r}, ${d.y - d.r})`);

      group
        .append('circle')
        .attr('cx', d => d.r)
        .attr('cy', d => d.r)
        .attr('r', d => d.r);

      return group;
    };

    // All children in topological order
    const nodes = this.pack.descendants().slice(1);

    console.log(nodes.length);

    content.selectAll('g.circle-group').data(nodes).join(enterFunc);
  };
}
