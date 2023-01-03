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
  LabelData,
  Direction,
  Point,
  EmbeddingWorkerMessage
} from '../my-types';
import {
  downloadJSON,
  splitStreamTransform,
  parseJSONTransform,
  timeit,
  rgbToHex,
  round,
  rectsIntersect
} from '../../utils/utils';
import {
  drawLabels,
  layoutTopicLabels,
  addTileIndicatorPath,
  getIdealTopicTreeLevel,
  labelNumSliderChanged,
  mouseoverLabel,
  drawTopicGrid
} from './EmbeddingLabel';
import { getLatoTextWidth } from '../../utils/text-width';
import type { Writable } from 'svelte/store';
import type { TooltipStoreValue } from '../../stores';
import { getTooltipStoreDefaultValue } from '../../stores';
import { config } from '../../config/config';
import EmbeddingWorker from './EmbeddingWorker?worker';

const DATA_SIZE = '60k';
const DEBUG = true;
const SCATTER_DOT_RADIUS = 1;

let pointMouseleaveTimer: number | null = null;
let pointMouseenterTimer: number | null = null;

type HoverMode = 'point' | 'label' | 'none';

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
  topicCanvas: d3.Selection<HTMLElement, unknown, null, undefined>;
  pointCtx: CanvasRenderingContext2D;

  pointBackCanvas: d3.Selection<HTMLElement, unknown, null, undefined>;
  pointBackCtx: CanvasRenderingContext2D;
  colorPointMap: Map<string, PromptPoint> = new Map<string, PromptPoint>();
  hoverPoint: PromptPoint | null = null;

  xScale: d3.ScaleLinear<number, number, never>;
  yScale: d3.ScaleLinear<number, number, never>;
  component: HTMLElement;
  updateEmbedding: () => void;

  // Zooming
  zoom: d3.ZoomBehavior<HTMLElement, unknown> | null = null;
  curZoomTransform: d3.ZoomTransform = d3.zoomIdentity;
  curZoomLevel = 1;

  // Interactions
  lastMouseClientPosition: Point | null = null;

  // User settings
  hoverMode: HoverMode = 'label';
  showContour = true;
  showGrid = true;
  showPoint = false;

  // Data
  prompts: string[] = [];
  promptPoints: PromptPoint[] = [];
  gridData: GridData | null = null;
  tileData: LevelTileMap | null = null;
  randomUniform = d3.randomUniform.source(d3.randomLcg(0.1212))(0, 1);
  contours: d3.ContourMultiPolygon[] | null = null;
  contoursInitialized = false;

  // Display labels
  topicLevelTrees: Map<number, d3.Quadtree<TopicData>> = new Map<
    number,
    d3.Quadtree<TopicData>
  >();
  maxLabelNum = 0;
  curLabelNum = 0;
  userMaxLabelNum = 20;
  lastLabelNames: Map<string, Direction> = new Map();
  lastLabelTreeLevel: number | null = null;
  lastGridTreeLevel: number | null = null;

  // Stores
  tooltipStore: Writable<TooltipStoreValue>;
  tooltipStoreValue: TooltipStoreValue = getTooltipStoreDefaultValue();

  // Web workers

  // Methods implemented in other files
  drawLabels = drawLabels;
  layoutTopicLabels = layoutTopicLabels;
  addTileIndicatorPath = addTileIndicatorPath;
  getIdealTopicTreeLevel = getIdealTopicTreeLevel;
  labelNumSliderChanged = labelNumSliderChanged;
  mouseoverLabel = mouseoverLabel;
  drawTopicGrid = drawTopicGrid;

  /**
   *
   * @param args Named parameters
   * @param args.component The component
   */
  constructor({
    component,
    tooltipStore,
    updateEmbedding
  }: {
    component: HTMLElement;
    tooltipStore: Writable<TooltipStoreValue>;
    updateEmbedding: () => void;
  }) {
    this.component = component;
    this.tooltipStore = tooltipStore;
    this.updateEmbedding = updateEmbedding;

    // Initialize the web worker to load data
    const embeddingWorker = new EmbeddingWorker();
    const url = `/data/umap-${'1m'}.ndjson`;
    // const url =
    // 'https://pub-596951ee767949aba9096a18685c74bd.r2.dev/umap-1m.ndjson';
    // const url =
    //   'https://huggingface.co/datasets/xiaohk/embedding/resolve/main/umap-1m.ndjson';

    const message: EmbeddingWorkerMessage = {
      command: 'startLoadData',
      payload: { url: url }
    };
    embeddingWorker.postMessage(message);

    embeddingWorker.onmessage = (e: MessageEvent<EmbeddingWorkerMessage>) => {
      if (e.data.command === 'finishLoadData') {
        if (e.data.payload.isFirstBatch) {
          console.log('Finish loading first batch');
        } else {
          console.log('Finished loading all');
        }
      }
    };

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

    // Initialize the canvases
    this.pointCanvas = d3
      .select(this.component)
      .select<HTMLElement>('.embedding-canvas')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height);
    this.pointCtx = (this.pointCanvas.node()! as HTMLCanvasElement).getContext(
      '2d'
    )!;

    this.topicCanvas = d3
      .select(this.component)
      .select<HTMLElement>('.topic-grid-canvas')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height);

    // Initialize the background canvas (for mouseover)
    this.pointBackCanvas = d3
      .select(this.component)
      .select<HTMLElement>('.embedding-canvas-back')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height);
    this.pointBackCtx = (
      this.pointBackCanvas.node()! as HTMLCanvasElement
    ).getContext('2d', { willReadFrequently: true })!;
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
      .on('pointermove', e => this.mousemoveHandler(e as MouseEvent))
      .on('mouseleave', () => {
        this.mouseoverLabel(null, null);
      });

    const topGroup = topSvg.append('g').attr('class', 'top-group');

    topGroup
      .append('rect')
      .attr('class', 'mouse-track-rect')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height);

    const topContent = topGroup.append('g').attr('class', 'top-content');
    topContent.append('g').attr('class', 'highlights');
    topContent.append('g').attr('class', 'topics-bottom');
    topContent.append('g').attr('class', 'topics');
    topContent.append('g').attr('class', 'topics-top');
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
    // fetch(`/data/umap-${DATA_SIZE}.ndjson`).then(async response => {
    //   const reader = response?.body
    //     ?.pipeThrough(new TextDecoderStream())
    //     ?.pipeThrough(splitStreamTransform('\n'))
    //     ?.pipeThrough(parseJSONTransform())
    //     ?.getReader();

    //   while (true && reader !== undefined) {
    //     const result = await reader.read();
    //     const point = result.value as UMAPPointStreamData;
    //     const done = result.done;

    //     if (done) {
    //       console.info('Finished streaming');
    //       break;
    //     } else {
    //       this.processPointStream(point);
    //     }
    //   }
    // });

    // Read the grid data for contour background
    const gridPromise = d3
      .json<GridData>('/data/umap-1m-grid.json')
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
      .json<TopicDataJSON>('/data/umap-1m-topic-data.json')
      .then(topicData => {
        if (topicData) {
          // Create a quad tree at each level
          for (const level of Object.keys(topicData!.data)) {
            const tree = d3
              .quadtree<TopicData>()
              .x(d => d[0])
              .y(d => d[1])
              .addAll(topicData!.data[level]);
            this.topicLevelTrees.set(parseInt(level), tree);
          }
        } else {
          console.error('Fail to read topic data.');
        }
      });

    // Show topic labels once we have contours and topic data
    Promise.all([gridPromise, topicPromise]).then(() => {
      this.drawTopicGrid();
      this.layoutTopicLabels(this.userMaxLabelNum);

      // Initialize the slider value
      setTimeout(() => {
        (
          this.component.querySelector(
            'input#slider-label-num'
          ) as HTMLInputElement
        ).value = `${this.curLabelNum}`;
      }, 500);
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

    // Trigger the first zoom
    this.topSvg
      .transition()
      .duration(300)
      .call(selection =>
        this.zoom?.scaleTo(selection, k, [
          this.svgSize.width / 2,
          this.svgSize.height / 2
        ])
      )
      .on('end', () => {
        this.contoursInitialized = true;
      });

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

    // Adjust the label size based on the zoom level
    this.layoutTopicLabels(this.userMaxLabelNum);

    // Adjust the canvas grid based on the zoom level
    const topicCtx = (this.topicCanvas.node() as HTMLCanvasElement).getContext(
      '2d'
    );
    if (topicCtx) {
      topicCtx.save();
      topicCtx.translate(transform.x, transform.y);
      topicCtx.scale(transform.k, transform.k);
      this.drawTopicGrid();
      topicCtx.restore();
    }

    // Adjust the highlighted tile
    if (this.lastMouseClientPosition) {
      this.mouseoverLabel(
        this.lastMouseClientPosition.x,
        this.lastMouseClientPosition.y
      );
    }
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
    this.lastMouseClientPosition = { x: x, y: y };

    const pixel = this.pointBackCtx.getImageData(x, y, 1, 1);
    const hex = rgbToHex(pixel.data[0], pixel.data[1], pixel.data[2]);
    const point = this.colorPointMap.get(hex);
    this.highlightPoint(point);

    // Show labels
    this.mouseoverLabel(x, y);
  };

  /**
   * Get the current zoom viewing box
   * @returns Current zoom view box
   */
  getCurZoomBox = () => {
    const box: Rect = {
      x: this.curZoomTransform.invertX(0),
      y: this.curZoomTransform.invertY(0),
      width:
        this.curZoomTransform.invertX(this.svgFullSize.width) -
        this.curZoomTransform.invertX(0),
      height:
        this.curZoomTransform.invertY(this.svgFullSize.height) -
        this.curZoomTransform.invertY(0)
    };
    return box;
  };

  /**
   * User chooses a new hover mode
   * @param mode New mode ('point', 'label', or 'none')
   */
  hoverModeChanged = (mode: string) => {
    this.hoverMode = mode as HoverMode;
  };

  /**
   * Handle user changing the display setting
   * @param checkbox Checkbox name
   * @param checked Whether this checkbox is checked
   */
  displayCheckboxChanged = (checkbox: string, checked: boolean) => {
    switch (checkbox) {
      case 'contour': {
        this.showContour = checked;
        break;
      }
      case 'point': {
        this.showPoint = checked;
        break;
      }
      case 'grid': {
        this.showGrid = checked;
        break;
      }
      default: {
        console.error('Unknown checkbox name', checkbox);
        break;
      }
    }
  };
}
