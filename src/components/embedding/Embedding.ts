import d3 from '../../utils/d3-import';
import type { PromptUMAPData, Size, Padding, PromptPoint } from '../my-types';

/**
 * Class for the Embedding view
 */

export class Embedding {
  svg: d3.Selection<HTMLElement, unknown, null, undefined>;
  svgSize: Size;
  svgPadding: Padding;
  xScale: d3.ScaleLinear<number, number, never>;
  yScale: d3.ScaleLinear<number, number, never>;

  component: HTMLElement;

  prompts: string[] = [];
  promptPoints: PromptPoint[] = [];

  randomUniform = d3.randomUniform.source(d3.randomLcg(0.1212))(0, 1);

  /**
   *
   * @param args Named parameters
   * @param args.component The component
   */
  constructor({ component }: { component: HTMLElement }) {
    this.component = component;

    // Initialize the SVG
    this.svg = d3.select(this.component).select('.embedding-svg');

    this.svgSize = { width: 0, height: 0 };
    const svgBBox = this.svg.node()?.getBoundingClientRect();
    if (svgBBox !== undefined) {
      this.svgSize.width = svgBBox.width;
      this.svgSize.height = svgBBox.height;
    }

    this.svgPadding = {
      top: 5,
      bottom: 5,
      left: 5,
      right: 5
    };
    this.xScale = d3.scaleLinear();
    this.yScale = d3.scaleLinear();

    // Initialize the data
    console.log(this.svgSize);
    this.initData().then(() => {
      this.drawScatter();
    });
  }

  /**
   * Load the UMAP data from json.
   */
  initData = async () => {
    const result = await d3.json<PromptUMAPData>('/data/umap-50k.json');
    if (result !== undefined) {
      for (let i = 0; i < result.xs.length; i++) {
        // Collect prompts
        this.prompts.push(result.prompts[i]);
        this.promptPoints.push({
          x: result.xs[i],
          y: result.ys[i],
          promptID: i,
          visible: true
        });
      }
    }
    console.log(this.promptPoints);

    // Initialize the data scales
    const xRange = d3.extent(this.promptPoints, d => d.x) as [number, number];
    const yRange = d3.extent(this.promptPoints, d => d.y) as [number, number];

    // Force the plot to be a square
    const xLength = xRange[1] - xRange[0];
    const yLength = yRange[1] - yRange[0];

    if (xLength < yLength) {
      xRange[0] -= (yLength - xLength) / 2;
      xRange[1] += (yLength - xLength) / 2;
    } else {
      yRange[0] -= (xLength - yLength) / 2;
      yRange[1] += (xLength - yLength) / 2;
    }

    this.xScale = d3
      .scaleLinear()
      .domain(xRange)
      .range([
        0,
        this.svgSize.width - this.svgPadding.left - this.svgPadding.right
      ]);
    this.yScale = d3
      .scaleLinear()
      .domain(yRange)
      .range([
        this.svgSize.height - this.svgPadding.top - this.svgPadding.bottom,
        0
      ]);

    // Randomly sample the points before drawing
    this.sampleVisiblePoints(5000);
  };

  /**
   * Randomly sample points to be visible
   * @param size Number of points to be visible
   */
  sampleVisiblePoints = (size: number) => {
    const targetSize = Math.min(size, this.promptPoints.length);
    const threshold = targetSize / this.promptPoints.length;

    // Change all points to invisible first
    this.promptPoints.forEach(d => {
      d.visible = false;
    });

    const samplePoints = (targetSize: number, sampledSize: number) => {
      for (const point of this.promptPoints) {
        if (!point.visible && this.randomUniform() <= threshold) {
          point.visible = true;
          sampledSize += 1;

          // Exit early if we have enough points
          if (sampledSize >= targetSize) break;
        }
      }
      return sampledSize;
    };

    // Repeat sampling until we have enough points sampled
    let sampledSize = 0;
    while (sampledSize < targetSize) {
      sampledSize = samplePoints(targetSize, sampledSize);
    }

    return sampledSize;
  };

  /**
   * Draw a scatter plot for the UMAP.
   */
  drawScatter = () => {
    const scatterGroup = this.svg
      .append('g')
      .attr(
        'transform',
        `translate(${this.svgPadding.left}, ${this.svgPadding.top})`
      );

    // Draw all points
    scatterGroup
      .selectAll('circle.prompt-point')
      .data(this.promptPoints)
      .join('circle')
      .attr('class', 'prompt-point')
      .attr('cx', d => this.xScale(d.x))
      .attr('cy', d => this.yScale(d.y))
      .attr('r', 1)
      .style('display', d => (d.visible ? 'unset' : 'none'));
  };
}
