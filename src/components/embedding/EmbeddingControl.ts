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

  const eventBlocker = this.component.querySelector('.grab-blocker')!;
  const track = thumb.parentElement!;
  const rangeTrack = track.querySelector('.range-track') as HTMLElement;

  const thumbBBox = thumb.getBoundingClientRect();
  const trackBBox = track.getBoundingClientRect();

  const trackWidth = trackBBox.width;

  const mouseMoveHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.timeScale === null || this.timeFormatter === null) return;

    // Block the mouse event outside the slider
    eventBlocker.classList.add('activated');

    const deltaX = e.pageX - trackBBox.x;
    const progress = Math.min(1, Math.max(0, deltaX / trackWidth));

    // Move the thumb
    thumb.setAttribute('data-curValue', String(progress));

    // Compute the position to move the thumb to
    const xPos = progress * trackBBox.width - thumbBBox.width / 2;
    thumb.style.left = `${xPos}px`;
    rangeTrack.style.width = `${Math.max(0, xPos)}px`;

    // Update the label
    this.moveTimeSliderThumb(progress);
  };

  const mouseUpHandler = () => {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    eventBlocker.classList.remove('activated');
  };

  // Listen to mouse move on the whole page (users can drag outside of the
  // thumb, track, or even WizMap!)
  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('mouseup', mouseUpHandler);
}

export function moveTimeSliderThumb(this: Embedding, progress: number) {
  if (this.timeScale === null || this.timeFormatter === null) return;

  const thumb = this.component.querySelector(
    '.time-menu .middle-thumb'
  ) as HTMLElement;
  const thumbLabel = thumb.querySelector('.thumb-label-span');
  const track = thumb.parentElement!;
  const rangeTrack = track.querySelector('.range-track') as HTMLElement;

  const thumbBBox = thumb.getBoundingClientRect();
  const trackBBox = track.getBoundingClientRect();

  // Compute the position to move the thumb to
  const xPos = progress * trackBBox.width - thumbBBox.width / 2;
  thumb.style.left = `${xPos}px`;
  rangeTrack.style.width = `${Math.max(0, xPos)}px`;

  // Update the label
  const curTime = this.timeScale.invert(
    progress * config.layout.searchPanelWidth
  );
  thumbLabel!.textContent = this.timeFormatter(curTime);
}

export function initTopControlBar(this: Embedding) {
  if (this.timeScale) {
    // Initialize the time slider
    const timeSlider = d3.select(this.component).select('.time-menu .slider');

    timeSlider.select('.middle-thumb').on('mousedown', e => {
      this.timeSliderMouseDownHandler(e as MouseEvent);
    });

    // Initialize the slider label svg
    const labelSVG = d3.select(this.component).select('.time-menu .slider-svg');
    const axisGroup = labelSVG.append('g').attr('class', 'axis-group');
    axisGroup.call(d3.axisBottom(this.timeScale).ticks(5).tickSize(9));

    this.moveTimeSliderThumb(0);
  }
}
