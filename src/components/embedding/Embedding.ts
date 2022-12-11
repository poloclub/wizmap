import d3 from '../../utils/d3-import';
import type { PromptUMAPData } from '../my-types';

/**
 * Class for the Embedding view
 */

export class Embedding {
  component: HTMLElement;
  promptUMAPData: PromptUMAPData | null = null;

  /**
   *
   * @param args Named parameters
   * @param args.component The component
   */
  constructor({ component }: { component: HTMLElement }) {
    this.component = component;
    console.log('hello');

    this.initData();
  }

  async initData() {
    const result = await d3.json<PromptUMAPData>('/data/umap-50k.json');
    if (result !== undefined) {
      this.promptUMAPData = result;
    }
    console.log(this.promptUMAPData);
  }
}
