import d3 from '../../utils/d3-import';
import type {
  PromptUMAPData,
  PromptPoint,
  GridData,
  QuadtreeNode,
  LevelTileDataItem,
  UMAPPointStreamData,
  LevelTileMap,
  TopicData,
  TopicDataJSON,
  DrawnLabel,
  LabelData,
  Direction,
  EmbeddingWorkerMessage,
  EmbeddingInitSetting
} from '../../types/embedding-types';
import type { Size, Padding, Rect, Point } from '../../types/common-types';
import {
  downloadJSON,
  splitStreamTransform,
  parseJSONTransform,
  timeit,
  rgbToHex,
  round,
  rectsIntersect,
  yieldToMain
} from '../../utils/utils';
import {
  drawLabels,
  layoutTopicLabels,
  addTileIndicatorPath,
  getIdealTopicTreeLevel,
  labelNumSliderChanged,
  mouseoverLabel,
  drawTopicGrid,
  redrawTopicGrid,
  drawTopicGridFrame
} from './EmbeddingLabel';
import {
  drawScatterCanvas,
  drawScatterBackCanvas,
  getNextUniqueColor,
  highlightPoint,
  redrawFrontPoints,
  redrawBackPoints
} from './EmbeddingPoint';
import { getLatoTextWidth } from '../../utils/text-width';
import type { Writable } from 'svelte/store';
import type { TooltipStoreValue } from '../../stores';
import { getTooltipStoreDefaultValue } from '../../stores';
import { config } from '../../config/config';

const DEBUG = config.debug;
const REFILL_TIME_GAP = 300;

let DATA_BASE = `${import.meta.env.BASE_URL}data`;
if (import.meta.env.PROD) {
  DATA_BASE = 'https://pub-596951ee767949aba9096a18685c74bd.r2.dev';
}

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
  topicCanvases: d3.Selection<HTMLElement, unknown, null, undefined>[];
  pointCtx: CanvasRenderingContext2D;

  pointBackCanvas: d3.Selection<HTMLElement, unknown, null, undefined>;
  pointBackCtx: CanvasRenderingContext2D;
  colorPointMap: Map<string, PromptPoint> = new Map<string, PromptPoint>();
  hoverPoint: PromptPoint | null = null;

  xScale: d3.ScaleLinear<number, number, never>;
  yScale: d3.ScaleLinear<number, number, never>;
  component: HTMLElement;
  updateEmbedding: () => void;

  // Different settings based on the embedding type (prompt, image)
  embeddingName: string;
  pointURL: string;
  gridURL: string;

  // Zooming
  zoom: d3.ZoomBehavior<HTMLElement, unknown> | null = null;
  initZoomTransform = d3.zoomIdentity;
  curZoomTransform: d3.ZoomTransform = d3.zoomIdentity;
  curZoomLevel = 1;

  // Interactions
  lastMouseClientPosition: Point | null = null;

  // User settings
  hoverMode: HoverMode = 'label';
  showContour: boolean;
  showGrid: boolean;
  showPoint: boolean;
  showLabel: boolean;

  // Data
  promptPoints: PromptPoint[] = [];
  gridData: GridData | null = null;
  tileData: LevelTileMap | null = null;
  contours: d3.ContourMultiPolygon[] | null = null;
  contoursInitialized = false;

  // Scatter plot
  lastRefillID = 0;
  lsatRefillTime = 0;

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
  lastGridTreeLevels: number[] = [];

  // Stores
  tooltipStore: Writable<TooltipStoreValue>;
  tooltipStoreValue: TooltipStoreValue = getTooltipStoreDefaultValue();

  // Web workers
  embeddingWorker: Worker;

  // Methods implemented in other files
  drawLabels = drawLabels;
  layoutTopicLabels = layoutTopicLabels;
  addTileIndicatorPath = addTileIndicatorPath;
  getIdealTopicTreeLevel = getIdealTopicTreeLevel;
  labelNumSliderChanged = labelNumSliderChanged;
  mouseoverLabel = mouseoverLabel;
  drawTopicGrid = drawTopicGrid;
  redrawTopicGrid = redrawTopicGrid;
  drawTopicGridFrame = drawTopicGridFrame;

  drawScatterCanvas = drawScatterCanvas;
  drawScatterBackCanvas = drawScatterBackCanvas;
  getNextUniqueColor = getNextUniqueColor;
  highlightPoint = highlightPoint;
  redrawFrontPoints = redrawFrontPoints;
  redrawBackPoints = redrawBackPoints;

  /**
   *
   * @param args Named parameters
   * @param args.component The component
   */
  constructor({
    component,
    tooltipStore,
    updateEmbedding,
    defaultSetting,
    embeddingName
  }: {
    component: HTMLElement;
    tooltipStore: Writable<TooltipStoreValue>;
    updateEmbedding: () => void;
    defaultSetting: EmbeddingInitSetting;
    embeddingName: string;
  }) {
    this.component = component;
    this.tooltipStore = tooltipStore;
    this.updateEmbedding = updateEmbedding;
    this.embeddingName = embeddingName;

    // Figure out data urls based on the embedding name
    // const url = '/data/umap-1m.ndjson';
    this.pointURL = DATA_BASE + '/umap-1m.ndjson';
    this.gridURL = `${import.meta.env.BASE_URL}data/umap-1m-grid.json`;

    if (embeddingName === 'image') {
      // this.pointURL = `${import.meta.env.BASE_URL}data/umap-image-150k.ndjson`;
      // this.pointURL = new URL('umap-image-150k.ndjson', DATA_BASE).href;
      this.pointURL = DATA_BASE + '/umap-image-150k.ndjson';
      this.gridURL = `${import.meta.env.BASE_URL}data/umap-image-1m-grid.json`;
    }

    // Init some properties based on the default setting
    this.hoverMode = defaultSetting.hover;
    this.showContour = defaultSetting.showContour;
    this.showGrid = defaultSetting.showGrid;
    this.showPoint = defaultSetting.showPoint;
    this.showLabel = defaultSetting.showLabel;

    // Initialize the web worker to load data
    this.embeddingWorker = new Worker(
      new URL('./EmbeddingWorker.ts', import.meta.url),
      { type: 'module' }
    );
    this.embeddingWorker.onmessage = (
      e: MessageEvent<EmbeddingWorkerMessage>
    ) => {
      this.embeddingWorkerMessageHandler(e);
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

    this.topicCanvases = [];
    for (const pos of ['top', 'bottom']) {
      this.topicCanvases.push(
        d3
          .select(this.component)
          .select<HTMLElement>(`.topic-grid-canvas.${pos}`)
          .attr('width', this.svgFullSize.width)
          .attr('height', this.svgFullSize.height)
          .classed('hidden', !this.showGrid)
      );
    }

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
      .on('zoom', (g: d3.D3ZoomEvent<HTMLElement, unknown>) => {
        (async () => {
          await this.zoomed(g);
        })();
      })
      .on('end', () => this.zoomEnded());

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
        this.highlightPoint(undefined);
        this.mouseoverLabel(null, null);
      });

    const topGroup = topSvg.append('g').attr('class', 'top-group');

    topGroup
      .append('rect')
      .attr('class', 'mouse-track-rect')
      .attr('width', this.svgFullSize.width)
      .attr('height', this.svgFullSize.height);

    const topContent = topGroup.append('g').attr('class', 'top-content');

    topContent.append('g').attr('class', 'topics-bottom');
    topContent
      .append('g')
      .attr('class', 'topics')
      .classed('hidden', !this.showLabel);
    topContent.append('g').attr('class', 'topics-top');
    topContent.append('g').attr('class', 'highlights');
    return topSvg;
  };

  /**
   * Load the UMAP data from json.
   */
  initData = async () => {
    // Read the grid data for contour background
    // Await the data to load to get the range for x and y
    const gridData = await d3.json<GridData>(this.gridURL);

    if (gridData === undefined) {
      throw Error('Fail to load grid data.');
    }
    this.gridData = gridData;

    // Initialize the data scales
    const xRange = this.gridData.xRange;
    const yRange = this.gridData.yRange;

    // Force the plot to be a square
    let xLength = xRange[1] - xRange[0];
    let yLength = yRange[1] - yRange[0];

    if (!this.gridData.padded) {
      // Add padding for the data
      if (xLength < yLength) {
        yRange[0] -= yLength / 50;
        yRange[1] += yLength / 50;
        yLength = yRange[1] - yRange[0];

        xRange[0] -= (yLength - xLength) / 2;
        xRange[1] += (yLength - xLength) / 2;
      } else {
        // Add padding for the data
        xRange[0] -= xLength / 50;
        xRange[1] += xLength / 50;
        xLength = xRange[1] - xRange[0];

        yRange[0] -= (xLength - yLength) / 2;
        yRange[1] += (xLength - yLength) / 2;
      }
    }

    // Tell the worker to start loading data
    // (need to wait to get the xRange and yRange)
    const message: EmbeddingWorkerMessage = {
      command: 'startLoadData',
      payload: { url: this.pointURL, xRange, yRange }
    };
    this.embeddingWorker.postMessage(message);

    this.xScale = d3
      .scaleLinear()
      .domain(xRange)
      .range([0, this.svgSize.width]);
    this.yScale = d3
      .scaleLinear()
      .domain(yRange)
      .range([this.svgSize.height, 0]);

    this.contours = this.drawContour();

    // Read the topic label data
    const topicPromise = d3
      .json<TopicDataJSON>(
        `${import.meta.env.BASE_URL}data/umap-1m-topic-data.json`
      )
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
    Promise.all([topicPromise]).then(() => {
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

    umapGroup
      .append('g')
      .attr('class', 'contour-group')
      .classed('hidden', !this.showContour);
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
   * Draw the KDE contour in the background.
   */
  drawContour = () => {
    if (this.gridData == null) {
      console.error('Grid data not initialized');
      return null;
    }

    const contourGroup = this.svg.select<SVGGElement>('.contour-group');

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
    const blueScale = d3.interpolateLab(
      '#ffffff',
      config.colors['light-blue-800']
    );
    let colorScale = d3.scaleSequential(d3.extent(thresholds) as number[], d =>
      blueScale(d / 1)
    );

    if (this.embeddingName === 'image') {
      const purpleScale = d3.interpolateLab(
        '#ffffff',
        config.colors['pink-900']
      );
      colorScale = d3.scaleSequential(d3.extent(thresholds) as number[], d =>
        purpleScale(d / 1)
      );
    }

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

    const initZoomK = Math.min(
      this.svgFullSize.width / (x1 - x0),
      this.svgFullSize.height / (y1 - y0)
    );

    this.initZoomTransform = d3.zoomIdentity
      .translate(this.svgSize.width / 2, this.svgSize.height / 2)
      .scale(initZoomK)
      .translate(-x0 - (x1 - x0) / 2, -y0 - (y1 - y0) / 2);

    // TODO: (remove me) Hack to override the auto zoom for image embedding
    if (this.embeddingName === 'image') {
      this.initZoomTransform = d3.zoomIdentity
        .translate(this.svgSize.width / 2, this.svgSize.height / 2)
        .scale(1.6)
        .translate(-340, -376);
    }

    // Trigger the first zoom
    this.topSvg
      .transition()
      .duration(300)
      .call(selection =>
        this.zoom?.transform(selection, this.initZoomTransform)
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
          this.zoom?.transform(selection, this.initZoomTransform);
        });
    });

    return contours;
  };

  /**
   * Handler for each zoom event
   * @param e Zoom event
   */
  zoomed = async (e: d3.D3ZoomEvent<HTMLElement, unknown>) => {
    const transform = e.transform;
    this.curZoomTransform = transform;

    // === Task (1) ===
    // Transform the SVG elements
    this.svg.select('.umap-group').attr('transform', `${transform.toString()}`);

    // Transform the top SVG elements
    this.topSvg
      .select('.top-group')
      .attr('transform', `${transform.toString()}`);

    // Update the points
    if (Date.now() - this.lsatRefillTime > REFILL_TIME_GAP) {
      const refillMessage: EmbeddingWorkerMessage = {
        command: 'startRefillRegion',
        payload: {
          refillID: ++this.lastRefillID,
          viewRange: this.getCurViewRanges()
        }
      };
      this.embeddingWorker.postMessage(refillMessage);
      this.lsatRefillTime = Date.now();
    }

    // Transform the visible canvas elements
    if (this.showPoint) {
      this.redrawFrontPoints();
    }

    // Adjust the label size based on the zoom level
    if (this.showLabel) {
      this.layoutTopicLabels(this.userMaxLabelNum);
    }

    // Adjust the canvas grid based on the zoom level
    if (this.showGrid) {
      this.redrawTopicGrid();
    }

    // Adjust the highlighted tile
    if (this.hoverMode === 'label' && this.lastMouseClientPosition) {
      this.mouseoverLabel(
        this.lastMouseClientPosition.x,
        this.lastMouseClientPosition.y
      );
    }

    await yieldToMain();

    // === Task (2) ===
    // Transform the background canvas elements
    if (this.showPoint) {
      this.redrawBackPoints();
    }
  };

  /**
   * Event handler for zoom ended
   */
  zoomEnded = () => {
    // Update the points (the last call during zoomed() might be skipped)
    const refillMessage: EmbeddingWorkerMessage = {
      command: 'startRefillRegion',
      payload: {
        refillID: ++this.lastRefillID,
        viewRange: this.getCurViewRanges()
      }
    };
    this.embeddingWorker.postMessage(refillMessage);
  };

  /**
   * Handle messages from the embedding worker
   * @param e Message event
   */
  embeddingWorkerMessageHandler = (e: MessageEvent<EmbeddingWorkerMessage>) => {
    switch (e.data.command) {
      case 'finishLoadData': {
        if (e.data.payload.isFirstBatch && e.data.payload.points) {
          // Draw the first batch
          this.promptPoints = e.data.payload.points;
          this.redrawFrontPoints();
          this.redrawBackPoints();
        } else {
          console.log('Finished loading all');
        }
        break;
      }

      case 'finishRefillRegion': {
        if (e.data.payload.refillID === this.lastRefillID) {
          this.promptPoints = e.data.payload.points;
          this.redrawFrontPoints();
          this.redrawBackPoints();
        }
        break;
      }

      default: {
        console.error('Unknown message', e.data.command);
        break;
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
      width: Math.abs(
        this.curZoomTransform.invertX(this.svgFullSize.width) -
          this.curZoomTransform.invertX(0)
      ),
      height: Math.abs(
        this.curZoomTransform.invertY(this.svgFullSize.height) -
          this.curZoomTransform.invertY(0)
      )
    };
    return box;
  };

  /**
   * Get the current view ranges [xmin, xmax, ymin, ymax] in the data coordinate
   * @returns Current view box in the data coordinate
   */
  getCurViewRanges = (): [number, number, number, number] => {
    const zoomBox = this.getCurZoomBox();

    const xMin = this.xScale.invert(zoomBox.x);
    const xMax = this.xScale.invert(zoomBox.x + zoomBox.width);
    const yMin = this.yScale.invert(zoomBox.y + zoomBox.height);
    const yMax = this.yScale.invert(zoomBox.y);

    const result: [number, number, number, number] = [xMin, xMax, yMin, yMax];
    return result;
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
        this.svg.select('g.contour-group').classed('hidden', !this.showContour);

        if (this.showGrid) {
          let startColor: string;
          let endColor: string;

          if (this.showContour) {
            // No contour -> contour | dark -> light
            startColor = config.gridColorDark;
            endColor = config.gridColorLight;
          } else {
            // Contour -> no contour | light -> dark
            startColor = config.gridColorLight;
            endColor = config.gridColorDark;
          }

          const duration = 300;
          const colorScale = d3.interpolateHsl(startColor, endColor);
          requestAnimationFrame(time => {
            this.drawTopicGridFrame(time, null, duration, colorScale);
          });
        }
        break;
      }

      case 'point': {
        this.showPoint = checked;
        this.pointCanvas
          .classed('hidden', !this.showPoint)
          .classed('faded', this.showPoint && this.showLabel);

        if (this.showPoint) {
          this.redrawFrontPoints();
          this.redrawBackPoints();
        }

        if (this.showGrid) this.redrawTopicGrid();
        break;
      }

      case 'grid': {
        this.showGrid = checked;
        this.topicCanvases.forEach(c => c.classed('hidden', !this.showGrid));

        if (this.showGrid) {
          this.redrawTopicGrid();
        }

        break;
      }

      case 'label': {
        this.showLabel = checked;
        this.topSvg
          .select('g.top-content g.topics')
          .classed('hidden', !this.showLabel);

        this.pointCanvas.classed('faded', this.showPoint && this.showLabel);

        if (this.showLabel) {
          this.layoutTopicLabels(this.userMaxLabelNum);
        }
        break;
      }

      default: {
        console.error('Unknown checkbox name', checkbox);
        break;
      }
    }
  };
}
