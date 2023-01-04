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
  EmbeddingWorkerMessage,
  EmbeddingInitSetting
} from '../my-types';
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
  drawTopicGrid
} from './EmbeddingLabel';
import {
  drawScatterCanvas,
  drawScatterBackCanvas,
  getNextUniqueColor,
  highlightPoint,
  syncPointData
} from './EmbeddingPoint';
import { getLatoTextWidth } from '../../utils/text-width';
import type { Writable } from 'svelte/store';
import type { TooltipStoreValue } from '../../stores';
import { getTooltipStoreDefaultValue } from '../../stores';
import { config } from '../../config/config';

const DEBUG = config.debug;

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

  // Zooming
  zoom: d3.ZoomBehavior<HTMLElement, unknown> | null = null;
  initZoomK = 1;
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

  drawScatterCanvas = drawScatterCanvas;
  drawScatterBackCanvas = drawScatterBackCanvas;
  getNextUniqueColor = getNextUniqueColor;
  highlightPoint = highlightPoint;
  syncPointData = syncPointData;

  /**
   *
   * @param args Named parameters
   * @param args.component The component
   */
  constructor({
    component,
    tooltipStore,
    updateEmbedding,
    defaultSetting
  }: {
    component: HTMLElement;
    tooltipStore: Writable<TooltipStoreValue>;
    updateEmbedding: () => void;
    defaultSetting: EmbeddingInitSetting;
  }) {
    this.component = component;
    this.tooltipStore = tooltipStore;
    this.updateEmbedding = updateEmbedding;

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
    const url = `/data/umap-${'1m'}.ndjson`;
    // const url =
    // 'https://pub-596951ee767949aba9096a18685c74bd.r2.dev/umap-1m.ndjson';

    const message: EmbeddingWorkerMessage = {
      command: 'startLoadData',
      payload: { url: url }
    };
    this.embeddingWorker.postMessage(message);

    this.embeddingWorker.onmessage = (
      e: MessageEvent<EmbeddingWorkerMessage>
    ) => {
      if (e.data.command === 'finishLoadData') {
        if (e.data.payload.isFirstBatch && e.data.payload.points) {
          // Draw the first batch
          this.syncPointData(e.data.payload.points);
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
      });

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
    const gridData = await d3.json<GridData>('/data/umap-1m-grid.json');

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

    this.initZoomK = Math.min(
      this.svgFullSize.width / (x1 - x0),
      this.svgFullSize.height / (y1 - y0)
    );

    // Trigger the first zoom
    this.topSvg
      .transition()
      .duration(300)
      .call(selection =>
        this.zoom?.scaleTo(selection, this.initZoomK, [
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
              .scale(this.initZoomK)
              .translate(-this.svgSize.width / 2, -this.svgSize.height / 2)
          );
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

    // Transform the visible canvas elements
    if (this.showPoint) {
      this.pointCtx.save();
      this.pointCtx.setTransform(1, 0, 0, 1, 0, 0);
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
    }

    // Adjust the label size based on the zoom level
    if (this.showLabel) {
      this.layoutTopicLabels(this.userMaxLabelNum);
    }

    // Adjust the canvas grid based on the zoom level
    if (this.showGrid) {
      const topicCtxs = this.topicCanvases.map(
        c => (c.node() as HTMLCanvasElement).getContext('2d')!
      );

      for (const topicCtx of topicCtxs) {
        topicCtx.save();
        topicCtx.setTransform(1, 0, 0, 1, 0, 0);
        topicCtx.clearRect(
          0,
          0,
          this.svgFullSize.width,
          this.svgFullSize.height
        );
        topicCtx.translate(transform.x, transform.y);
        topicCtx.scale(transform.k, transform.k);
      }

      this.drawTopicGrid();
      topicCtxs.forEach(c => c.restore());
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
      this.pointBackCtx.save();
      this.pointBackCtx.setTransform(1, 0, 0, 1, 0, 0);
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
        this.svg.select('g.contour-group').classed('hidden', !this.showContour);
        break;
      }

      case 'point': {
        this.showPoint = checked;
        this.pointCanvas
          .classed('hidden', !this.showPoint)
          .classed('faded', this.showPoint && this.showLabel);
        break;
      }

      case 'grid': {
        this.showGrid = checked;
        this.topicCanvases.forEach(c => c.classed('hidden', !this.showGrid));

        if (this.showGrid) {
          const topicCtxs = this.topicCanvases.map(
            c => (c.node() as HTMLCanvasElement).getContext('2d')!
          );

          for (const topicCtx of topicCtxs) {
            topicCtx.save();
            topicCtx.setTransform(1, 0, 0, 1, 0, 0);
            topicCtx.clearRect(
              0,
              0,
              this.svgFullSize.width,
              this.svgFullSize.height
            );
            topicCtx.translate(
              this.curZoomTransform.x,
              this.curZoomTransform.y
            );
            topicCtx.scale(this.curZoomTransform.k, this.curZoomTransform.k);
          }

          this.drawTopicGrid();
          topicCtxs.forEach(c => c.restore());
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
