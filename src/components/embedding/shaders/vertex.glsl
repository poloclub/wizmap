// Vertex variables from JS
attribute vec2 position;
attribute vec3 color;

// Constant values from JS
uniform float pointWidth;
uniform float stageWidth;
uniform float stageHeight;

// Values sent to the fragment shader
varying vec3 fragColor;

// Helper function to transform stage space to normalized divice coordinate
// (-1, -1) top left to (1, 1) bottom right
vec2 normalizeCoordinates(vec2 position) {
  float x = position[0];
  float y = position[1];

  float nx = ((x / stageWidth) - 0.5) * 2.0;
  float ny = ((y / stageHeight) - 0.5) * 2.0;

  return vec2(nx, ny);
}

void main() {
  fragColor = color;

  gl_PointSize = pointWidth;

  // Normalize the vertex position
  vec2 normalizedPosition = normalizeCoordinates(position);
  gl_Position = vec4(normalizedPosition, 0.0, 1.0);
}