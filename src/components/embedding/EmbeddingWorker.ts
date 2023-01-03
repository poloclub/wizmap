import d3 from '../../utils/d3-import';
import type { UMAPPointStreamData, EmbeddingWorkerMessage } from '../my-types';
import { splitStreamTransform, parseJSONTransform } from '../../utils/utils';

const dataPoints: UMAPPointStreamData[] = [];
const firstBatchNotification = {
  notified: false,
  threshold: 10000
};
let tree: d3.Quadtree<UMAPPointStreamData> | null = null;

self.onmessage = (e: MessageEvent<EmbeddingWorkerMessage>) => {
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
        const point = result.value as UMAPPointStreamData;
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

const processPointStream = (point: UMAPPointStreamData) => {
  dataPoints.push(point);

  // Notify the main thread if we have load enough data for the first batch
  if (
    !firstBatchNotification.notified &&
    dataPoints.length >= firstBatchNotification.threshold
  ) {
    const result: EmbeddingWorkerMessage = {
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
    .quadtree<UMAPPointStreamData>()
    .x(d => d[0])
    .y(d => d[1])
    .addAll(dataPoints);

  console.timeEnd('Construct tree');

  const result: EmbeddingWorkerMessage = {
    command: 'finishLoadData',
    payload: {
      isFirstBatch: false,
      points: dataPoints
    }
  };
  postMessage(result);
};
