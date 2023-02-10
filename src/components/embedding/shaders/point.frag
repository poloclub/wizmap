precision highp float;

// Passed from the vertex shader
varying vec3 fragColor;

uniform float pointWidth;

float linearstep(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {
  float alpha = 1.0;

  // Only show the circle part of this point
  // https://observablehq.com/@rreusser/selecting-the-right-opacity-for-2d-point-clouds
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float sdf = length(c);
  alpha *= linearstep(pointWidth + 0.5, pointWidth - 0.5, sdf * pointWidth);

  gl_FragColor = vec4(fragColor, alpha);
}