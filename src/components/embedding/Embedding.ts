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
  LevelTileMap,
  TopicData,
  TopicDataJSON,
  Rect,
  DrawnLabel,
  LabelData
} from '../my-types';
import { Direction } from '../my-types';
import {
  downloadJSON,
  splitStreamTransform,
  parseJSONTransform,
  timeit,
  rgbToHex,
  round,
  rectsIntersect
} from '../../utils/utils';
import { getLatoTextWidth } from '../../utils/text-width';
import type { Writable } from 'svelte/store';
import type { TooltipStoreValue } from '../../stores';
import { getTooltipStoreDefaultValue } from '../../stores';
import { config } from '../../config/config';

const DATA_SIZE = '60k';
const DEBUG = true;
const SCATTER_DOT_RADIUS = 1;
const IDEAL_TILE_WIDTH = 35;
const LABEL_SPLIT = '-';

let pointMouseleaveTimer: number | null = null;
let pointMouseenterTimer: number | null = null;

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
  hoverPoint: PromptPoint | null = null;

  zoom: d3.ZoomBehavior<HTMLElement, unknown> | null = null;
  curZoomTransform: d3.ZoomTransform = d3.zoomIdentity;

  xScale: d3.ScaleLinear<number, number, never>;
  yScale: d3.ScaleLinear<number, number, never>;
  component: HTMLElement;

  // Data
  prompts: string[] = [];
  promptPoints: PromptPoint[] = [];
  gridData: GridData | null = null;
  tileData: LevelTileMap | null = null;
  randomUniform = d3.randomUniform.source(d3.randomLcg(0.1212))(0, 1);

  contours: d3.ContourMultiPolygon[] | null = null;
  topicLevelTrees: Map<number, d3.Quadtree<TopicData>> = new Map<
    number,
    d3.Quadtree<TopicData>
  >();

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
    tooltipStore
  }: {
    component: HTMLElement;
    tooltipStore: Writable<TooltipStoreValue>;
  }) {
    this.component = component;
    this.tooltipStore = tooltipStore;

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
    timeit('Init data', DEBUG);
    this.initData().then(() => {
      timeit('Init data', DEBUG);
    });

    // Initialize the stores
    this.initStores();
  }

  /**
   * Initialize the stores.
   */
  initStores = () => {
    this.tooltipStore.subscribe(value => {
      this.tooltipStoreValue = value;
    });
  };

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

    const topContent = topGroup.append('g').attr('class', 'top-content');
    topContent.append('g').attr('class', 'highlights');
    topContent.append('g').attr('class', 'topics');
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
    const gridPromise = d3
      .json<GridData>('/data/umap-60k-grid.json')
      .then(gridData => {
        if (gridData) {
          this.gridData = gridData;
          this.contours = this.drawContour();
        } else {
          console.error('Fail to read grid data');
        }
      });

    // Read the topic label data
    const topicPromise = d3
      .json<TopicDataJSON>('/data/umap-60k-topic-data.json')
      .then(topicData => {
        if (topicData) {
          // Create a quad tree at each level
          for (const level of Object.keys(topicData!.data)) {
            const tree = d3
              .quadtree<TopicData>()
              .x(d => d[0])
              .y(d => d[1])
              .extent(topicData!.extent)
              .addAll(topicData!.data[level]);
            this.topicLevelTrees.set(parseInt(level), tree);
          }
        } else {
          console.error('Fail to read topic data.');
        }
      });

    // Show topic labels once we have contours and topic data
    Promise.all([gridPromise, topicPromise]).then(() => {
      this.showTopicLabels(20);
    });

    // Read the tile data for the topic map
    // d3.json<LevelTileMap>('/data/umap-60k-level-topics.json').then(tileData => {
    //   if (tileData) {    //     this.tileData = tileData;
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
        const r = Math.max(1, 3.5 - this.curZoomTransform.k);
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
    if (this.gridData == null) {
      console.error('Grid data not initialized');
      return null;
    }

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

  /**
   * Get the ideal quadtree level based on the ideal tile width and the current
   * zoom level
   */
  getIdealTopicTreeLevel = () => {
    if (this.topicLevelTrees.size < 1) return null;

    const viewWidth = Math.max(
      this.xScale.domain()[1] - this.xScale.domain()[0],
      this.yScale.domain()[1] - this.yScale.domain()[0]
    );

    let bestLevel = -1;
    let bestDistance = Infinity;

    for (const level of this.topicLevelTrees.keys()) {
      const tileNum = Math.pow(2, level);
      const tileSize = viewWidth / tileNum;
      const scaledTileWidth =
        Math.max(
          this.xScale(tileSize) - this.xScale(0),
          this.yScale(tileSize) - this.yScale(0)
        ) * this.curZoomTransform.k;

      if (Math.abs(scaledTileWidth - IDEAL_TILE_WIDTH) < bestDistance) {
        bestLevel = level;
        bestDistance = Math.abs(scaledTileWidth - IDEAL_TILE_WIDTH);
      }
    }

    return bestLevel;
  };

  /**
   * Show the topic labels at different zoom scales.
   */
  showTopicLabels = (maxLabels = -1) => {
    if (this.topicLevelTrees.size <= 1) return;
    if (this.contours === null) return;

    // Fin near labels for high density regions
    const group = this.topSvg.select('g.top-content g.topics');
    const polygonCenters = [];
    for (let i = this.contours.length - 1; i >= 0; i--) {
      const contour = this.contours[i];

      // Compute the geometric center of each polygon
      for (const polygon of contour.coordinates) {
        const xs = [];
        const ys = [];
        for (const point of polygon[0]) {
          xs.push(point[0]);
          ys.push(point[1]);
        }
        const centerX = xs.reduce((a, b) => a + b) / xs.length;
        const centerY = ys.reduce((a, b) => a + b) / ys.length;
        polygonCenters.push([centerX, centerY, contour.value]);
      }
    }

    // Choose the topic tree level based on the current zoom level
    const idealTreeLevel = this.getIdealTopicTreeLevel()!;
    const topicTree = this.topicLevelTrees.get(idealTreeLevel)!;
    const treeExtent = topicTree.extent()!;
    const tileWidth =
      (treeExtent[1][0] - treeExtent[0][1]) / Math.pow(2, idealTreeLevel);
    const tileScreenWidth = this.xScale(tileWidth) - this.xScale(0);

    // Find closest topic labels for each high density point
    const labelDataMap = new Map<string, LabelData>();
    const labelDataCounter = new Map<string, number>();

    for (const point of polygonCenters) {
      const viewX = this.xScale.invert(point[0]);
      const viewY = this.yScale.invert(point[1]);

      // Use 2D search to potentially detect multiple tiles for one density
      // center. Radius is a hyper parameter.
      const radius = tileWidth * 0.5;
      const closestTopics = search2DQuadTree(
        topicTree,
        viewX - radius,
        viewY - radius,
        viewX + radius,
        viewY + radius
      );

      for (const closestTopic of closestTopics) {
        const curLabelData: LabelData = {
          tileX: closestTopic[0] - tileWidth / 2,
          tileY: closestTopic[1] + tileWidth / 2,
          tileCenterX: closestTopic[0],
          tileCenterY: closestTopic[1],
          pointX: viewX,
          pointY: viewY,
          name: closestTopic[2]
        };

        if (labelDataCounter.has(curLabelData.name)) {
          labelDataCounter.set(
            curLabelData.name,
            labelDataCounter.get(curLabelData.name)! + point[2]
          );
        } else {
          labelDataCounter.set(curLabelData.name, point[2]);
          labelDataMap.set(curLabelData.name, curLabelData);
        }
      }
    }

    // Sort the label data by their accumulated density scores
    const sortedLabelData = [...labelDataCounter]
      .sort((a, b) => b[1] - a[1])
      .map(pair => labelDataMap.get(pair[0])!)
      .slice(0, maxLabels === -1 ? labelDataMap.size : maxLabels);

    const drawnLabels: DrawnLabel[] = [];
    const drawnTiles: Rect[] = [];

    const fontSize = round(14 / this.curZoomTransform.k, 0);
    const textHeight = fontSize * 1.1;
    const vPadding = 4;
    const hPadding = 4;

    for (const label of sortedLabelData) {
      const twoLine = label.name.length > 12;
      let line1 = label.name.slice(0, Math.floor(label.name.length / 2));
      let line2 = label.name.slice(Math.floor(label.name.length / 2));

      if (twoLine && label.name.split(LABEL_SPLIT).length >= 4) {
        const words = label.name.split(LABEL_SPLIT);
        line1 = words.slice(0, 2).join('-') + '-';
        line2 = words.slice(2).join('-');
      }

      const textWidth = twoLine
        ? Math.max(
            getLatoTextWidth(line1, fontSize),
            getLatoTextWidth(line2, fontSize)
          )
        : getLatoTextWidth(label.name, fontSize);
      const curTextHeight = twoLine ? textHeight * 1.8 : textHeight;

      // Try 4 different layout
      let fit = true;
      let fitRect: Rect | null = null;
      let fitDirection: Direction | null = null;

      // Simple greedy heuristic:
      // https://en.wikipedia.org/wiki/Automatic_label_placement
      // (1) Prioritize left and right over top and bottom;
      const directions = [
        Direction.left,
        Direction.right,
        Direction.bottom,
        Direction.top
      ];

      // (2) Prioritize right if the tile is on the right half
      if (label.tileCenterX >= (treeExtent[0][0] + treeExtent[1][0]) / 2) {
        directions[0] = Direction.right;
        directions[1] = Direction.left;
      }

      // (3) pick the opposite direction as the connected drawn neighbor's tile.
      // We also use this iteration to check if this topic tile would overlaps
      // with previous labels.
      let neighborDirection: Direction | null = null;
      let tileIntersects = false;
      const curTileRect: Rect = {
        x: this.xScale(label.tileX),
        y: this.yScale(label.tileY),
        width: tileScreenWidth,
        height: tileScreenWidth
      };

      for (const drawnLabel of drawnLabels) {
        if (rectsIntersect(curTileRect, drawnLabel)) {
          tileIntersects = true;
          break;
        }

        const xDiff = Math.abs(drawnLabel.tileX - label.tileX);
        const yDiff = Math.abs(drawnLabel.tileY - label.tileY);
        if (xDiff + yDiff <= tileWidth) {
          neighborDirection = drawnLabel.direction;
        }
      }

      // Do now show this label if it overlaps
      if (tileIntersects) {
        continue;
      }

      switch (neighborDirection) {
        case Direction.left: {
          directions.splice(directions.indexOf(Direction.right), 1);
          directions.unshift(Direction.right);
          break;
        }
        case Direction.right: {
          directions.splice(directions.indexOf(Direction.left), 1);
          directions.unshift(Direction.left);
          break;
        }
        case Direction.top: {
          directions.splice(directions.indexOf(Direction.bottom), 1);
          directions.unshift(Direction.bottom);
          break;
        }
        case Direction.bottom: {
          directions.splice(directions.indexOf(Direction.top), 1);
          directions.unshift(Direction.top);
          break;
        }
        default: {
          break;
        }
      }

      // (4) Prioritize a safer direction first if there is another (future)
      // tile connecting to the current tile's left or right
      for (const futureLabel of sortedLabelData) {
        if (futureLabel.tileY === label.tileY) {
          const xDiff = futureLabel.tileX - label.tileX;
          if (xDiff === tileWidth) {
            // There is a future tile on the right, prioritize left
            directions.splice(directions.indexOf(Direction.left), 1);
            directions.unshift(Direction.left);
          } else if (xDiff === -tileWidth) {
            // There is a future tile on the left, prioritize right
            directions.splice(directions.indexOf(Direction.right), 1);
            directions.unshift(Direction.right);
          }
        }
      }

      for (const direction of directions) {
        fit = true;
        const curRect: Rect = {
          x: 0,
          y: 0,
          width: textWidth,
          height: curTextHeight
        };

        // Compute the bounding box for this current layout
        switch (direction) {
          case Direction.top:
            curRect.x = this.xScale(label.tileCenterX) - textWidth / 2;
            curRect.y =
              this.yScale(label.tileCenterY) -
              tileScreenWidth / 2 -
              curTextHeight -
              vPadding;
            break;

          case Direction.bottom:
            curRect.x = this.xScale(label.tileCenterX) - textWidth / 2;
            curRect.y =
              this.yScale(label.tileCenterY) + tileScreenWidth / 2 + vPadding;
            break;

          case Direction.left:
            curRect.x =
              this.xScale(label.tileCenterX) -
              tileScreenWidth / 2 -
              textWidth -
              hPadding;
            curRect.y = this.yScale(label.tileCenterY) - curTextHeight / 2;
            break;

          case Direction.right:
            curRect.x =
              this.xScale(label.tileCenterX) + tileScreenWidth / 2 + hPadding;
            curRect.y = this.yScale(label.tileCenterY) - curTextHeight / 2;
            break;

          default:
            console.error('Unknown direction value.');
            break;
        }

        // Compare the current direction with existing labels to see if there is
        // any overlapping
        for (const drawnLabel of drawnLabels) {
          if (rectsIntersect(curRect, drawnLabel)) {
            fit = false;
            break;
          }
        }

        // Compare the current direction with existing tile squares to see if
        // there is any overlapping
        for (const drawnTile of drawnTiles) {
          if (rectsIntersect(curRect, drawnTile)) {
            fit = false;
            break;
          }
        }

        // The current direction does not overlap with any existing rects
        if (fit) {
          fitRect = curRect;
          fitDirection = direction;
          break;
        }
      }

      // Draw this label if we find a location for it
      if (fit && fitRect && fitDirection) {
        const drawnLabel: DrawnLabel = {
          x: fitRect.x,
          y: fitRect.y,
          width: fitRect.width,
          height: fitRect.height,
          direction: fitDirection,
          pointX: label.pointX,
          pointY: label.pointY,
          tileX: label.tileX,
          tileY: label.tileY
        };
        const drawnTile: Rect = {
          x: this.xScale(label.tileX),
          y: this.yScale(label.tileY),
          width: tileScreenWidth,
          height: tileScreenWidth
        };

        drawnLabels.push(drawnLabel);
        drawnTiles.push(drawnTile);

        let x = this.xScale(label.tileCenterX);
        let y = this.yScale(label.tileCenterY);

        switch (fitDirection) {
          case Direction.top: {
            y -= vPadding + tileScreenWidth / 2 + (twoLine ? textHeight : 0);
            break;
          }
          case Direction.bottom: {
            y += vPadding + tileScreenWidth / 2;
            break;
          }
          case Direction.left: {
            x -= hPadding + tileScreenWidth / 2;
            y -= twoLine ? textHeight : 0;
            break;
          }
          case Direction.right: {
            x += hPadding + tileScreenWidth / 2;
            y -= twoLine ? textHeight : 0;
            break;
          }
          default: {
            console.error('Unknown layout value.');
            break;
          }
        }

        if (twoLine) {
          const text = group
            .append('text')
            .attr('class', 'topic-label')
            .classed(fitDirection, true)
            .style('font-size', `${fontSize}px`)
            .attr('paint-order', 'stroke')
            .style('stroke', 'white')
            .style('stroke-width', 2);

          text.append('tspan').attr('x', x).attr('y', y).text(line1);
          text
            .append('tspan')
            .attr('x', x)
            .attr('y', y)
            .attr('dy', '0.95em')
            .text(line2);
        } else {
          group
            .append('text')
            .attr('class', 'topic-label')
            .attr('x', x)
            .attr('y', y)
            .classed(fitDirection, true)
            .style('font-size', `${fontSize}px`)
            .text(label.name);
        }

        // group
        //   .append('rect')
        //   .attr('x', fitRect.x)
        //   .attr('y', fitRect.y)
        //   .attr('width', fitRect.width)
        //   .attr('height', fitRect.height)
        //   .style('fill', 'none')
        //   .style('stroke', 'orange');
      }
    }

    // Draw the high density center
    // group
    //   .selectAll('circle.topic-center')
    //   .data(drawnLabels)
    //   .join('circle')
    //   .attr('cx', d => this.xScale(d.pointX))
    //   .attr('cy', d => this.yScale(d.pointY))
    //   .attr('r', 2);

    // Draw the topic region
    group
      .selectAll('rect.topic-tile')
      .data(drawnLabels)
      .join('rect')
      .attr('class', 'topic-tile')
      .attr('x', d => this.xScale(d.tileX))
      .attr('y', d => this.yScale(d.tileY))
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('width', tileScreenWidth)
      .attr('height', tileScreenWidth)
      .style('fill', 'none')
      .style('stroke', config.colors['gray-800']);
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
    // this.drawScatterCanvas();
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
    // this.drawScatterBackCanvas();
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
    if (point === this.hoverPoint) return;

    // Draw the point on the top svg
    const group = this.topSvg.select('g.top-content g.highlights');
    const oldHighlightPoint = group.select('circle.highlight-point');

    // Hovering empty space
    if (point === undefined) {
      if (!oldHighlightPoint.empty()) {
        if (pointMouseleaveTimer !== null) {
          clearTimeout(pointMouseleaveTimer);
          pointMouseleaveTimer = null;
        }

        // Clear the highlight and tooltip in a short delay
        pointMouseleaveTimer = setTimeout(() => {
          this.hoverPoint = null;
          oldHighlightPoint.remove();
          this.tooltipStoreValue.show = false;
          this.tooltipStore.set(this.tooltipStoreValue);
          pointMouseleaveTimer = null;
        }, 50);
      }
      return;
    }

    // Hovering over a point
    this.hoverPoint = point;
    if (pointMouseleaveTimer !== null) {
      clearTimeout(pointMouseleaveTimer);
      pointMouseleaveTimer = null;
    }

    // There is no point highlighted yet
    const highlightRadius = Math.max(
      SCATTER_DOT_RADIUS * 1.5,
      7 / this.curZoomTransform.k
    );
    const highlightStroke = 1.2 / this.curZoomTransform.k;

    if (oldHighlightPoint.empty()) {
      const highlightPoint = group
        .append('circle')
        .attr('class', 'highlight-point')
        .attr('cx', this.xScale(point.x))
        .attr('cy', this.yScale(point.y))
        .attr('r', highlightRadius)
        .style('stroke-width', highlightStroke);

      // Get the point position
      const position = highlightPoint.node()!.getBoundingClientRect();
      const curWidth = position.width;
      const tooltipCenterX = position.x + curWidth / 2;
      const tooltipCenterY = position.y;
      this.tooltipStoreValue.html = `
          <div class='tooltip-content' style='display: flex; flex-direction:
            column; justify-content: center;'>
            ${this.prompts[point.id]}
          </div>
        `;

      this.tooltipStoreValue.x = tooltipCenterX;
      this.tooltipStoreValue.y = tooltipCenterY;
      this.tooltipStoreValue.show = true;

      if (pointMouseenterTimer !== null) {
        clearTimeout(pointMouseenterTimer);
        pointMouseenterTimer = null;
      }

      // Show the tooltip after a delay
      pointMouseenterTimer = setTimeout(() => {
        this.tooltipStore.set(this.tooltipStoreValue);
        pointMouseenterTimer = null;
      }, 300);
    } else {
      // There has been a highlighted point already
      oldHighlightPoint
        .attr('cx', this.xScale(point.x))
        .attr('cy', this.yScale(point.y))
        .attr('r', highlightRadius)
        .style('stroke-width', highlightStroke);

      // Get the point position
      const position = (
        oldHighlightPoint.node()! as HTMLElement
      ).getBoundingClientRect();
      const curWidth = position.width;
      const tooltipCenterX = position.x + curWidth / 2;
      const tooltipCenterY = position.y;
      this.tooltipStoreValue.html = `
          <div class='tooltip-content' style='display: flex; flex-direction:
            column; justify-content: center;'>
            ${this.prompts[point.id]}
          </div>
        `;
      this.tooltipStoreValue.x = tooltipCenterX;
      this.tooltipStoreValue.y = tooltipCenterY;
      this.tooltipStoreValue.show = true;

      if (pointMouseenterTimer !== null) {
        clearTimeout(pointMouseenterTimer);
        pointMouseenterTimer = setTimeout(() => {
          this.tooltipStore.set(this.tooltipStoreValue);
          pointMouseenterTimer = null;
        }, 300);
      } else {
        this.tooltipStore.set(this.tooltipStoreValue);
      }
    }
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

/**
 * Search all data points in the given bounding box
 * @param quadtree Quadtree
 * @param xmin min x
 * @param ymin min y
 * @param xmax max x
 * @param ymax max y
 * @returns Array of points in this regin
 */
const search2DQuadTree = (
  quadtree: d3.Quadtree<TopicData>,
  xmin: number,
  ymin: number,
  xmax: number,
  ymax: number
) => {
  const results: TopicData[] = [];
  quadtree.visit((node, x1, y1, x2, y2) => {
    if (!node.length) {
      let leaf: d3.QuadtreeLeaf<TopicData> | undefined =
        node as d3.QuadtreeLeaf<TopicData>;
      do {
        const d = leaf.data;
        if (d[0] >= xmin && d[0] < xmax && d[1] >= ymin && d[1] < ymax) {
          results.push(d);
        }
      } while ((leaf = leaf.next));
    }
    return x1 >= xmax || y1 >= ymax || x2 < xmin || y2 < ymin;
  });
  return results;
};
