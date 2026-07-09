(function () {
  "use strict";

  var STORAGE_KEY = "herox-galactic-intro-played";
  var INTRO_DURATION = 4000;
  var FADE_DURATION = 1200;
  var BLOOM_DURATION = 2000;

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

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.body.classList.add("galactic-intro-active");
    sessionStorage.setItem(STORAGE_KEY, "true");
    setTimeout(function () {
      overlay.classList.add("is-closing");
      setTimeout(function () {
        overlay.remove();
        document.body.classList.remove("galactic-intro-active");
      }, 220);
    }, 900);
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

  // Monochrome charcoal atmosphere — journal ink, not neon
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
    "float noise(vec2 p) {\n" +
    "  vec2 i = floor(p);\n" +
    "  vec2 f = fract(p);\n" +
    "  float a = hash(i);\n" +
    "  float b = hash(i + vec2(1.0, 0.0));\n" +
    "  float c = hash(i + vec2(0.0, 1.0));\n" +
    "  float d = hash(i + vec2(1.0, 1.0));\n" +
    "  vec2 u = f * f * (3.0 - 2.0 * f);\n" +
    "  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;\n" +
    "}\n" +
    "\n" +
    "float fbm(vec2 p) {\n" +
    "  float v = 0.0;\n" +
    "  float a = 0.5;\n" +
    "  for (int i = 0; i < 4; i++) {\n" +
    "    v += a * noise(p);\n" +
    "    p = p * 2.02 + vec2(1.4, 8.3);\n" +
    "    a *= 0.5;\n" +
    "  }\n" +
    "  return v;\n" +
    "}\n" +
    "\n" +
    "void main() {\n" +
    "  vec2 uv =\n" +
    "    (gl_FragCoord.xy * 2.0 - resolution.xy)\n" +
    "    / min(resolution.x, resolution.y);\n" +
    "\n" +
    "  float progress = smoothstep(0.0, 1.0, introProgress);\n" +
    "  float t = time * 0.11;\n" +
    "\n" +
    "  // Almost still — editorial breath\n" +
    "  uv *= 1.02 - progress * 0.03;\n" +
    "\n" +
    "  float radius = length(uv);\n" +
    "\n" +
    "  // Soft charcoal fog layers\n" +
    "  vec2 p1 = uv * 1.15 + vec2(t * 0.07, -t * 0.05);\n" +
    "  vec2 p2 = uv * 1.85 + vec2(-t * 0.04, t * 0.06);\n" +
    "  float field = fbm(p1 + 0.55 * fbm(p2));\n" +
    "  field = smoothstep(0.18, 0.92, field);\n" +
    "\n" +
    "  float core = exp(-radius * 2.2);\n" +
    "  float mid = exp(-radius * 0.95) * 0.55;\n" +
    "  float falloff = smoothstep(1.7, 0.15, radius);\n" +
    "\n" +
    "  // Extremely sparse cool glints\n" +
    "  vec2 starUv = uv * 58.0 + vec2(t * 0.6, -t * 0.4);\n" +
    "  vec2 starCell = floor(starUv);\n" +
    "  vec2 starLocal = fract(starUv) - 0.5;\n" +
    "  float starSeed = hash(starCell);\n" +
    "  float stars = smoothstep(0.9978, 1.0, starSeed);\n" +
    "  stars *= smoothstep(0.28, 0.0, length(starLocal));\n" +
    "  stars *= 0.65 + 0.35 * sin(time * 0.7 + starSeed * 6.28);\n" +
    "  stars *= falloff;\n" +
    "\n" +
    "  // Palette: pure charcoal / cool slate / paper white only\n" +
    "  vec3 voidBlack = vec3(0.035, 0.035, 0.04);\n" +
    "  vec3 slate = vec3(0.16, 0.17, 0.2);\n" +
    "  vec3 mist = vec3(0.32, 0.33, 0.36);\n" +
    "  vec3 paper = vec3(0.9, 0.89, 0.86);\n" +
    "\n" +
    "  vec3 fog = mix(slate, mist, field);\n" +
    "  float glow = core * 0.55 + mid * field * 0.7 + stars * 0.55;\n" +
    "  glow *= 0.22 + progress * 0.78;\n" +
    "  glow *= falloff;\n" +
    "\n" +
    "  vec3 color = voidBlack;\n" +
    "  color += fog * glow;\n" +
    "  color += paper * core * 0.045;\n" +
    "  color += mist * pow(max(1.0 - radius, 0.0), 2.8) * 0.06;\n" +
    "\n" +
    "  // Micro grain — print texture, not digital noise\n" +
    "  float grain = (hash(gl_FragCoord.xy * 0.7 + floor(time * 8.0)) - 0.5) * 0.018;\n" +
    "  color += grain;\n" +
    "\n" +
    "  color = pow(max(color, 0.0), vec3(0.95));\n" +
    "  gl_FragColor = vec4(color, 1.0);\n" +
    "}\n";

  function getPixelRatio() {
    var isSmallScreen = window.innerWidth <= 768;
    var maxRatio = isSmallScreen ? 1.5 : 2;
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
    gl.clearColor(0.035, 0.035, 0.04, 1);

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
        Math.min(elapsed / BLOOM_DURATION, 1)
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

  function onSkipPointer() {
    closeIntro();
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
    overlay.removeEventListener("click", onSkipPointer);
    overlay.removeEventListener("touchstart", onSkipPointer);

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
  overlay.addEventListener("click", onSkipPointer);
  overlay.addEventListener("touchstart", onSkipPointer, { passive: true });

  initShader();
})();
