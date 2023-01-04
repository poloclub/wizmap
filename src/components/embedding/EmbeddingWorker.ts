import d3 from '../../utils/d3-import';
import type { UMAPPointStreamData, EmbeddingWorkerMessage } from '../my-types';
import {
  splitStreamTransform,
  parseJSONTransform,
  timeit
} from '../../utils/utils';
import { config } from '../../config/config';

const DEBUG = config.debug;
const dataPoints: UMAPPointStreamData[] = [];
const notification = {
  notified: false,
  threshold: 5000
};
let tree: d3.Quadtree<UMAPPointStreamData> | null = null;

self.onmessage = (e: MessageEvent<EmbeddingWorkerMessage>) => {
  // Stream point data
  if (e.data.command === 'startLoadData') {
    const url = e.data.payload.url;
    console.log('Worker: start streaming data');
    timeit('Stream data', true);

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

          if (dataPoints.length >= 40000) {
            timeit('Stream data', DEBUG);
            pointStreamFinished();
            break;
          }
        }
      }
    });
  }
};

const processPointStream = (point: UMAPPointStreamData) => {
  dataPoints.push(point);

  // Notify the main thread if we have load enough data for the first batch
  if (!notification.notified && dataPoints.length >= notification.threshold) {
    const result: EmbeddingWorkerMessage = {
      command: 'finishLoadData',
      payload: {
        isFirstBatch: true,
        points: dataPoints
      }
    };
    postMessage(result);
    notification.notified = true;
  }
};

const pointStreamFinished = () => {
  // Construct the tree
  timeit('Construct tree', DEBUG);
  tree = d3
    .quadtree<UMAPPointStreamData>()
    .x(d => d[0])
    .y(d => d[1])
    .addAll(dataPoints);
  timeit('Construct tree', DEBUG);

  const result: EmbeddingWorkerMessage = {
    command: 'finishLoadData',
    payload: {
      isFirstBatch: false,
      points: null
    }
  };
  postMessage(result);
};
