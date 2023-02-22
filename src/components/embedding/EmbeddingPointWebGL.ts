import { config } from '../../config/config';
import { timeit, rgbToHex } from '../../utils/utils';
import d3 from '../../utils/d3-import';
import { updatePopperTooltip } from './EmbeddingLabel';
import type { Embedding } from './Embedding';
import type { PromptPoint } from '../../types/embedding-types';
import fragmentShader from './shaders/point.frag?raw';
import vertexShader from './shaders/point.vert?raw';

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
  const textureCoords: number[][] = [];

  for (const point of this.promptPoints) {
    positions.push([point.x, point.y]);
    textureCoords.push([0, 0]);
  }

  this.frontPositionBuffer = this.pointRegl.buffer({
    length: this.gridData.totalPointSize * 4 * 2,
    type: 'float',
    usage: 'dynamic'
  });
  this.frontPositionBuffer.subdata(positions, 0);

  this.frontTextureCoordinateBuffer = this.pointRegl.buffer({
    length: this.gridData.totalPointSize * 1 * 2,
    type: 'uint8',
    usage: 'dynamic'
  });
  this.frontTextureCoordinateBuffer.subdata(textureCoords, 0);

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
  const textureCoords: number[][] = [];

  for (const point of newPoints) {
    positions.push([point.x, point.y]);
    textureCoords.push([0, 0]);
  }

  // Update the buffer using byte offsets
  this.frontPositionBuffer!.subdata(positions, this.bufferPointSize * 2 * 4);
  this.frontTextureCoordinateBuffer!.subdata(
    textureCoords,
    this.bufferPointSize * 2 * 1
  );
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

  // Logarithmic regression by fitting the following three points
  // https://keisan.casio.com/exec/system/14059930226691
  // [(6e4, 2), (3e5, 1), [1.8e6, 0.5]]
  const a = 6.71682071;
  const b = -0.437974871;
  this.curPointWidth =
    a +
    b *
      Math.log(
        config.layout.scatterDotRadius *
          (this.svgFullSize.height / 760) *
          this.loadedPointCount
      );
  this.curPointWidth = Math.min(2, this.curPointWidth);

  // Get the current zoom
  const zoomMatrix = getZoomMatrix(this.curZoomTransform);

  // Create a texture array 4x2x2
  // [default color, transparent, empty, empty]
  const texture = this.pointRegl.texture({
    width: 2,
    height: 2,
    data: [
      config.layout.defaultPointColorInt[0],
      config.layout.defaultPointColorInt[1],
      config.layout.defaultPointColorInt[2],
      255,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    format: 'rgba'
  });

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
      textureCoord: {
        buffer: this.frontTextureCoordinateBuffer,
        stride: 2 * 1,
        offset: 0
      }
    },

    uniforms: {
      // Placeholder for function parameters
      pointWidth: this.curPointWidth,
      dataScaleMatrix: this.webGLMatrices.dataScaleMatrix,
      zoomMatrix: zoomMatrix,
      normalizeMatrix: this.webGLMatrices.normalizeMatrix,
      alpha: 1 / (Math.log(this.loadedPointCount) / Math.log(500)),
      texture: texture
    },

    blend: {
      enable: true,
      func: {
        srcRGB: 'one',
        srcAlpha: 'one',
        dstRGB: 'one minus src alpha',
        dstAlpha: 'one minus src alpha'
      }
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
  if (!this.showPoint) return;
  if (this.hideHighlights) return;

  // Draw the point on the top svg
  const group = this.topSvg.select('g.top-content g.highlights');
  const oldHighlightPoint = group.select('circle.highlight-point');

  // There is no point highlighted yet
  const highlightRadius = Math.max(
    10 / this.curZoomTransform.k,
    (this.curPointWidth * Math.exp(Math.log(this.curZoomTransform.k) * 0.55)) /
      this.curZoomTransform.k
  );
  const highlightStroke = 1.2 / this.curZoomTransform.k;

  oldHighlightPoint
    .attr('r', highlightRadius)
    .style('stroke-width', highlightStroke);

  updatePopperTooltip(
    this.tooltipTop,
    oldHighlightPoint.node()! as unknown as HTMLElement,
    this.hoverPoint.prompt,
    'top'
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
  if (!this.showPoint) return;
  if (point === this.hoverPoint) return;
  if (this.hideHighlights) return;

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
      this.tooltipTop.classList.add('hidden');
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
    10 / this.curZoomTransform.k,
    (this.curPointWidth * Math.exp(Math.log(this.curZoomTransform.k) * 0.55)) /
      this.curZoomTransform.k
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
    this.tooltipTop,
    curHighlightPoint.node()! as unknown as HTMLElement,
    point.prompt,
    'top'
  );

  if (pointMouseenterTimer !== null) {
    clearTimeout(pointMouseenterTimer);
  }
  pointMouseenterTimer = setTimeout(() => {
    this.tooltipTop.classList.remove('hidden');
    pointMouseenterTimer = null;
  }, 300);
}

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
