import d3 from '../../utils/d3-import';
import type {
  PromptUMAPData,
  Size,
  Padding,
  PromptPoint,
  GridData,
  QuadtreeNode,
  LevelTileDataItem,
  UMAPPointStreamData,
  LevelTileMap
} from '../my-types';
import {
  downloadJSON,
  splitStreamTransform,
  parseJSONTransform,
  timeit
} from '../../utils/utils';

const DATA_SIZE = '60k';
const DEBUG = true;

/**
 * Class for the Embedding view
 */

export class Embedding {
  svg: d3.Selection<HTMLElement, unknown, null, undefined>;
  /** The size of the BBox of the SVG element */
  svgFullSize: Size;
  /** The size of the drawing space of the SVG element */
  svgSize: Size;
  svgPadding: Padding;

  zoom: d3.ZoomBehavior<HTMLElement, unknown> | null = null;
  // initialZoom

  xScale: d3.ScaleLinear<number, number, never>;
  yScale: d3.ScaleLinear<number, number, never>;
  component: HTMLElement;

  // Data
  prompts: string[] = [];
  promptPoints: PromptPoint[] = [];
  gridData: GridData;
  tileData: LevelTileMap | null = null;

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

    this.xScale = d3.scaleLinear();
    this.yScale = d3.scaleLinear();

    // Initialize the data
    this.gridData = {
      grid: [[]],
      xRange: [],
      yRange: []
    };

    timeit('Init data', DEBUG);
    this.initData().then(() => {
      timeit('Init data', DEBUG);

      timeit('Draw UMAP', DEBUG);
      this.drawUMAP();
      timeit('Draw UMAP', DEBUG);
    });
  }

  /**
   * Load the UMAP data from json.
   */
  initData = async () => {
    const result = await d3.json<PromptUMAPData>(
      `/data/umap-${DATA_SIZE}.json`
    );
    if (result !== undefined) {
      for (let i = 0; i < result.xs.length; i++) {
        // Collect prompts
        this.prompts.push(result.prompts[i]);
        this.promptPoints.push({
          x: result.xs[i],
          y: result.ys[i],
          id: i,
          visible: true
        });
      }
    }
    console.log(this.promptPoints);

    // Read the data point through streaming
    fetch(`/data/umap-${DATA_SIZE}.ndjson`).then(async response => {
      const reader = response?.body
        ?.pipeThrough(new TextDecoderStream())
        ?.pipeThrough(splitStreamTransform('\n'))
        ?.pipeThrough(parseJSONTransform())
        ?.getReader();

      while (true && reader !== undefined) {
        const result = await reader.read();
        const point = result.value as UMAPPointStreamData;
        const done = result.done;

        if (done) {
          console.log('Finished streaming');
          break;
        } else {
          this.processPointStream(point);
        }
      }
    });

    // Initialize the data scales
    const xRange = d3.extent(this.promptPoints, d => d.x) as [number, number];
    const yRange = d3.extent(this.promptPoints, d => d.y) as [number, number];

    // Force the plot to be a square
    let xLength = xRange[1] - xRange[0];
    let yLength = yRange[1] - yRange[0];

    if (xLength < yLength) {
      // Leave some padding
      yRange[0] -= yLength / 50;
      yRange[1] += yLength / 50;
      yLength = yRange[1] - yRange[0];

      xRange[0] -= (yLength - xLength) / 2;
      xRange[1] += (yLength - xLength) / 2;
    } else {
      // Leave some padding
      xRange[0] -= xLength / 50;
      xRange[1] += xLength / 50;
      xLength = xRange[1] - xRange[0];

      yRange[0] -= (xLength - yLength) / 2;
      yRange[1] += (xLength - yLength) / 2;
    }

    this.xScale = d3
      .scaleLinear()
      .domain(xRange)
      .range([0, this.svgSize.width]);
    this.yScale = d3
      .scaleLinear()
      .domain(yRange)
      .range([this.svgSize.height, 0]);

    // Randomly sample the points before drawing
    this.sampleVisiblePoints(60000);

    // Read the grid data for contour background
    const gridData = await d3.json<GridData>('/data/umap-60k-grid.json');
    if (gridData) {
      this.gridData = gridData;
    }

    // Read the tile data for the topic map
    const tileData = await d3.json<LevelTileMap>(
      '/data/umap-60k-level-topics.json'
    );
    if (tileData) {
      this.tileData = tileData;
    }
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
   * Visualize the UMAP using a contour in the background and a scatter plot in
   * the foreground.
   */
  drawUMAP = () => {
    const umapGroup = this.svg
      .append('g')
      .attr('class', 'umap-group')
      .attr(
        'transform',
        `translate(${this.svgPadding.left}, ${this.svgPadding.top})`
      );

    const contourGroup = umapGroup.append('g').attr('class', 'contour-group');
    const quadRectGroup = umapGroup.append('g').attr('class', 'quad-group');
    const tileGroup = umapGroup.append('g').attr('class', 'tile-group');
    const scatterGroup = umapGroup.append('g').attr('class', 'scatter-group');

    // Register zoom
    this.zoom = d3
      .zoom<HTMLElement, unknown>()
      .extent([
        [0, 0],
        [this.svgSize.width, this.svgSize.height]
      ])
      .scaleExtent([1, 8])
      .on('zoom', (g: d3.D3ZoomEvent<HTMLElement, unknown>) => this.zoomed(g));
    this.svg.call(this.zoom).on('dblclick.zoom', null);

    timeit('Drawing contour', DEBUG);
    this.drawContour(contourGroup);
    timeit('Drawing contour', DEBUG);

    // this.drawScatter(scatterGroup);
    // this.drawQuadtree(quadRectGroup);
    // this.drawTopicTiles(tileGroup);
  };

  drawTopicTiles = (
    tileGroup: d3.Selection<SVGGElement, unknown, null, undefined>
  ) => {
    // Color each rectangle based on their level
    const levelColors = window.structuredClone(d3.schemePastel1) as string[];
    levelColors.reverse();

    const curData = this.tileData!['6'];
    console.log(curData);

    // Draw the rectangles
    tileGroup
      .selectAll('.tile-rect')
      .data(curData)
      .join('rect')
      .attr('class', 'tile-rect')
      .attr('x', d => this.xScale(d.p[0]))
      .attr('y', d => this.yScale(d.p[3]))
      .attr('width', d => this.yScale(d.p[1]) - this.yScale(d.p[3]))
      .attr('height', d => this.xScale(d.p[2]) - this.xScale(d.p[0]))
      .style('fill', levelColors[0])
      .style('stroke', 'var(--md-gray-400)')
      .style('stroke-width', 0.4)
      .style('opacity', 0.5);
  };

  /**
   * Initialize a quadtree
   */
  drawQuadtree = (
    rectGroup: d3.Selection<SVGGElement, unknown, null, undefined>
  ) => {
    const tree = d3
      .quadtree<PromptPoint>()
      .x(d => d.x)
      .y(d => d.y)
      .extent([
        [this.xScale.domain()[0], this.yScale.domain()[0]],
        [this.xScale.domain()[1], this.yScale.domain()[1]]
      ])
      .addAll(this.promptPoints);

    // Collapse the quadtree into an array of rectangles.
    const nodes: QuadtreeNode[] = [];
    tree.visit((cur_node, x0, y0, x1, y1) => {
      if (cur_node.length === undefined) {
        const curNode = {
          x0,
          x1,
          y0,
          y1
        };
        nodes.push(curNode);
      }
    });
    console.log(nodes);

    // Draw the rectangles
    rectGroup
      .selectAll('.quadtree-node')
      .data(nodes)
      .join('rect')
      .attr('class', 'quadtree-node')
      .attr('x', d => this.xScale(d.x0))
      .attr('y', d => this.yScale(d.y1))
      .attr('width', d => this.yScale(d.y0) - this.yScale(d.y1))
      .attr('height', d => this.xScale(d.x1) - this.xScale(d.x0))
      .style('fill', 'none')
      .style('stroke', 'gray')
      .style('stroke-width', 0.4)
      .style('opacity', 0.9);

    // downloadJSON(tree);
  };

  /**
   * Draw a scatter plot for the UMAP.
   */
  drawScatter = (
    scatterGroup: d3.Selection<SVGGElement, unknown, null, undefined>
  ) => {
    // Draw all points
    scatterGroup
      .selectAll('circle.prompt-point')
      .data(this.promptPoints)
      .join('circle')
      .attr('class', 'prompt-point')
      .attr('cx', d => this.xScale(d.x))
      .attr('cy', d => this.yScale(d.y))
      .attr('r', 1)
      .attr('title', d => this.prompts[d.id])
      .style('display', d => (d.visible ? 'unset' : 'none'));
  };

  /**
   * Draw the KDE contour in the background.
   */
  drawContour = (
    contourGroup: d3.Selection<SVGGElement, unknown, null, undefined>
  ) => {
    contourGroup
      .append('circle')
      .attr('cx', 200)
      .attr('cy', 200)
      .attr('r', 100);

    const gridData1D: number[] = [];
    for (const row of this.gridData.grid) {
      for (const item of row) {
        gridData1D.push(item);
      }
    }

    // Linear interpolate the levels to determine the thresholds
    const levels = 12;
    const thresholds: number[] = [];
    const minValue = Math.min(...gridData1D);
    const maxValue = Math.max(...gridData1D);
    const step = (maxValue - minValue) / levels;
    for (let i = 0; i < levels; i++) {
      thresholds.push(minValue + step * i);
    }

    let contours = d3
      .contours()
      .thresholds(thresholds)
      .size([this.gridData.grid.length, this.gridData.grid[0].length])(
      gridData1D
    );

    // Convert the scale of the generated paths
    const contourXScale = d3
      .scaleLinear()
      .domain([0, this.gridData.grid.length])
      .range(this.gridData.xRange);

    const contourYScale = d3
      .scaleLinear()
      .domain([0, this.gridData.grid[0].length])
      .range(this.gridData.yRange);

    contours = contours.map(item => {
      item.coordinates = item.coordinates.map(coordinates => {
        return coordinates.map(positions => {
          return positions.map(point => {
            return [
              this.xScale(contourXScale(point[0])),
              this.yScale(contourYScale(point[1]))
            ];
          });
        });
      });
      return item;
    });

    // Create a new blue interpolator based on d3.interpolateBlues
    // (starting from white here)
    const blues = [
      '#ffffff',
      '#deebf7',
      '#c6dbef',
      '#9ecae1',
      '#6baed6',
      '#4292c6',
      '#2171b5',
      '#08519c',
      '#08306b'
    ];
    const blueScale = d3.interpolateRgbBasis(blues);
    const colorScale = d3.scaleSequential(
      d3.extent(thresholds) as number[],
      d => blueScale(d / 1.3)
    );

    // Draw the contours
    contourGroup
      .selectAll('path')
      .data(contours)
      .join('path')
      .attr('fill', d => colorScale(d.value))
      .attr('d', d3.geoPath());

    // Zoom in to focus on the second level of the contour
    // The first level is at 0
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;

    if (contours.length > 1) {
      for (const coord of contours[1].coordinates) {
        for (const coordPoints of coord) {
          for (const point of coordPoints) {
            if (point[0] < x0) x0 = point[0];
            if (point[1] < y0) y0 = point[1];
            if (point[0] > x1) x1 = point[0];
            if (point[1] > y1) y1 = point[1];
          }
        }
      }
    }

    const k = Math.min(
      this.svgFullSize.width / (x1 - x0),
      this.svgFullSize.height / (y1 - y0)
    );

    this.svg
      .transition()
      .duration(300)
      .call(selection =>
        this.zoom?.scaleTo(selection, k, [
          this.svgSize.width / 2,
          this.svgSize.height / 2
        ])
      );

    // Double click to reset zoom to the initial viewpoint
    this.svg.on('dblclick', () => {
      this.svg
        .transition()
        .duration(700)
        .call(selection => {
          this.zoom?.transform(
            selection,
            d3.zoomIdentity
              .translate(this.svgSize.width / 2, this.svgSize.height / 2)
              .scale(k)
              .translate(-this.svgSize.width / 2, -this.svgSize.height / 2)
          );
        });
    });

    return contours;
  };

  zoomed = (e: d3.D3ZoomEvent<HTMLElement, unknown>) => {
    const contourGroup = this.svg.select('.contour-group');
    const transform = e.transform;
    contourGroup.attr('transform', `${transform.toString()}`);
  };

  /**
   * Process the umap point reading stream
   * @param point Point (x, y, prompt)
   */
  processPointStream = (point: UMAPPointStreamData) => {
    // pass
  };
}
