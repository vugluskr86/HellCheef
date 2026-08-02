// Минималистичный WebGL2-батчер спрайтов: один атлас, один шейдер, тинт на вершину.
import { ATLAS, CELL, COLS } from './atlas';

const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; in vec4 a_col;
uniform vec4 u_cam; // x,y = смещение камеры (мировые px), z,w = размер вьюпорта в мировых px
out vec2 v_uv; out vec4 v_col;
void main(){
  vec2 p = (a_pos - u_cam.xy) / u_cam.zw;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  v_uv = a_uv; v_col = a_col;
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 v_uv; in vec4 v_col;
uniform sampler2D u_tex;
out vec4 outColor;
void main(){
  vec4 t = texture(u_tex, v_uv);
  if (t.a < 0.02) discard;
  outColor = vec4(t.rgb * v_col.rgb, t.a * v_col.a);
}`;

const MAX = 8192; // спрайтов за батч
const FLOATS = 8; // x,y,u,v,r,g,b,a

export class Batch {
  gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private data = new Float32Array(MAX * 6 * FLOATS);
  private n = 0;
  private uCam: WebGLUniformLocation;
  private blend: 'normal' | 'add' = 'normal';
  vw = 320; vh = 200; camX = 0; camY = 0;

  constructor(canvas: HTMLCanvasElement, atlas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 недоступен: обнови браузер или включи аппаратное ускорение.');
    this.gl = gl;
    const sh = (t: number, src: string) => {
      const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    this.prog = p;
    gl.useProgram(p);
    this.uCam = gl.getUniformLocation(p, 'u_cam')!;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    const loc = (name: string) => gl.getAttribLocation(p, name);
    gl.enableVertexAttribArray(loc('a_pos')); gl.vertexAttribPointer(loc('a_pos'), 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc('a_uv')); gl.vertexAttribPointer(loc('a_uv'), 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(loc('a_col')); gl.vertexAttribPointer(loc('a_col'), 4, gl.FLOAT, false, stride, 16);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  begin(camX: number, camY: number, vw: number, vh: number) {
    const gl = this.gl;
    this.camX = camX; this.camY = camY; this.vw = vw; this.vh = vh;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.043, 0.027, 0.063, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.uniform4f(this.uCam, camX, camY, vw, vh);
    this.n = 0;
    this.setBlend('normal');
  }

  setBlend(mode: 'normal' | 'add') {
    if (mode === this.blend) return;
    this.flush();
    this.blend = mode;
    const gl = this.gl;
    if (mode === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  draw(slot: number, x: number, y: number, w: number, h: number, r = 1, g = 1, b = 1, a = 1) {
    if (this.n >= MAX) this.flush();
    const sx = (slot % COLS) * CELL / ATLAS, sy = Math.floor(slot / COLS) * CELL / ATLAS;
    const su = CELL / ATLAS, e = 0.0004;
    const u0 = sx + e, v0 = sy + e, u1 = sx + su - e, v1 = sy + su - e;
    const d = this.data; let o = this.n * 6 * FLOATS;
    const vert = (px: number, py: number, u: number, v: number) => {
      d[o++] = px; d[o++] = py; d[o++] = u; d[o++] = v; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    };
    vert(x, y, u0, v0); vert(x + w, y, u1, v0); vert(x, y + h, u0, v1);
    vert(x + w, y, u1, v0); vert(x + w, y + h, u1, v1); vert(x, y + h, u0, v1);
    this.n++;
  }

  flush() {
    if (!this.n) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 6 * FLOATS));
    gl.drawArrays(gl.TRIANGLES, 0, this.n * 6);
    this.n = 0;
  }

  end() { this.flush(); }
}
