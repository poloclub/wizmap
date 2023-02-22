import d3 from '../../../utils/d3-import';
import type {
  PromptPoint,
  UMAPPointStreamData,
  TreeWorkerMessage
} from '../../../types/embedding-types';
import { timeit } from '../../../utils/utils';
import { config } from '../../../config/config';

const DEBUG = config.debug;

const groupTimeTreeMap = new Map<
  string,
  Map<string, d3.Quadtree<PromptPoint>>
>();

/**
 * Handle message events from the main thread
 * @param e Message event
 */
self.onmessage = (e: MessageEvent<TreeWorkerMessage>) => {
  // Stream point data
  switch (e.data.command) {
    case 'initQuadtree': {
      const { xRange, yRange, times, groups } = e.data.payload;
      initQuadtree(xRange, yRange, times, groups);
      break;
    }

    case 'updateQuadtree': {
      const points = e.data.payload.points;
      updateQuadtree(points);
      break;
    }

    case 'startQuadtreeSearch': {
      const { x, y, time, group } = e.data.payload;
      quadtreeSearch(x, y, time, group);
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
const initQuadtree = (
  xRange: [number, number],
  yRange: [number, number],
  times: string[],
  groups: string[]
) => {
  // Initialize the quadtree contains all the points (group = '', time = '')
  initTimeQuadtrees(xRange, yRange, '', ['']);

  // Initialize time trees if users have specified times in their embeddings
  if (times.length > 0) {
    if (groups.length > 0) {
      for (const group of groups) {
        initTimeQuadtrees(xRange, yRange, group, times);
      }
    }

    // Also create time trees cover all groups
    initTimeQuadtrees(xRange, yRange, '', times);
  }

  // Initialize group trees (these trees are special time trees with the
  // time key set to '')
  if (groups.length > 0) {
    for (const group of groups) {
      initTimeQuadtrees(xRange, yRange, group, ['']);
    }
  }

  // Notify the main thread
  const message: TreeWorkerMessage = {
    command: 'finishInitQuadtree',
    payload: null
  };
  postMessage(message);
};

const initTimeQuadtrees = (
  xRange: [number, number],
  yRange: [number, number],
  group: string,
  times: string[]
) => {
  // Find the correct time tree map under the group level
  let curTimeTreeMap: Map<string, d3.Quadtree<PromptPoint>>;

  if (groupTimeTreeMap.has(group)) {
    curTimeTreeMap = groupTimeTreeMap.get(group)!;
  } else {
    curTimeTreeMap = new Map<string, d3.Quadtree<PromptPoint>>();
    groupTimeTreeMap.set(group, curTimeTreeMap);
  }

  for (const time of times) {
    const curTree = d3
      .quadtree<PromptPoint>()
      .x(d => d.x)
      .y(d => d.y)
      .cover(xRange[0], yRange[0])
      .cover(xRange[1], yRange[1]);
    curTimeTreeMap.set(time, curTree);
  }
};

/**
 * Add new points to the quadtree
 * @param points New points
 */
const updateQuadtree = (points: PromptPoint[]) => {
  // Add these points to the quadtree after sending them to the main thread
  const allTree = groupTimeTreeMap.get('')!.get('')!;

  for (const point of points) {
    // Add the point to the tree containing all points
    allTree.add(point);

    // Add the point to the correct group tree and time tree maps
    if (point.time) {
      if (point.group) {
        if (
          groupTimeTreeMap.has(point.group) &&
          groupTimeTreeMap.get(point.group)!.has(point.time)
        ) {
          const curTree = groupTimeTreeMap.get(point.group)!.get(point.time)!;
          curTree.add(point);
        }
      }

      // Add the point to the time tree map regardless group
      if (groupTimeTreeMap.get('')!.has(point.time)!) {
        const curTree = groupTimeTreeMap.get('')!.get(point.time)!;
        curTree.add(point);
      }
    }

    // Add the point to the group tree regardless time
    if (point.group) {
      if (groupTimeTreeMap.has(point.group)) {
        const curTree = groupTimeTreeMap.get(point.group)!.get('')!;
        curTree.add(point);
      }
    }
  }
};

/**
 * Find the closest data point
 * @param x X coordinate in the data space
 * @param y Y coordinate in the data space
 * @returns The closest point to (x, y) in the quadtree
 */
const quadtreeSearch = (x: number, y: number, time: string, group: string) => {
  if (groupTimeTreeMap.has(group)) {
    if (groupTimeTreeMap.get(group)!.has(time)) {
      const curTree = groupTimeTreeMap.get(group)!.get(time)!;

      const closestPoint = curTree.find(x, y);
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
    }
  }
};
