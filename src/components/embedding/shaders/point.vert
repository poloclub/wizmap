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

uniform bool isBackPoint;

// Values sent to the fragment shader
varying vec3 fragColor;

mat3 transformMatrix = dataScaleMatrix * zoomMatrix * normalizeMatrix;

void main() {
  fragColor = color;

  // Scale the point based on the zoom level
  float dynamicSize = pointWidth * (exp(log(zoomMatrix[0][0]) * 0.5));


  if (isBackPoint) {
    // Trick: here we draw a slightly larger circle when user zooms out the
    // viewpoint, so that the pixel coverage is higher (smoother/better
    // mouseover picking)
    gl_PointSize = max(8.0, dynamicSize);
  } else {
    gl_PointSize = dynamicSize;
  }


  // Normalize the vertex position
  vec3 normalizedPosition = vec3(position, 1.0) * transformMatrix;
  gl_Position = vec4(normalizedPosition.x, normalizedPosition.y, 0.0, 1.0);
}