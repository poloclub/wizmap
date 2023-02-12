import d3 from '../../utils/d3-import';
import type {
  PromptPoint,
  UMAPPointStreamData,
  EmbeddingWorkerMessage
} from '../../types/embedding-types';
import {
  splitStreamTransform,
  parseJSONTransform,
  timeit
} from '../../utils/utils';
import { config } from '../../config/config';

const DEBUG = config.debug;
const POINT_THRESHOLD = 5000;

let pendingDataPoints: PromptPoint[] = [];
let loadedPointCount = 0;
let sentPointCount = 0;
const tree = d3
  .quadtree<PromptPoint>()
  .x(d => d.x)
  .y(d => d.y);

let lastDrawnPoints: PromptPoint[] | null = null;

/**
 * Handle message events from the main thread
 * @param e Message event
 */
self.onmessage = (e: MessageEvent<EmbeddingWorkerMessage>) => {
  // Stream point data
  switch (e.data.command) {
    case 'startLoadData': {
      console.log('Worker: start streaming data');
      timeit('Stream data', true);

      const url = e.data.payload.url;
      const xRange = e.data.payload.xRange;
      const yRange = e.data.payload.yRange;
      startLoadData(url, xRange, yRange);
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
 * Start loading the large UMAP data
 * @param url URL to the NDJSON file
 * @param xRange [xMin, xMax]
 * @param yRange [yMin, yMax]
 */
const startLoadData = (
  url: string,
  xRange: [number, number],
  yRange: [number, number]
) => {
  tree.cover(xRange[0], yRange[0]).cover(xRange[1], yRange[1]);

  fetch(url).then(async response => {
    if (!response.ok) {
      console.error('Failed to load data', response);
      return;
    }

    const reader = response.body
      ?.pipeThrough(new TextDecoderStream())
      ?.pipeThrough(splitStreamTransform('\n'))
      ?.pipeThrough(parseJSONTransform())
      ?.getReader();

    while (true && reader !== undefined) {
      const result = await reader.read();
      const point = result.value as UMAPPointStreamData;
      const done = result.done;

      if (done) {
        timeit('Stream data', DEBUG);
        pointStreamFinished();
        break;
      } else {
        processPointStream(point);

        // TODO: Remove me
        if (loadedPointCount >= 20300) {
          pointStreamFinished();
          timeit('Stream data', DEBUG);
          break;
        }
      }
    }
  });
};

/**
 * Process one data point
 * @param point Loaded data point
 */
const processPointStream = (point: UMAPPointStreamData) => {
  const promptPoint = {
    x: point[0],
    y: point[1],
    prompt: point[2],
    id: loadedPointCount
  };

  pendingDataPoints.push(promptPoint);
  loadedPointCount += 1;

  // Notify the main thread if we have load enough data
  if (pendingDataPoints.length >= POINT_THRESHOLD) {
    const result: EmbeddingWorkerMessage = {
      command: 'transferLoadData',
      payload: {
        isFirstBatch: lastDrawnPoints === null,
        isLastBatch: false,
        points: pendingDataPoints
      }
    };
    postMessage(result);

    // Add these points to the quadtree after sending them to the main thread
    for (const point of pendingDataPoints) {
      tree.add(point);
    }

    sentPointCount += pendingDataPoints.length;
    lastDrawnPoints = pendingDataPoints.slice();
    pendingDataPoints = [];
  }
};

/**
 * Construct tree and notify the main thread when finish reading all data
 */
const pointStreamFinished = () => {
  // Send any left over points

  const result: EmbeddingWorkerMessage = {
    command: 'transferLoadData',
    payload: {
      isFirstBatch: false,
      isLastBatch: true,
      points: pendingDataPoints
    }
  };
  postMessage(result);

  // Add these points to the quadtree after sending them to the main thread
  for (const point of pendingDataPoints) {
    tree.add(point);
  }

  sentPointCount += pendingDataPoints.length;
  lastDrawnPoints = pendingDataPoints.slice();
  pendingDataPoints = [];
};

const quadtreeSearch = (x: number, y: number) => {
  const closestPoint = tree.find(x, y);
  if (closestPoint === undefined) {
    throw Error('Quadtree find returns undefined.');
  }

  const result: EmbeddingWorkerMessage = {
    command: 'finishQuadtreeSearch',
    payload: {
      point: closestPoint
    }
  };
  postMessage(result);
};

/**
 * Resample data points in the view region
 * @param viewRange Current view range [xMin, xMax, yMin, yMax]
 */
// const startRefillRegion = (
//   viewRange: [number, number, number, number],
//   refillID: number
// ) => {
//   const results: PromptPoint[] = [];
//   const xMin = viewRange[0];
//   const xMax = viewRange[1];
//   const yMin = viewRange[2];
//   const yMax = viewRange[3];

//   tree.visit((node, x1, y1, x2, y2) => {
//     if (!node.length) {
//       // Leaves
//       let leaf = node as d3.QuadtreeLeaf<PromptPoint>;
//       const point = leaf.data;
//       if (
//         point.x >= xMin &&
//         point.x <= xMax &&
//         point.y >= yMin &&
//         point.y <= yMax
//       ) {
//         results.push(point);
//       }

//       while (leaf.next) {
//         leaf = leaf.next;
//         const point = leaf.data;
//         if (
//           point.x >= xMin &&
//           point.x <= xMax &&
//           point.y >= yMin &&
//           point.y <= yMax
//         ) {
//           results.push(point);
//         }
//       }
//     }
//     // Return true to terminate visiting a branch
//     return x1 >= xMax || y1 >= yMax || x2 < xMin || y2 < yMin;
//   });

//   // We have to visit all in-range nodes in the tree to spread out the sampled
//   // data to show on the canvas. We can use quickselect on the point ID to
//   // stably and randomly sample n points to draw.
//   d3.quickselect<PromptPoint>(
//     results,
//     Math.min(POINT_THRESHOLD, results.length - 1),
//     0,
//     results.length - 1,
//     (a, b) =>
//       (a as unknown as PromptPoint).id - (b as unknown as PromptPoint).id
//   );

//   const message: EmbeddingWorkerMessage = {
//     command: 'finishRefillRegion',
//     payload: {
//       points: results.slice(0, POINT_THRESHOLD),
//       refillID: refillID
//     }
//   };
//   postMessage(message);
//   lastDrawnPoints = results;
// };
