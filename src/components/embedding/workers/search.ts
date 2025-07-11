import type * as Flexsearch from 'flexsearch';
import Index from 'flexsearch';
import { config } from '../../../config/config';
import type {
  PromptPoint,
  SearchWorkerMessage
} from '../../../types/embedding-types';
import d3 from '../../../utils/d3-import';
import { timeit } from '../../../utils/utils';

const index: Flexsearch.Index<string> = new Index() as Flexsearch.Index<string>;
const DEBUG = config.debug;

/**
 * Handle message events from the main thread
 * @param e Message event
 */
self.onmessage = (e: MessageEvent<SearchWorkerMessage>) => {
  // Stream point data
  switch (e.data.command) {
    case 'addPoints': {
      const { points, textKey } = e.data.payload;
      addPoints(points, textKey);
      break;
    }

    case 'startQuery': {
      const { query, queryID } = e.data.payload;
      searchPoint(query, queryID);
      break;
    }

    default: {
      console.error('Worker: unknown message', e.data);
      break;
    }
  }
};

/**
 * Add new points to the search index
 * @param points New points
 * @param textKey The key of the text field in the json point data. If it is not
 * set, we treat the entire prompt as the text
 */
const addPoints = (points: PromptPoint[], textKey: string | null) => {
  for (const point of points) {
    let prompt = point.prompt;
    if (textKey !== null) {
      try {
        const jsonData = JSON.parse(point.prompt) as Record<string, string>;
        prompt = jsonData[textKey];
      } catch (e) {
        console.error('Worker: failed to parse prompt', point.prompt);
        prompt = point.prompt;
      }
    }
    index.add(point.id, prompt);
  }
};

/**
 * Start a query
 * @param query Query string
 * @param queryID Query ID
 */
const searchPoint = (query: string, queryID: number) => {
  const resultIndexes = index.search(query, {
    limit: config.layout.searchLimit
  }) as unknown as number[];
  const message: SearchWorkerMessage = {
    command: 'finishQuery',
    payload: {
      queryID,
      resultIndexes
    }
  };
  postMessage(message);
};
