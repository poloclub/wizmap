import d3 from '../../../utils/d3-import';
import type {
  PromptPoint,
  UMAPPointStreamData,
  TreeWorkerMessage
} from '../../../types/embedding-types';
import { timeit } from '../../../utils/utils';
import { config } from '../../../config/config';

const DEBUG = config.debug;

const tree = d3
  .quadtree<PromptPoint>()
  .x(d => d.x)
  .y(d => d.y);

/**
 * Handle message events from the main thread
 * @param e Message event
 */
self.onmessage = (e: MessageEvent<TreeWorkerMessage>) => {
  // Stream point data
  switch (e.data.command) {
    case 'initQuadtree': {
      const { xRange, yRange } = e.data.payload;
      initQuadtree(xRange, yRange);
      break;
    }

    case 'updateQuadtree': {
      const points = e.data.payload.points;
      updateQuadtree(points);
      break;
    }

    case 'startQuadtreeSearch': {
      const { x, y } = e.data.payload;
      quadtreeSearch(x, y);
      break;
    }

    default: {
      console.error('Worker: unknown message', e.data.command);
      break;
    }
  }
};

/**
 * Initialize the quadtree
 * @param xRange [xMin, xMax]
 * @param yRange [yMin, yMax]
 */
const initQuadtree = (xRange: [number, number], yRange: [number, number]) => {
  tree.cover(xRange[0], yRange[0]).cover(xRange[1], yRange[1]);
};

/**
 * Add new points to the quadtree
 * @param points New points
 */
const updateQuadtree = (points: PromptPoint[]) => {
  // Add these points to the quadtree after sending them to the main thread
  for (const point of points) {
    tree.add(point);
  }
};

/**
 * Find the closest data point
 * @param x X coordinate in the data space
 * @param y Y coordinate in the data space
 * @returns The closest point to (x, y) in the quadtree
 */
const quadtreeSearch = (x: number, y: number) => {
  const closestPoint = tree.find(x, y);
  if (closestPoint === undefined) {
    return;
  }

  const result: TreeWorkerMessage = {
    command: 'finishQuadtreeSearch',
    payload: {
      point: closestPoint
    }
  };
  postMessage(result);
};
