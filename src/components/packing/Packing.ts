import d3 from '../../utils/d3-import';
import type { Size, Padding, Point } from '../../types/common-types';
import type {
  PhraseTreeData,
  PhraseTextInfo,
  PhraseTextLineInfo
} from '../../types/packing-types';
import { timeit, round, yieldToMain } from '../../utils/utils';

import { getLatoTextWidth } from '../../utils/text-width';
import type { Writable } from 'svelte/store';
import type { TooltipStoreValue } from '../../stores';
import { getTooltipStoreDefaultValue } from '../../stores';
import { config } from '../../config/config';

const DEBUG = config.debug;
const FONT_SIZE = 11;

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
      timeit('Draw circle packing', DEBUG);
      this.drawCirclePacking();
      timeit('Draw circle packing', DEBUG);
    });
  }

  /**
   * Load the data
   */
  initData = async () => {
    const jsonURL = `${import.meta.env.BASE_URL}data/phrases-tree.json`;
    const phraseData = (await d3.json(jsonURL)) as PhraseTreeData;

    const root = d3
      .hierarchy(phraseData, d => d.c)
      .sum(d => d.v)
      .sort((a, b) => b.data.v - a.data.v);

    this.pack = d3
      .pack<PhraseTreeData>()
      .padding(3)
      .size([this.svgSize.width, this.svgSize.height])(root);
  };

  /**
   * Draw the circle packing
   */
  drawCirclePacking = () => {
    if (this.pack === null) return;
    const content = this.svg.select('g.content');

    /**
     * Return true if the circle should not display its text
     * @param d Node data
     * @returns True if the circle should not display its text
     */
    const shouldHideText = (d: d3.HierarchyCircularNode<PhraseTreeData>) => {
      if (d.children !== undefined) return true;

      return d.data.textInfo
        ? Math.min(
            d.data.textInfo.infos[0].diagonal,
            d.data.textInfo.infos[1].diagonal
          ) >
            2 * d.r
        : true;
    };

    const enterFunc = (
      enter: d3.Selection<
        d3.EnterElement,
        d3.HierarchyCircularNode<PhraseTreeData>,
        d3.BaseType,
        unknown
      >
    ) => {
      // Draw the circle
      const group = enter
        .append('g')
        .attr('class', d => `circle-group circle-group-${d.depth}`)
        .attr('transform', d => `translate(${d.x - d.r}, ${d.y - d.r})`)
        .style('font-size', `${FONT_SIZE}px`);

      group
        .append('circle')
        .attr('class', 'phrase-circle')
        .attr('cx', d => d.r)
        .attr('cy', d => d.r)
        .attr('r', d => d.r);

      // Draw the text
      group
        .append('text')
        .attr('class', 'phrase-label')
        .classed('hidden', d => shouldHideText(d))
        .attr('transform', d => `translate(${d.r}, ${d.r})`)
        .each((d, i, g) => {
          if (d.data.textInfo === undefined) return;
          if (shouldHideText(d)) return;

          const element = d3.select(g[i]);

          // Prioritize fitting the text in one line
          if (d.data.textInfo.infos[0].diagonal < 2 * d.r) {
            // One line
            element
              .append('tspan')
              .attr('class', 'line-1')
              .attr('x', 0)
              .attr('y', 0)
              .text(d.data.textInfo.infos[0].lines[0]);
          } else {
            // Two lines
            element
              .append('tspan')
              .attr('class', 'line-1')
              .attr('x', 0)
              .attr('y', 0)
              .attr('dy', '-0.5em')
              .text(d.data.textInfo.infos[1].lines[0]);

            element
              .append('tspan')
              .attr('class', 'line-2')
              .attr('x', 0)
              .attr('y', 0)
              .attr('dy', '0.5em')
              .text(d.data.textInfo.infos[1].lines[1]!);
          }
        });

      return group;
    };

    // All children in topological order with textVisible set to false
    const nodes = this.pack.descendants().slice(1);
    for (const node of nodes) {
      node.data.textInfo = processName(node.data.n);
    }

    console.log(nodes);

    content.selectAll('g.circle-group').data(nodes).join(enterFunc);
  };
}

/**
 * Get the size info about a phrase text
 * @param name The phrase text
 * @returns Size info about this text
 */
const processName = (name: string) => {
  const words = name.split(' ');
  const lineInfo1: PhraseTextLineInfo = {
    width: getLatoTextWidth(name, FONT_SIZE),
    height: FONT_SIZE,
    diagonal: Math.sqrt(
      getLatoTextWidth(name, FONT_SIZE) ** 2 + FONT_SIZE ** 2
    ),
    lines: [name]
  };

  const lineInfo2: PhraseTextLineInfo = {
    width: 0,
    height: 0,
    diagonal: 0,
    lines: [name]
  };

  if (words.length == 1) {
    lineInfo2.width = getLatoTextWidth(name, FONT_SIZE);
    lineInfo2.height = FONT_SIZE;
  } else {
    // Split the name into two lines with the same number of words
    const line1 = words.slice(0, Math.floor(words.length / 2)).join(' ');
    const line2 = words.slice(Math.floor(words.length / 2)).join(' ');

    lineInfo2.lines = [line1, line2];
    lineInfo2.width = Math.max(
      getLatoTextWidth(line1, FONT_SIZE),
      getLatoTextWidth(line2, FONT_SIZE)
    );
    lineInfo2.height = FONT_SIZE * 1.8;
  }

  lineInfo2.diagonal = Math.sqrt(lineInfo2.width ** 2 + lineInfo2.height ** 2);

  const result: PhraseTextInfo = {
    visible: false,
    infos: [lineInfo1, lineInfo2]
  };

  return result;
};
