import { config } from '../../config/config';
import { timeit, rgbToHex } from '../../utils/utils';
import d3 from '../../utils/d3-import';
import { computePosition, flip, shift, offset, arrow } from '@floating-ui/dom';
import type { Embedding } from './Embedding';
import type { PromptPoint } from '../../types/embedding-types';
import fragmentShader from './shaders/point.frag?raw';
import vertexShader from './shaders/point.vert?raw';

const DEBUG = config.debug;

/**
 * @param this Embedding object
 */
export function timeSliderMouseDownHandler(this: Embedding, e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();

  const thumb = e.target! as HTMLElement;
  if (!thumb.id.includes('thumb')) {
    console.error('Thumb event target is not thumb itself.');
  }

  const eventBlocker = this.component.querySelector('.event-blocker')!;
  const thumbLabel = thumb.querySelector('.thumb-label-span');
  const track = thumb.parentElement!;
  const rangeTrack = track.querySelector('.range-track') as HTMLElement;

  const thumbBBox = thumb.getBoundingClientRect();
  const trackBBox = track.getBoundingClientRect();

  const trackWidth = trackBBox.width;

  const mouseMoveHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Block the mouse event outside the slider
    eventBlocker.classList.add('activated');

    const deltaX = e.pageX - trackBBox.x;
    const progress = Math.min(1, Math.max(0, deltaX / trackWidth));

    // Move the thumb
    thumb.setAttribute('data-curValue', String(progress));

    // Compute the position to move the thumb to
    const xPos = progress * trackBBox.width - thumbBBox.width / 2;
    thumb.style.left = `${xPos}px`;
    rangeTrack.style.width = `${xPos}px`;

    // Update the label
    thumbLabel!.textContent = String(progress);
  };

  const mouseUpHandler = () => {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    eventBlocker.classList.remove('activated');
    document.body.style.cursor = 'default';
  };

  // Listen to mouse move on the whole page (users can drag outside of the
  // thumb, track, or even WizMap!)
  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('mouseup', mouseUpHandler);
  document.body.style.cursor = 'grabbing';
}

export function initTopControlBar(this: Embedding) {
  // Initialize the time slider
  const timeSlider = d3.select(this.component).select('.time-menu .slider');

  timeSlider.select('.middle-thumb').on('mousedown', e => {
    this.timeSliderMouseDownHandler(e as MouseEvent);
  });
}
