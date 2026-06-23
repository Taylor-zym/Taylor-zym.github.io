(function () {
  "use strict";

  var STORAGE_KEY = "herox-galactic-intro-played";
  var INTRO_DURATION = 3000;
  var FADE_DURATION = 800;
  var CDN_FAILSAFE_DURATION = 8000;

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

  var renderer, scene, camera, material, mesh, animId;
  var isClosing = false;
  var startTime = Date.now();
  var isTabHidden = document.hidden;
  var introTimer = null;
  var failsafeTimer = null;

  var shaderContainer = document.getElementById("galactic-shader");

  var vertexShader =
    "void main() {\n" +
    "  gl_Position = vec4(position, 1.0);\n" +
    "}\n";

  var fragmentShader =
    "precision highp float;\n" +
    "\n" +
    "uniform vec2 resolution;\n" +
    "uniform float time;\n" +
    "\n" +
    "vec3 getColor(float intensity) {\n" +
    "  vec3 color1 = vec3(1.0, 0.05, 0.25);\n" +
    "  vec3 color2 = vec3(1.0, 0.4, 0.0);\n" +
    "  vec3 color3 = vec3(1.0, 1.0, 0.0);\n" +
    "  vec3 color4 = vec3(0.1, 1.0, 0.1);\n" +
    "  vec3 color5 = vec3(0.2, 0.5, 1.0);\n" +
    "  vec3 color6 = vec3(0.7, 0.0, 1.0);\n" +
    "  vec3 color7 = vec3(1.0, 0.0, 0.7);\n" +
    "\n" +
    "  vec3 finalColor = color1;\n" +
    "  finalColor = mix(finalColor, color2, smoothstep(0.0, 0.17, intensity));\n" +
    "  finalColor = mix(finalColor, color3, smoothstep(0.17, 0.34, intensity));\n" +
    "  finalColor = mix(finalColor, color4, smoothstep(0.34, 0.51, intensity));\n" +
    "  finalColor = mix(finalColor, color5, smoothstep(0.51, 0.68, intensity));\n" +
    "  finalColor = mix(finalColor, color6, smoothstep(0.68, 0.85, intensity));\n" +
    "  finalColor = mix(finalColor, color7, smoothstep(0.85, 1.0, intensity));\n" +
    "\n" +
    "  return finalColor;\n" +
    "}\n" +
    "\n" +
    "void main() {\n" +
    "  vec2 uv =\n" +
    "    (gl_FragCoord.xy * 2.0 - resolution.xy)\n" +
    "    / min(resolution.x, resolution.y);\n" +
    "\n" +
    "  float t = time * 0.05;\n" +
    "  float lineWidth = 0.003;\n" +
    "\n" +
    "  float radius = length(uv);\n" +
    "  float angle = atan(uv.y, uv.x);\n" +
    "  float totalIntensity = 0.0;\n" +
    "\n" +
    "  for (int i = 0; i < 5; i++) {\n" +
    "    float spiralPattern = radius * 2.0 + angle * 0.5;\n" +
    "\n" +
    "    float denominator = abs(\n" +
    "      fract(t + float(i) * 0.02) * 5.0\n" +
    "      - spiralPattern\n" +
    "      + mod(uv.x + uv.y, 0.2)\n" +
    "    );\n" +
    "\n" +
    "    denominator = max(denominator, 0.0001);\n" +
    "\n" +
    "    totalIntensity +=\n" +
    "      lineWidth * float(i * i) / denominator;\n" +
    "  }\n" +
    "\n" +
    "  vec3 finalColor = getColor(\n" +
    "    fract(totalIntensity * 0.25 + t * 0.1)\n" +
    "  );\n" +
    "\n" +
    "  gl_FragColor = vec4(\n" +
    "    finalColor * totalIntensity,\n" +
    "    1.0\n" +
    "  );\n" +
    "}\n";

  function getPixelRatio() {
    var isSmallScreen = window.innerWidth <= 768;
    var maxRatio = isSmallScreen ? 1.5 : 2;
    return Math.min(window.devicePixelRatio || 1, maxRatio);
  }

  function initShader() {
    if (isClosing) return;

    if (typeof THREE === "undefined" || !shaderContainer) {
      closeIntro();
      return;
    }

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: false,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch (e) {
      closeIntro();
      return;
    }

    if (!renderer || !renderer.getContext()) {
      closeIntro();
      return;
    }

    var pixelRatio = getPixelRatio();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.setAttribute("aria-hidden", "true");
    shaderContainer.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.Camera();
    camera.position.z = 1;

    material = new THREE.ShaderMaterial({
      uniforms: {
        resolution: {
          value: new THREE.Vector2(
            window.innerWidth * pixelRatio,
            window.innerHeight * pixelRatio
          ),
        },
        time: { value: 0.0 },
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
    });

    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    try {
      renderer.render(scene, camera);
    } catch (e) {
      closeIntro();
      return;
    }

    startTime = Date.now();
    animate();
    introTimer = setTimeout(closeIntro, INTRO_DURATION);
  }

  function animate() {
    if (isClosing || !renderer || !material) return;

    if (!isTabHidden) {
      try {
        material.uniforms.time.value =
          (Date.now() - startTime) / 1000.0;
        renderer.render(scene, camera);
      } catch (e) {
        closeIntro();
        return;
      }
    }

    animId = requestAnimationFrame(animate);
  }

  function onResize() {
    if (!renderer || !material) return;

    var w = window.innerWidth;
    var h = window.innerHeight;
    var pixelRatio = getPixelRatio();

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h);
    material.uniforms.resolution.value.set(
      w * pixelRatio,
      h * pixelRatio
    );
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
    if (failsafeTimer) {
      clearTimeout(failsafeTimer);
      failsafeTimer = null;
    }
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    window.removeEventListener("resize", onResize);
    document.removeEventListener(
      "visibilitychange",
      onVisibilityChange
    );
    document.removeEventListener("keydown", onSkipKey);

    if (mesh && scene) {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      mesh = null;
    }
    if (material) {
      material.dispose();
      material = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
      renderer = null;
    }

    scene = null;
    camera = null;
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

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("keydown", onSkipKey);

  failsafeTimer = setTimeout(function () {
    if (!renderer) closeIntro();
  }, CDN_FAILSAFE_DURATION);

  var cdnUrls = [
    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
    "https://unpkg.com/three@0.128.0/build/three.min.js",
    "https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/three.js/r128/three.min.js"
  ];
  var cdnIndex = 0;

  function loadThreeJS() {
    if (isClosing) return;

    if (cdnIndex >= cdnUrls.length) {
      closeIntro();
      return;
    }

    var script = document.createElement("script");
    script.src = cdnUrls[cdnIndex];
    script.async = true;

    script.onload = function () {
      if (!isClosing) initShader();
    };

    script.onerror = function () {
      cdnIndex++;
      loadThreeJS();
    };

    document.head.appendChild(script);
  }

  loadThreeJS();
})();
