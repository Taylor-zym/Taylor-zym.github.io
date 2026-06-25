(function () {
  "use strict";

  var STORAGE_KEY = "herox-galactic-intro-played";
  var INTRO_DURATION = 3600;
  var FADE_DURATION = 950;

  var overlay = document.getElementById("galactic-intro");
  if (!overlay) return;

  function isHomepage() {
    var path = window.location.pathname.replace(/\/index\.html$/, "/");
    return path === "/";
  }

  function shouldShowIntro() {
    var forceShow =
      window.location.search.indexOf("galactic-debug") !== -1;

    return (
      isHomepage() &&
      (forceShow ||
        sessionStorage.getItem(STORAGE_KEY) !== "true")
    );
  }

  if (!shouldShowIntro()) {
    overlay.remove();
    return;
  }

  document.body.classList.add("galactic-intro-active");

  var canvas, gl, program, buffer, uniforms;
  var isClosing = false;
  var startTime = Date.now();
  var isTabHidden = document.hidden;
  var introTimer = null;
  var animId = null;

  var shaderContainer = document.getElementById("galactic-shader");

  var vertexShaderSource =
    "attribute vec2 position;\n" +
    "void main() {\n" +
    "  gl_Position = vec4(position, 0.0, 1.0);\n" +
    "}\n";

  var fragmentShaderSource =
    "precision highp float;\n" +
    "\n" +
    "uniform vec2 resolution;\n" +
    "uniform float time;\n" +
    "uniform float introProgress;\n" +
    "\n" +
    "float hash(vec2 p) {\n" +
    "  p = fract(p * vec2(123.34, 456.21));\n" +
    "  p += dot(p, p + 45.32);\n" +
    "  return fract(p.x * p.y);\n" +
    "}\n" +
    "\n" +
    "mat2 rotate2d(float a) {\n" +
    "  float s = sin(a);\n" +
    "  float c = cos(a);\n" +
    "  return mat2(c, -s, s, c);\n" +
    "}\n" +
    "\n" +
    "float softBand(float value, float center, float width) {\n" +
    "  float d = abs(value - center);\n" +
    "  return 1.0 - smoothstep(width, width + 0.05, d);\n" +
    "}\n" +
    "\n" +
    "void main() {\n" +
    "  vec2 uv =\n" +
    "    (gl_FragCoord.xy * 2.0 - resolution.xy)\n" +
    "    / min(resolution.x, resolution.y);\n" +
    "\n" +
    "  float progress = smoothstep(0.0, 1.0, introProgress);\n" +
    "  float t = time * 0.32;\n" +
    "  uv *= 1.08 - progress * 0.1;\n" +
    "  uv = rotate2d(0.08 * sin(t * 0.8)) * uv;\n" +
    "\n" +
    "  float radius = length(uv);\n" +
    "  float angle = atan(uv.y, uv.x);\n" +
    "  float falloff = smoothstep(1.55, 0.04, radius);\n" +
    "  float core = exp(-radius * 3.8);\n" +
    "  float arms = 0.0;\n" +
    "\n" +
    "  for (int i = 0; i < 4; i++) {\n" +
    "    float fi = float(i);\n" +
    "    float phase = fi * 1.57 + t * (0.72 + fi * 0.05);\n" +
    "    float spiral = sin(angle * 3.0 + radius * (7.2 + fi * 0.9) - phase);\n" +
    "    float band = softBand(spiral, 0.76, 0.1 + radius * 0.025);\n" +
    "    arms += band * (1.0 - radius * 0.38);\n" +
    "  }\n" +
    "\n" +
    "  arms = max(arms, 0.0) * falloff;\n" +
    "\n" +
    "  vec2 dustUv = uv * 86.0 + vec2(t * 4.0, -t * 3.0);\n" +
    "  vec2 dustCell = floor(dustUv);\n" +
    "  vec2 dustLocal = fract(dustUv) - 0.5;\n" +
    "  float dustSeed = hash(dustCell);\n" +
    "  float dust = smoothstep(0.998, 1.0, dustSeed);\n" +
    "  dust *= smoothstep(0.28, 0.0, length(dustLocal));\n" +
    "  dust *= 0.5 + 0.5 * sin(time * 2.4 + dustSeed * 6.28);\n" +
    "  dust *= falloff;\n" +
    "\n" +
    "  vec3 deepSpace = vec3(0.005, 0.014, 0.04);\n" +
    "  vec3 blue = vec3(0.08, 0.35, 1.0);\n" +
    "  vec3 azure = vec3(0.0, 0.7, 1.0);\n" +
    "  vec3 cobalt = vec3(0.18, 0.18, 0.95);\n" +
    "  vec3 ice = vec3(0.72, 0.92, 1.0);\n" +
    "\n" +
    "  vec3 nebula = mix(blue, azure, smoothstep(-0.75, 0.85, sin(angle + t)));\n" +
    "  nebula = mix(nebula, cobalt, smoothstep(0.18, 0.95, arms));\n" +
    "  nebula = mix(nebula, ice, core * 0.72);\n" +
    "  float glow = core * 1.25 + arms * 0.68 + dust * 1.6;\n" +
    "  glow *= 0.12 + progress * 0.88;\n" +
    "  glow *= 1.0 - smoothstep(1.1, 1.75, radius);\n" +
    "\n" +
    "  vec3 color = deepSpace + nebula * glow;\n" +
    "  color += vec3(0.03, 0.11, 0.24) * pow(1.0 - min(radius, 1.0), 2.0);\n" +
    "  color = pow(color, vec3(0.86));\n" +
    "  gl_FragColor = vec4(color, 1.0);\n" +
    "}\n";

  function getPixelRatio() {
    var isSmallScreen = window.innerWidth <= 768;
    var maxRatio = isSmallScreen ? 1.75 : 2.25;
    return Math.min(window.devicePixelRatio || 1, maxRatio);
  }

  function compileShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function createProgram() {
    var vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    var fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return null;

    var nextProgram = gl.createProgram();
    gl.attachShader(nextProgram, vertexShader);
    gl.attachShader(nextProgram, fragmentShader);
    gl.linkProgram(nextProgram);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
      gl.deleteProgram(nextProgram);
      return null;
    }

    return nextProgram;
  }

  function resizeCanvas() {
    if (!canvas || !gl) return;

    var pixelRatio = getPixelRatio();
    var width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
    var height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    if (uniforms && uniforms.resolution) {
      gl.uniform2f(uniforms.resolution, width, height);
    }
  }

  function initShader() {
    if (isClosing || !shaderContainer) {
      closeIntro();
      return;
    }

    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    gl =
      canvas.getContext("webgl", {
        alpha: false,
        antialias: true,
        powerPreference: "high-performance",
      }) ||
      canvas.getContext("experimental-webgl", {
        alpha: false,
        antialias: true,
      });

    if (!gl) {
      closeIntro();
      return;
    }

    program = createProgram();
    if (!program) {
      closeIntro();
      return;
    }

    shaderContainer.appendChild(canvas);
    gl.useProgram(program);
    gl.clearColor(0.008, 0.012, 0.035, 1);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    var position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    uniforms = {
      resolution: gl.getUniformLocation(program, "resolution"),
      time: gl.getUniformLocation(program, "time"),
      introProgress: gl.getUniformLocation(program, "introProgress"),
    };

    resizeCanvas();
    startTime = Date.now();
    animate();
    introTimer = setTimeout(closeIntro, INTRO_DURATION);
  }

  function animate() {
    if (isClosing || !gl || !program) return;

    if (!isTabHidden) {
      var elapsed = Date.now() - startTime;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniforms.time, elapsed / 1000.0);
      gl.uniform1f(
        uniforms.introProgress,
        Math.min(elapsed / 1400, 1)
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    animId = requestAnimationFrame(animate);
  }

  function onVisibilityChange() {
    isTabHidden = document.hidden;
  }

  function onSkipKey(e) {
    if (e.key === "Escape") closeIntro();
  }

  function destroyShader() {
    if (introTimer) {
      clearTimeout(introTimer);
      introTimer = null;
    }
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    window.removeEventListener("resize", resizeCanvas);
    document.removeEventListener(
      "visibilitychange",
      onVisibilityChange
    );
    document.removeEventListener("keydown", onSkipKey);

    if (gl) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      var loseContext = gl.getExtension("WEBGL_lose_context");
      if (loseContext) loseContext.loseContext();
    }

    if (canvas) canvas.remove();

    canvas = null;
    gl = null;
    program = null;
    buffer = null;
    uniforms = null;
  }

  function closeIntro() {
    if (isClosing) return;
    isClosing = true;

    sessionStorage.setItem(STORAGE_KEY, "true");
    overlay.classList.add("is-closing");

    setTimeout(function () {
      destroyShader();
      overlay.remove();
      document.body.classList.remove("galactic-intro-active");
    }, FADE_DURATION);
  }

  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("keydown", onSkipKey);

  initShader();
})();