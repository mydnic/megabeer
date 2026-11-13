import type * as THREE from 'three';

/**
 * Diagnostic du rendu sur téléphone : une fois par chargement, le jeu envoie au serveur (/api/report, table
 * client_reports) ce qu'il faut pour comprendre un écran qui ne s'affiche pas sans avoir l'appareil en main : le
 * navigateur, la puce graphique et ses limites, les erreurs (JavaScript et compilation des shaders), et la couleur
 * de quelques pixels lus à l'écran pendant la chute puis au sol. Aucune donnée de compte.
 */
export function createDiagnostics(renderer: THREE.WebGLRenderer, enabled: boolean, extra: () => Record<string, unknown>) {
  const errors: string[] = [];
  const note = (s: string) => { if (errors.length < 40) errors.push(s.slice(0, 600)); };
  const samples: Record<string, unknown>[] = [];
  let want = '', sent = false;

  if (enabled) {
    addEventListener('error', (e) => note(`error: ${e.message} @ ${e.filename}:${e.lineno}`));
    addEventListener('unhandledrejection', (e) => note(`rejection: ${String(e.reason?.stack ?? e.reason)}`));
    const ce = console.error.bind(console);
    console.error = (...a: unknown[]) => { note(`console: ${a.map((x) => (x instanceof Error ? x.stack ?? x.message : String(x))).join(' ')}`); ce(...a); };
    // Shader qui ne compile pas : le message du pilote (le plus utile sur mobile)
    renderer.debug.onShaderError = (gl, program, vs, fs) => {
      note(`shader: program=${gl.getProgramInfoLog(program)} vs=${gl.getShaderInfoLog(vs)} fs=${gl.getShaderInfoLog(fs)}`);
    };
  }

  function device() {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    return {
      ua: navigator.userAgent, dpr: devicePixelRatio, screen: [innerWidth, innerHeight], pixelRatio: renderer.getPixelRatio(),
      webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      fragHighp: hp ? hp.precision : 0,
      maxFragUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS), maxVertUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxVaryings: gl.getParameter(gl.MAX_VARYING_VECTORS), maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxTexUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS), maxVertTexUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      ext: ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'OES_texture_float_linear', 'EXT_float_blend'].filter((e) => gl.getExtension(e)),
    };
  }

  function send() {
    if (sent) return;
    sent = true;
    const info = renderer.info;
    const body = JSON.stringify({
      device: device(), errors, samples, extra: extra(),
      render: { calls: info.render.calls, triangles: info.render.triangles, programs: info.programs?.length ?? 0, geometries: info.memory.geometries, textures: info.memory.textures },
    });
    void fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
  }

  return {
    /** Lit des pixels à la prochaine image (`label` : moment de la run). */
    sample(label: string) { if (enabled && !sent) want = label; },
    /** Juste après le rendu de l'image : lecture des pixels demandés. */
    afterRender() {
      if (!want) return;
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(4);
      const read = (fx: number, fy: number) => { gl.readPixels(Math.floor(w * fx), Math.floor(h * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [...px]; };
      samples.push({ at: want, buffer: [w, h], glError: gl.getError(), center: read(0.5, 0.5), low: read(0.5, 0.25), high: read(0.5, 0.85), left: read(0.15, 0.4), right: read(0.85, 0.4) });
      want = '';
    },
    send,
  };
}
