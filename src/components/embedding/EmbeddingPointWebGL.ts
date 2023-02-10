import { config } from '../../config/config';
import { timeit, rgbToHex } from '../../utils/utils';
import d3 from '../../utils/d3-import';
import type { Embedding } from './Embedding';
import type { PromptPoint } from '../../types/embedding-types';
import fragmentShader from './shaders/fragment.glsl?raw';
import vertexShader from './shaders/vertex.glsl?raw';

const SCATTER_DOT_RADIUS = 0.7;
const SCATTER_BACK_DOT_RADIUS = 1;
const TAU = 2 * Math.PI;
const DEBUG = config.debug;

// let pointMouseleaveTimer: number | null = null;
// let pointMouseenterTimer: number | null = null;

interface ReglProps {
  pointWidth: number;
  stageWidth: number;
  stageHeight: number;
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

  for (const point of this.promptPoints) {
    const x = this.xScale(point.x);
    const y = this.yScale(point.y);
    const color = [0, 0, 0];

    positions.push([x, y]);
    colors.push(color);
  }

  console.log(positions.length);

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
      stageWidth: this.pointRegl.prop<ReglProps, 'stageWidth'>('stageWidth'),
      stageHeight: this.pointRegl.prop<ReglProps, 'stageHeight'>('stageHeight')
    },

    count: positions.length,

    primitive: 'points'
  });

  const myReglProps: ReglProps = {
    pointWidth: 3,
    stageWidth: this.xScale.range()[1] - this.xScale.range()[0],
    stageHeight: this.yScale.range()[0] - this.yScale.range()[1]
  };

  drawPoints(myReglProps);
}
