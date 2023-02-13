import { config } from '../../config/config';
import { timeit, rgbToHex } from '../../utils/utils';
import d3 from '../../utils/d3-import';
import { computePosition, flip, shift, offset, arrow } from '@floating-ui/dom';
import type { Embedding } from './Embedding';
import type { PromptPoint } from '../../types/embedding-types';
import fragmentShader from './shaders/point.frag?raw';
import vertexShader from './shaders/point.vert?raw';

const SCATTER_DOT_RADIUS = 1;
const DEBUG = config.debug;

let pointMouseenterTimer: number | null = null;
let pointMouseleaveTimer: number | null = null;

/**
 * Initialize the data => stage, stage => [-1, 1] transformation matrices
 * @param this Embedding object
 */
export function initWebGLMatrices(this: Embedding) {
  // Convert the x and y scales to a matrix (applying scale is cheaper in GPU)
  const xDomainMid = (this.xScale.domain()[0] + this.xScale.domain()[1]) / 2;
  const yDomainMid = (this.yScale.domain()[0] + this.yScale.domain()[1]) / 2;

  const xRangeMid = (this.xScale.range()[0] + this.xScale.range()[1]) / 2;
  const yRangeMid = (this.yScale.range()[0] + this.yScale.range()[1]) / 2;

  const xMultiplier =
    (this.xScale.range()[1] - this.xScale.range()[0]) /
    (this.xScale.domain()[1] - this.xScale.domain()[0]);

  const yMultiplier =
    (this.yScale.range()[1] - this.yScale.range()[0]) /
    (this.yScale.domain()[1] - this.yScale.domain()[0]);

  // WebGL is column-major!
  // Transform from data space to stage space (same as applying this.xScale(),
  // and this.yScale())
  const dataScaleMatrix = [
    [xMultiplier, 0, -xMultiplier * xDomainMid + xRangeMid],
    [0, yMultiplier, -yMultiplier * yDomainMid + yRangeMid],
    [0, 0, 1]
  ];
  const dataScaleMatrix1D = dataScaleMatrix.flat();

  // Transforming the stage space to the normalized coordinate
  // Note we need to flip the y coordinate
  const normalizeMatrix = [
    [2 / this.svgFullSize.width, 0, -1],
    [0, -2 / this.svgFullSize.height, 1],
    [0, 0, 1]
  ];
  const normalizeMatrix1D = normalizeMatrix.flat();

  this.webGLMatrices = {
    dataScaleMatrix: dataScaleMatrix1D,
    normalizeMatrix: normalizeMatrix1D
  };
}

export function initWebGLBuffers(this: Embedding) {
  if (this.gridData === null) {
    throw Error('GridData is null.');
  }

  // Get the position and color of each point
  const positions: number[][] = [];
  const frontColors: number[][] = [];

  for (const point of this.promptPoints) {
    positions.push([point.x, point.y]);
    frontColors.push([0.2, 0.2, 0.2]);
  }

  this.frontPositionBuffer = this.pointRegl.buffer({
    length: this.gridData.totalPointSize * 4 * 2,
    type: 'float',
    usage: 'dynamic'
  });
  this.frontPositionBuffer.subdata(positions, 0);

  this.frontColorBuffer = this.pointRegl.buffer({
    length: this.gridData.totalPointSize * 4 * 3,
    type: 'float',
    usage: 'dynamic'
  });
  this.frontColorBuffer.subdata(frontColors, 0);

  this.bufferPointSize = this.promptPoints.length;
}

/**
 * Update WebGL buffers with stream data
 * @param this Embedding object
 * @param newPoints A list of loaded new points
 */
export function updateWebGLBuffers(this: Embedding, newPoints: PromptPoint[]) {
  // Get the position and color of each new point
  const positions: number[][] = [];
  const frontColors: number[][] = [];

  for (const point of newPoints) {
    positions.push([point.x, point.y]);
    frontColors.push([0.2, 0.2, 0.2]);
  }

  // Update the buffer using byte offsets
  this.frontPositionBuffer!.subdata(positions, this.bufferPointSize * 2 * 4);
  this.frontColorBuffer!.subdata(frontColors, this.bufferPointSize * 3 * 4);
  this.bufferPointSize += newPoints.length;
}

/**
 * Draw a scatter plot for the UMAP.
 */
export function drawScatterPlot(this: Embedding) {
  if (!this.webGLMatrices) {
    throw Error('webGLMatrices not initialized');
  }

  this.pointRegl.clear({
    color: [0, 0, 0, 0],
    depth: 1
  });

  // Get the current zoom
  const zoomMatrix = getZoomMatrix(this.curZoomTransform);
  const drawPoints = this.pointRegl({
    depth: { enable: false },
    stencil: { enable: false },
    frag: fragmentShader,
    vert: vertexShader,

    attributes: {
      position: {
        buffer: this.frontPositionBuffer,
        stride: 2 * 4,
        offset: 0
      },
      color: {
        buffer: this.frontColorBuffer,
        stride: 3 * 4,
        offset: 0
      }
    },

    uniforms: {
      // Placeholder for function parameters
      pointWidth: SCATTER_DOT_RADIUS,
      dataScaleMatrix: this.webGLMatrices.dataScaleMatrix,
      zoomMatrix: zoomMatrix,
      normalizeMatrix: this.webGLMatrices.normalizeMatrix,
      alpha: 1
    },

    count: this.bufferPointSize,
    primitive: 'points'
  });

  drawPoints();
}

/**
 * Update the highlight point's annotation during zooming
 */
export function updateHighlightPoint(this: Embedding) {
  if (this.hoverPoint === null) return;
  if (this.hoverMode !== 'point') return;
  if (!this.showPoint) return;

  // Draw the point on the top svg
  const group = this.topSvg.select('g.top-content g.highlights');
  const oldHighlightPoint = group.select('circle.highlight-point');

  // There is no point highlighted yet
  const highlightRadius = Math.max(
    (SCATTER_DOT_RADIUS * 3) / this.curZoomTransform.k,
    7 / this.curZoomTransform.k
  );
  const highlightStroke = 1.2 / this.curZoomTransform.k;

  oldHighlightPoint
    .attr('r', highlightRadius)
    .style('stroke-width', highlightStroke);

  updatePopperTooltip(
    this.tooltip,
    oldHighlightPoint.node()! as unknown as HTMLElement,
    this.hoverPoint
  );
}

/**
 * Highlight the point where the user hovers over
 * @param point The point that user hovers over
 */
export function highlightPoint(
  this: Embedding,
  point: PromptPoint | undefined
) {
  if (this.hoverMode !== 'point') return;
  if (!this.showPoint) return;
  if (point === this.hoverPoint) return;

  // Draw the point on the top svg
  const group = this.topSvg.select('g.top-content g.highlights');
  const oldHighlightPoint = group.select<SVGCircleElement>(
    'circle.highlight-point'
  );

  // Hovering empty space
  if (point === undefined) {
    if (pointMouseleaveTimer !== null) {
      clearTimeout(pointMouseleaveTimer);
      pointMouseleaveTimer = null;
    }

    if (pointMouseenterTimer !== null) {
      clearTimeout(pointMouseenterTimer);
      pointMouseenterTimer = null;
    }

    // Clear the highlight and tooltip in a short delay
    pointMouseleaveTimer = setTimeout(() => {
      this.hoverPoint = null;
      this.tooltip.classList.add('hidden');
      oldHighlightPoint.remove();
      pointMouseleaveTimer = null;
    }, 50);

    return;
  }

  // Hovering over a point
  this.hoverPoint = point;
  if (pointMouseleaveTimer !== null) {
    clearTimeout(pointMouseleaveTimer);
    pointMouseleaveTimer = null;
  }

  const highlightRadius = Math.max(
    (SCATTER_DOT_RADIUS * 3) / this.curZoomTransform.k,
    7 / this.curZoomTransform.k
  );
  const highlightStroke = 1.2 / this.curZoomTransform.k;
  let curHighlightPoint: d3.Selection<
    SVGCircleElement,
    unknown,
    null,
    undefined
  >;

  // There is no point highlighted yet
  if (oldHighlightPoint.empty()) {
    curHighlightPoint = group
      .append('circle')
      .attr('class', 'highlight-point')
      .attr('cx', this.xScale(point.x))
      .attr('cy', this.yScale(point.y))
      .attr('r', highlightRadius)
      .style('stroke-width', highlightStroke);
  } else {
    // There has been a highlighted point already
    curHighlightPoint = oldHighlightPoint
      .attr('cx', this.xScale(point.x))
      .attr('cy', this.yScale(point.y))
      .attr('r', highlightRadius)
      .style('stroke-width', highlightStroke);
  }

  updatePopperTooltip(
    this.tooltip,
    curHighlightPoint.node()! as unknown as HTMLElement,
    point
  );

  if (pointMouseenterTimer !== null) {
    clearTimeout(pointMouseenterTimer);
  }
  pointMouseenterTimer = setTimeout(() => {
    this.tooltip.classList.remove('hidden');
    pointMouseenterTimer = null;
  }, 300);
}

/**
 * Update the popper tooltip for the highlighted prompt point
 * @param tooltip Tooltip element
 * @param anchor Anchor point for the tooltip
 * @param point The prompt point
 */
const updatePopperTooltip = (
  tooltip: HTMLElement,
  anchor: HTMLElement,
  point: PromptPoint
) => {
  const arrowElement = tooltip.querySelector('#popper-arrow')! as HTMLElement;
  const contentElement = tooltip.querySelector(
    '#popper-content'
  )! as HTMLElement;
  contentElement.innerText = point.prompt;

  computePosition(anchor, tooltip, {
    placement: 'top',
    middleware: [offset(6), flip(), shift(), arrow({ element: arrowElement })]
  }).then(({ x, y, placement, middlewareData }) => {
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;

    const { x: arrowX, y: arrowY } = middlewareData.arrow!;
    let staticSide: 'bottom' | 'left' | 'top' | 'right' = 'bottom';
    if (placement.includes('top')) staticSide = 'bottom';
    if (placement.includes('right')) staticSide = 'left';
    if (placement.includes('bottom')) staticSide = 'top';
    if (placement.includes('left')) staticSide = 'right';

    arrowElement.style.left = arrowX ? `${arrowX}px` : '';
    arrowElement.style.top = arrowY ? `${arrowY}px` : '';
    arrowElement.style.right = '';
    arrowElement.style.bottom = '';
    arrowElement.style[staticSide] = '-4px';
  });
};

/**
 * Convert the current zoom transform into a matrix
 * @param zoomTransform D3 zoom transform
 * @returns 1D matrix
 */
const getZoomMatrix = (zoomTransform: d3.ZoomTransform) => {
  // Transforming the stage space based on the current zoom transform
  const zoomMatrix = [
    [zoomTransform.k, 0, zoomTransform.x],
    [0, zoomTransform.k, zoomTransform.y],
    [0, 0, 1]
  ];
  const zoomMatrix1D = zoomMatrix.flat();
  return zoomMatrix1D;
};
