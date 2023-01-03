// import d3 from '../../utils/d3-import';
// import type { UMAPPointStreamData, EmbeddingWorkerMessage } from '../my-types';
// import { splitStreamTransform, parseJSONTransform } from '../../utils/utils';

// importScripts('../../utils/d3-import');
// importScripts('../../utils/utils');

// importScripts()
importScripts('./d3-quadtree');

/** @typedef {import(../my-types).UMAPPointStreamData} UMAPPointStreamData */

const dataPoints = [];
const firstBatchNotification = {
  notified: false,
  threshold: 10000
};
let tree = null;

self.onmessage = e => {
  // Stream point data
  if (e.data.command === 'startLoadData') {
    const url = e.data.payload.url;
    console.log('Worker: start streaming data');
    console.time('Stream data');

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
        const point = result.value;
        const done = result.done;

        if (done) {
          console.timeEnd('Stream data');
          pointStreamFinished();
          break;
        } else {
          processPointStream(point);
        }
      }
    });
  }
};

const processPointStream = point => {
  dataPoints.push(point);

  // Notify the main thread if we have load enough data for the first batch
  if (
    !firstBatchNotification.notified &&
    dataPoints.length >= firstBatchNotification.threshold
  ) {
    const result = {
      command: 'finishLoadData',
      payload: {
        isFirstBatch: true,
        points: dataPoints
      }
    };
    postMessage(result);
    firstBatchNotification.notified = true;
  }
};

const pointStreamFinished = () => {
  console.time('Construct tree');

  tree = d3
    .quadtree()
    .x(d => d[0])
    .y(d => d[1])
    .addAll(dataPoints);

  console.timeEnd('Construct tree');

  const result = {
    command: 'finishLoadData',
    payload: {
      isFirstBatch: false,
      points: null
    }
  };
  postMessage(result);
};

/**
 * Split the reader stream text by a string
 * @param sep String used to separate the input string
 * @returns TransformStream
 */
const splitStreamTransform = sep => {
  let buffer = '';

  const transform = new TransformStream({
    transform: (chunk, controller) => {
      buffer += chunk;
      const parts = buffer.split(sep);
      parts.slice(0, -1).forEach(part => controller.enqueue(part));
      buffer = parts[parts.length - 1];
    },
    flush: controller => {
      if (buffer) {
        controller.enqueue(buffer);
      }
    }
  });

  return transform;
};

/**
 * Parse the input stream as JSON
 * @returns TransformStream
 */
const parseJSONTransform = () => {
  const transform = new TransformStream({
    transform: (chunk, controller) => {
      controller.enqueue(JSON.parse(chunk));
    }
  });
  return transform;
};
