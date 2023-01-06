/**
 * Types for the packing view.
 */

export interface PhraseTreeData {
  /**
   * Name of this phrase
   */
  n: string;

  /**
   * Count of this phrase across all documents
   */
  v: number;

  /**
   * Type of this phrase
   */
  l: string;

  /**
   * Other phrases including this phrase
   */
  c?: PhraseTreeData[];
}
