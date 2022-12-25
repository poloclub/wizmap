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
  timeit,
  rgbToHex
} from '../../utils/utils';
import { config } from '../../config/config';

const DATA_SIZE = '60k';
const DEBUG = true;
const SCATTER_DOT_RADIUS = 1;

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

  topSvg: d3.Selection<HTMLElement, unknown, null, undefined>;

  pointCanvas: d3.Selection<HTMLElement, unknown, null, undefined>;
  pointCtx: CanvasRenderingContext2D;

  pointBackCanvas: d3.Selection<HTMLElement, unknown, null, undefined>;
  pointBackCtx: CanvasRenderingContext2D;
  colorPointMap: Map<string, PromptPoint> = new Map<string, PromptPoint>();

  zoom: d3.ZoomBehavior<HTMLElement, unknown> | null = null;
  curZoomTransform: d3.ZoomTransform | null = null;

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

    // Initialize the SVG groups
    this.initSVGGroups();

    // Initialize the top svg element
    this.topSvg = this.initTopSvg();

    // Initialize the canvas
    this.pointCanvas = d3
      .select(this.component)
      .select<HTMLElement>('.embedding-canvas')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height);
    this.pointCtx = (this.pointCanvas.node()! as HTMLCanvasElement).getContext(
      '2d'
    )!;

    // Initialize the background canvas (for mouseover)
    this.pointBackCanvas = d3
      .select(this.component)
      .select<HTMLElement>('.embedding-canvas-back')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height);
    this.pointBackCtx = (
      this.pointBackCanvas.node()! as HTMLCanvasElement
    ).getContext('2d')!;
    this.pointBackCtx.imageSmoothingEnabled = false;

    // Register zoom
    this.zoom = d3
      .zoom<HTMLElement, unknown>()
      .extent([
        [0, 0],
        [this.svgSize.width, this.svgSize.height]
      ])
      .scaleExtent([1, 8])
      .on('zoom', (g: d3.D3ZoomEvent<HTMLElement, unknown>) => this.zoomed(g));

    this.topSvg.call(this.zoom).on('dblclick.zoom', null);

    // Initialize the data
    this.gridData = {
      grid: [[]],
      xRange: [],
      yRange: []
    };

    timeit('Init data', DEBUG);
    this.initData().then(() => {
      timeit('Init data', DEBUG);
    });
  }

  /**
   * Initialize the top SVG element
   * @returns Top SVG selection
   */
  initTopSvg = () => {
    const topSvg = d3
      .select(this.component)
      .select<HTMLElement>('.top-svg')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height)
      .on('mousemove', e => this.mousemoveHandler(e as MouseEvent));

    const topGroup = topSvg.append('g').attr('class', 'top-group');

    topGroup
      .append('rect')
      .attr('class', 'mouse-track-rect')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height);

    topGroup.append('g').attr('class', 'top-content');
    return topSvg;
  };

  /**
   * Load the UMAP data from json.
   */
  initData = async () => {
    // Read point data in bulk
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
    this.sampleVisiblePoints(6000);
    // this.drawScatterCanvas();
    // this.drawScatter();

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

    // Read the grid data for contour background
    d3.json<GridData>('/data/umap-60k-grid.json').then(gridData => {
      if (gridData) this.gridData = gridData;
      this.drawContour();
    });

    // Read the tile data for the topic map
    // d3.json<LevelTileMap>('/data/umap-60k-level-topics.json').then(tileData => {
    //   if (tileData) {
    //     this.tileData = tileData;
    //     const tileGroup = this.svg.select<SVGGElement>('.tile-group');
    //     // this.drawTopicTiles(tileGroup);
    //   }
    // });
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
   * Initialize the groups to draw elements in the SVG.
   */
  initSVGGroups = () => {
    const umapGroup = this.svg
      .append('g')
      .attr('class', 'umap-group')
      .attr(
        'transform',
        `translate(${this.svgPadding.left}, ${this.svgPadding.top})`
      );

    umapGroup.append('g').attr('class', 'contour-group');
    umapGroup.append('g').attr('class', 'quad-group');
    umapGroup.append('g').attr('class', 'tile-group');
    umapGroup.append('g').attr('class', 'scatter-group');
  };

  drawTopicTiles = () => {
    const tileGroup = this.svg.select('g.tile-group');

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
  drawQuadtree = () => {
    const rectGroup = this.svg.select('g.quad-group');
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
  drawScatter = () => {
    const scatterGroup = this.svg.select('g.scatter-group');
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
   * Draw a scatter plot for the UMAP on a canvas.
   */
  drawScatterCanvas = () => {
    for (const point of this.promptPoints) {
      if (point.visible) {
        this.pointCtx.beginPath();
        const x = this.xScale(point.x);
        const y = this.yScale(point.y);
        this.pointCtx.moveTo(x, y);
        this.pointCtx.arc(x, y, SCATTER_DOT_RADIUS, 0, 2 * Math.PI);

        // Fill the data point circle
        const color = d3.color(config.colors['pink-300'])!;
        color.opacity = 0.5;
        this.pointCtx.fillStyle = color.toString();
        this.pointCtx.fill();
        this.pointCtx.closePath();
      }
    }
  };

  /**
   * Get a unique color in hex.
   */
  getNextUniqueColor = () => {
    if (this.colorPointMap.size >= 256 * 256 * 256) {
      console.error('Unique color overflow.');
      return '#fffff';
    }

    const rng = d3.randomInt(0, 256);
    let hex = rgbToHex(rng(), rng(), rng());
    while (this.colorPointMap.has(hex) || hex === '#000000') {
      hex = rgbToHex(rng(), rng(), rng());
    }
    return hex;
  };

  /**
   * Draw a hidden scatter plot for the UMAP on a background canvas. We give
   * each dot a unique color for quicker mouseover detection.
   */
  drawScatterBackCanvas = () => {
    this.colorPointMap.clear();

    for (const point of this.promptPoints) {
      if (point.visible) {
        this.pointBackCtx.beginPath();
        const x = this.xScale(point.x);
        const y = this.yScale(point.y);
        this.pointBackCtx.moveTo(x, y);

        // Trick: here we draw a slightly larger circle when user zooms out the
        // viewpoint, so that the pixel coverage is higher (smoother/better
        // mouseover picking)
        const r = Math.max(
          1,
          3.5 - (this.curZoomTransform?.k ? this.curZoomTransform?.k : 2)
        );
        this.pointBackCtx.arc(x, y, r, 0, 2 * Math.PI);

        // Fill the data point with a unique color
        const color = this.getNextUniqueColor();
        this.colorPointMap.set(color, point);
        this.pointBackCtx.fillStyle = color;
        this.pointBackCtx.fill();
        this.pointBackCtx.closePath();
      }
    }
  };

  /**
   * Draw the KDE contour in the background.
   */
  drawContour = () => {
    const contourGroup = this.svg.select<SVGGElement>('.contour-group');
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

    this.topSvg
      .transition()
      .duration(300)
      .call(selection =>
        this.zoom?.scaleTo(selection, k, [
          this.svgSize.width / 2,
          this.svgSize.height / 2
        ])
      );

    // Double click to reset zoom to the initial viewpoint
    this.topSvg.on('dblclick', () => {
      this.topSvg
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
    const transform = e.transform;
    this.curZoomTransform = transform;

    // Transform the SVG elements
    this.svg.select('.umap-group').attr('transform', `${transform.toString()}`);

    // Transform the top SVG elements
    this.topSvg
      .select('.top-group')
      .attr('transform', `${transform.toString()}`);

    // Transform the point canvas elements
    this.pointCtx.save();
    this.pointCtx.clearRect(
      0,
      0,
      this.svgFullSize.width,
      this.svgFullSize.height
    );
    this.pointCtx.translate(transform.x, transform.y);
    this.pointCtx.scale(transform.k, transform.k);
    this.drawScatterCanvas();
    this.pointCtx.restore();

    // Transform the background canvas elements
    this.pointBackCtx.save();
    this.pointBackCtx.clearRect(
      0,
      0,
      this.svgFullSize.width,
      this.svgFullSize.height
    );
    this.pointBackCtx.translate(transform.x, transform.y);
    this.pointBackCtx.scale(transform.k, transform.k);
    this.drawScatterBackCanvas();
    this.pointBackCtx.restore();
  };

  /**
   * Process the umap point reading stream
   * @param point Point (x, y, prompt)
   */
  processPointStream = (point: UMAPPointStreamData) => {
    // pass
  };

  /**
   * Highlight the point where the user hovers over
   * @param point The point that user hovers over
   */
  highlightPoint = (point: PromptPoint | undefined) => {
    // Draw the point on the top svg
    const topContent = this.topSvg.select('g.top-content');
    const oldHighlightPoint = topContent.select('circle.highlight-point');
    if (!oldHighlightPoint.empty()) oldHighlightPoint.remove();

    if (point === undefined) {
      return;
    }

    topContent
      .append('circle')
      .attr('class', 'highlight-point')
      .attr('cx', this.xScale(point.x))
      .attr('cy', this.yScale(point.y))
      .attr('r', SCATTER_DOT_RADIUS * 2);
  };

  /**
   * Event handler for mousemove
   * @param e Mouse event
   */
  mousemoveHandler = (e: MouseEvent) => {
    // Show tooltip when mouse over a data point on canvas
    // We need to use color picking to figure out which point is hovered over
    const x = e.offsetX;
    const y = e.offsetY;

    const pixel = this.pointBackCtx.getImageData(x, y, 1, 1);
    const hex = rgbToHex(pixel.data[0], pixel.data[1], pixel.data[2]);
    const point = this.colorPointMap.get(hex);
    this.highlightPoint(point);
  };
}
