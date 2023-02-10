import { config } from '../../config/config';
import { timeit, rgbToHex } from '../../utils/utils';
import d3 from '../../utils/d3-import';
import type { Embedding } from './Embedding';
import type { PromptPoint } from '../../types/embedding-types';
import fragmentShader from './shaders/point.frag?raw';
import vertexShader from './shaders/point.vert?raw';

const SCATTER_DOT_RADIUS = 2;
const SCATTER_BACK_DOT_RADIUS = 1;
const TAU = 2 * Math.PI;
const DEBUG = config.debug;

// let pointMouseleaveTimer: number | null = null;
// let pointMouseenterTimer: number | null = null;

interface ReglProps {
  pointWidth: number;
  dataScaleMatrix: number[];
  zoomMatrix: number[];
  normalizeMatrix: number[];
}

/**
 * Draw a scatter plot for the UMAP on a canvas.
 */
export function drawScatterCanvas(this: Embedding) {
  if (!this.showPoint) throw Error('showPoint is not initialized');

  const r =
    (SCATTER_DOT_RADIUS * this.initZoomTransform.k) /
    Math.sqrt(this.curZoomTransform.k);

  // Get the position and color of each point
  const positions: number[][] = [];
  const colors: number[][] = [];

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

  // Transforming the stage space based on the current zoom transform
  const zoomMatrix = [
    [this.curZoomTransform.k, 0, this.curZoomTransform.x],
    [0, this.curZoomTransform.k, this.curZoomTransform.y],
    [0, 0, 1]
  ];
  const zoomMatrix1D = zoomMatrix.flat();

  // Transforming the stage space to the normalized coordinate
  // Note we need to flip the y coordinate
  const normalizeMatrix = [
    [2 / this.svgSize.width, 0, -1],
    [0, -2 / this.svgSize.height, 1],
    [0, 0, 1]
  ];
  const normalizeMatrix1D = normalizeMatrix.flat();

  for (const point of this.promptPoints) {
    const color = [0, 0, 0];

    positions.push([point.x, point.y]);
    colors.push(color);
  }

  const drawPoints = this.pointRegl({
    frag: fragmentShader,
    vert: vertexShader,

    attributes: {
      position: positions,
      color: colors
    },

    uniforms: {
      // Placeholder for function parameters
      pointWidth: this.pointRegl.prop<ReglProps, 'pointWidth'>('pointWidth'),
      dataScaleMatrix: this.pointRegl.prop<ReglProps, 'dataScaleMatrix'>(
        'dataScaleMatrix'
      ),
      zoomMatrix: this.pointRegl.prop<ReglProps, 'zoomMatrix'>('zoomMatrix'),
      normalizeMatrix: this.pointRegl.prop<ReglProps, 'normalizeMatrix'>(
        'normalizeMatrix'
      )
    },

    count: positions.length,

    primitive: 'points'
  });

  const myReglProps: ReglProps = {
    pointWidth: r,
    dataScaleMatrix: dataScaleMatrix1D,
    zoomMatrix: zoomMatrix1D,
    normalizeMatrix: normalizeMatrix1D
  };

  drawPoints(myReglProps);
}
