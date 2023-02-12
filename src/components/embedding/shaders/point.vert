precision highp float;

// Vertex variables from JS
attribute vec2 position;
attribute vec3 color;

// Constant values from JS
uniform float pointWidth;

// Teransform from the data space to the stage space
uniform mat3 dataScaleMatrix;

// Apply zoom transform to the stage coordinate
uniform mat3 zoomMatrix;

// Transform stage space to normalized divice coordinate
// (-1, -1) top left to (1, 1) bottom right
uniform mat3 normalizeMatrix;

uniform float alpha;

// Values sent to the fragment shader
varying vec3 fragColor;
varying float fragAlpha;

mat3 transformMatrix = dataScaleMatrix * zoomMatrix * normalizeMatrix;

void main() {
  fragColor = color;
  fragAlpha = alpha;

  // Scale the point based on the zoom level
  // https://observablehq.com/@bmschmidt/zoom-strategies-for-huge-scatterplots-with-three-js
  float dynamicSize = pointWidth * (exp(log(zoomMatrix[0][0]) * 0.55));

  gl_PointSize = dynamicSize;

  // Normalize the vertex position
  vec3 normalizedPosition = vec3(position, 1.0) * transformMatrix;
  gl_Position = vec4(normalizedPosition.x, normalizedPosition.y, 0.0, 1.0);
}