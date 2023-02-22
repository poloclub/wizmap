import { config } from '../../config/config';
import { timeit, rgbToHex } from '../../utils/utils';
import d3 from '../../utils/d3-import';
import { computePosition, flip, shift, offset, arrow } from '@floating-ui/dom';
import type { Embedding } from './Embedding';
import type { PromptPoint } from '../../types/embedding-types';
import fragmentShader from './shaders/point.frag?raw';
import vertexShader from './shaders/point.vert?raw';

const DEBUG = config.debug;
let sliderAnimationStartTime: number | null = null;
let curSliderProgress = 0;

/**
 * Event handler for the thumb mouse down on time slider
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

/**
 * Move the thumb on the time slider
 * @param this Embedding
 * @param progress Slider progress
 */
export function moveTimeSliderThumb(this: Embedding, progress: number) {
  if (this.timeScale === null || this.timeFormatter === null) return;

  curSliderProgress = progress;

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
    progress * config.layout.timeSliderWidth
  );
  thumbLabel!.textContent = this.timeFormatter(curTime);
  this.curTime = this.timeFormatter(curTime);

  // Redraw the scatter plot
  if (this.showPoint) {
    if (this.frontPositionBuffer && this.frontTextureCoordinateBuffer) {
      this.drawScatterPlot();
    }
  }
}

/**
 * Initialize the top control bar
 * @param this Embedding
 */
export function initTopControlBar(this: Embedding) {
  if (this.timeScale) {
    // Initialize the time slider
    const timeMenu = d3.select(this.component).select('.time-menu');

    // Bind event handlers
    timeMenu.select('.middle-thumb').on('mousedown', e => {
      this.timeSliderMouseDownHandler(e as MouseEvent);
    });

    timeMenu.select('.play-pause-button').on('click', () => {
      if (this.playingTimeSlider) {
        this.playingTimeSlider = false;
        // Hide the thumb label
        d3.select(this.component)
          .select('.time-menu .middle-thumb')
          .classed('animating', false);
      } else {
        this.playingTimeSlider = true;
        sliderAnimationStartTime = null;
        this.startTimeSliderAnimation();
      }
      this.updateEmbedding();
    });

    // Initialize the slider label svg
    const labelSVG = d3.select(this.component).select('.time-menu .slider-svg');
    const axisGroup = labelSVG.append('g').attr('class', 'axis-group');
    axisGroup.call(d3.axisBottom(this.timeScale).ticks(5).tickSize(9));

    this.moveTimeSliderThumb(0);
  }
}

/**
 * Start to play the time slider animation
 * @param this Embedding
 */
export function startTimeSliderAnimation(this: Embedding) {
  const oneLoopMS = 5000;

  const loop = (timestamp: number) => {
    if (sliderAnimationStartTime === null) {
      // Fake the start time so that animation starts at the current progress
      const progressMS = curSliderProgress * oneLoopMS;
      sliderAnimationStartTime = timestamp - progressMS;
    }

    const elapsed = timestamp - sliderAnimationStartTime;
    let progress = elapsed / oneLoopMS;

    // Restart if we overshoot the slider
    if (progress > 1) {
      sliderAnimationStartTime = timestamp;
      progress = 0;
    }

    this.moveTimeSliderThumb(progress);

    if (this.playingTimeSlider) {
      window.requestAnimationFrame(loop);
    }
  };

  // Show the thumb label
  d3.select(this.component)
    .select('.time-menu .middle-thumb')
    .classed('animating', true);

  window.requestAnimationFrame(loop);
}
