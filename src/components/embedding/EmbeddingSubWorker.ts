import d3 from '../../utils/d3-import';
import type {
  PromptUMAPData,
  Size,
  Padding,
  PromptPoint,
  GridData,
  QuadtreeNode,
  LevelTileDataItem,
  UMAPPointStreamData,
  LevelTileMap,
  TopicData,
  TopicDataJSON,
  Rect,
  DrawnLabel,
  LabelData,
  Direction,
  Point,
  EmbeddingWorkerMessage
} from '../my-types';
import { splitStreamTransform, parseJSONTransform } from '../../utils/utils';

const dataPoints: UMAPPointStreamData[] = [];

self.onmessage = (e: MessageEvent<EmbeddingWorkerMessage>) => {
  // Stream point data
  if (e.data.command === 'startLoadDataSub') {
    const url = e.data.payload.url;

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
          const result: EmbeddingWorkerMessage = {
            command: 'finishLoadDataSub',
            payload: {
              points: dataPoints
            }
          };
          postMessage(result);
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
};
