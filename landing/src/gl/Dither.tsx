import { useEffect, useRef } from "react";
import { voice } from "../lib/voice";

// Ordered-dither 3D scenes. Each canvas renders at 1/px resolution, so one
// fragment is one dither cell, and CSS scales it up with hard pixel edges.
// The scene is raymarched, shaded to a single value, then quantized onto a
// four-colour palette through an 8x8 Bayer matrix. WGSL on WebGPU, the same
// shader in GLSL on WebGL 2.
//
// scene 0: the voice orb (grooved sphere that swells with the voice)
// scene 1: a spectrogram landscape (frequency across, time coming towards you)
// scene 2: the orb inside a closed ring (the voice stays on the computer)

export type Scene = 0 | 1 | 2;
export type Layout = (w: number, h: number) => [cx: number, cy: number, r: number];

const WGSL = /* wgsl */ `
struct U {
  res: vec2f, mouse: vec2f, center: vec2f, cursor: vec2f,
  time: f32, level: f32, reveal: f32, pulse: f32, scene: f32, radius: f32, spin: f32, sky: f32,
  fade: f32, glow: f32, p1: f32, p2: f32,
  c0: vec4f, c1: vec4f, c2: vec4f, c3: vec4f,
}
@group(0) @binding(0) var<uniform> u: U;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}

fn bayer(p: vec2f) -> f32 {
  let x = u32(p.x) & 7u; let y = u32(p.y) & 7u; let v = x ^ y;
  let m = ((v & 1u) << 5u) | ((x & 1u) << 4u) | ((v & 2u) << 2u) | ((x & 2u) << 1u) | ((v & 4u) >> 1u) | ((x & 4u) >> 2u);
  return (f32(m) + 0.5) / 64.0;
}
fn rot(a: f32) -> mat2x2f { let c = cos(a); let s = sin(a); return mat2x2f(c, s, -s, c); }
fn rxz(p: vec3f, a: f32) -> vec3f { let r = rot(a) * p.xz; return vec3f(r.x, p.y, r.y); }
fn ryz(p: vec3f, a: f32) -> vec3f { let r = rot(a) * p.yz; return vec3f(p.x, r.x, r.y); }
fn rxy(p: vec3f, a: f32) -> vec3f { let r = rot(a) * p.xy; return vec3f(r.x, r.y, p.z); }

fn obj(p: vec3f) -> vec3f { return ryz(rxz(p, u.spin + (u.mouse.x - 0.5) * 0.9), 0.25 + (u.mouse.y - 0.5) * 0.5); }
fn orbD(p: vec3f) -> f32 {
  let o = obj(p);
  let R = 1.0 + 0.09 * exp(-u.pulse * 3.5) * sin(u.pulse * 16.0);
  let w = sin(o.x * 4.0 + u.time * 1.6) * sin(o.y * 4.5 + u.time * 1.25) * sin(o.z * 4.0 + u.time * 1.05);
  return length(p) - R - w * (0.025 + u.level * 0.17);
}
fn ringQ(p: vec3f) -> vec3f { return ryz(rxy(p, -0.18), 0.42); }
fn ringD(p: vec3f) -> f32 { let q = ringQ(p); return length(vec2f(length(q.xz) - 1.75, q.y)) - 0.02; }
fn map(p: vec3f) -> f32 { var d = orbD(p); if (u.scene > 1.5) { d = min(d, ringD(p)); } return d; }
fn nrm(p: vec3f) -> vec3f {
  let e = vec2f(0.002, -0.002);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

fn orbScene(fc: vec2f) -> vec2f {
  let c = u.center * u.res;
  let s = (fc - c) / (u.radius * u.res.y);
  let r = length(s);
  let fall = max(r - 1.0, 0.0);
  let cd = (fc - u.cursor * u.res) / u.res.y;
  let light = u.glow * exp(-dot(cd, cd) * 38.0);
  var base = 0.0;
  if (u.scene < 1.5) {
    // A dithered halo, and sound rings that stay clear of the headline and the demo controls.
    let mask = smoothstep(-1.4, -0.9, s.x) * (1.0 - smoothstep(0.45, 0.95, s.y));
    base = 0.667 + 0.1 * exp(-fall * 4.0) * mask;
    let ring = smoothstep(0.9, 1.0, sin(r * 7.0 - u.time * 1.5));
    base += ring * exp(-fall * 1.2) * (u.level * 0.4) * step(1.0, r) * mask;
    base += light;
  } else {
    base = 0.08 * exp(-fall * 1.8) + light;
  }
  var lim = 1.45;
  if (u.scene > 1.5) { lim = 2.1; }
  if (r > lim) { return vec2f(base, base); }
  let q = vec2f(s.x, -s.y) * 0.62;
  let ro = vec3f(0.0, 0.0, 3.4);
  let rd = normalize(vec3f(q, -2.0));
  var t = 1.6; var hit = -1.0;
  for (var i = 0; i < 64; i = i + 1) {
    let d = map(ro + rd * t);
    if (d < 0.0015) { hit = t; break; }
    t += d * 0.8;
    if (t > 6.0) { break; }
  }
  if (hit < 0.0) { return vec2f(base, base); }
  let p = ro + rd * hit;
  let n = nrm(p);
  let L = normalize(vec3f(-0.55 + (u.mouse.x - 0.5) * 1.4, 0.65 - (u.mouse.y - 0.5) * 1.2, 0.85));
  let dif = max(dot(n, L), 0.0);
  let h = normalize(L - rd);
  let spec = pow(max(dot(n, h), 0.0), 40.0);
  let rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  if (u.scene > 1.5 && ringD(p) < orbD(p)) {
    let rq = ringQ(p);
    let a = atan2(rq.z, rq.x);
    return vec2f(0.3 + 0.7 * smoothstep(0.7, 1.0, sin(a * 5.0 - u.time * 1.8)), base);
  }
  let o = obj(p);
  let lon = atan2(o.z, o.x);
  let groove = smoothstep(0.75, 1.0, sin(o.y * 24.0 + sin(lon * 5.0 + u.time * 3.0) * (0.4 + u.level * 4.0)));
  var v = 0.05 + 0.85 * dif + 0.55 * spec + 0.18 * rim - 0.16 * groove * (0.4 + dif);
  if (u.scene > 1.5) { v = v * 0.85; }
  return vec2f(v, base);
}

fn terr(xz: vec2f) -> f32 {
  let z = xz.y + u.time * 0.55; let x = xz.x;
  var h = 0.42 * exp(-(x + 0.9) * (x + 0.9) * 1.6) * (0.55 + 0.45 * sin(z * 1.6))
        + 0.32 * exp(-(x - 0.3) * (x - 0.3) * 2.2) * (0.5 + 0.5 * sin(z * 2.2 + 1.0))
        + 0.22 * exp(-(x - 1.3) * (x - 1.3) * 2.6) * (0.5 + 0.5 * sin(z * 2.9 + 2.0));
  h = h * (0.9 + u.level * 1.6);
  return h + 0.04 * sin(x * 3.1 + z * 0.7) * sin(z * 1.9);
}
fn terrScene(fc: vec2f) -> vec2f {
  let uv = fc / u.res;
  let q = vec2f((uv.x - 0.5) * u.res.x / u.res.y, 0.5 - uv.y);
  let base = u.sky;
  let ro = vec3f((u.mouse.x - 0.5) * 0.6, 0.95, -2.4);
  let rd = normalize(vec3f(q.x, q.y - 0.26, 1.2));
  var t = 0.3; var hit = false;
  for (var i = 0; i < 90; i = i + 1) {
    let p = ro + rd * t;
    let d = p.y - terr(p.xz);
    if (d < 0.003) { hit = true; break; }
    t += max(d * 0.45, 0.01);
    if (t > 14.0) { break; }
  }
  if (!hit) { return vec2f(base, base); }
  let p = ro + rd * t;
  let e = vec2f(0.01, 0.0);
  let n = normalize(vec3f(terr(p.xz - e.xy) - terr(p.xz + e.xy), 2.0 * e.x, terr(p.xz - e.yx) - terr(p.xz + e.yx)));
  let L = normalize(vec3f(-0.5, 0.8, -0.3));
  let dif = max(dot(n, L), 0.0);
  let slice = smoothstep(0.82, 1.0, sin((p.z + u.time * 0.55) * 14.0));
  let v = 0.06 + 0.5 * dif + 0.22 * n.y + 0.55 * slice * (0.45 + p.y * 1.3);
  let f = max(1.0 - exp(-t * 0.09), smoothstep(1.0 - u.fade, 1.0, uv.y));
  return vec2f(mix(v, base, f), base);
}

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let fc = pos.xy;
  var vb = vec2f(0.0);
  if (u.scene > 0.5 && u.scene < 1.5) { vb = terrScene(fc); } else { vb = orbScene(fc); }
  var v = vb.x;
  let b = bayer(fc);
  let rr = length(fc / u.res - u.center);
  if (b > u.reveal * 1.5 - rr * 0.5) { v = vb.y; }
  let idx = clamp(v, 0.0, 1.0) * 3.0;
  let i0 = floor(idx);
  let k = i0 + step(b, idx - i0);
  var col = u.c3;
  if (k < 0.5) { col = u.c0; } else if (k < 1.5) { col = u.c1; } else if (k < 2.5) { col = u.c2; }
  return vec4f(col.rgb, 1.0);
}`;

const GLSL_V = `#version 300 es
void main() { vec2 p[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0)); gl_Position = vec4(p[gl_VertexID], 0.0, 1.0); }`;

const GLSL_F = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 res, mouse, center, cursor;
uniform float time, level, reveal, pulse, scene, radius, spin, sky, fade, glow;
uniform vec4 c0, c1, c2, c3;
out vec4 o;

float bayer(vec2 p) {
  int x = int(p.x) & 7, y = int(p.y) & 7, v = x ^ y;
  int m = ((v & 1) << 5) | ((x & 1) << 4) | ((v & 2) << 2) | ((x & 2) << 1) | ((v & 4) >> 1) | ((x & 4) >> 2);
  return (float(m) + 0.5) / 64.0;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec3 rxz(vec3 p, float a) { vec2 r = rot(a) * p.xz; return vec3(r.x, p.y, r.y); }
vec3 ryz(vec3 p, float a) { vec2 r = rot(a) * p.yz; return vec3(p.x, r.x, r.y); }
vec3 rxy(vec3 p, float a) { vec2 r = rot(a) * p.xy; return vec3(r.x, r.y, p.z); }

vec3 obj(vec3 p) { return ryz(rxz(p, spin + (mouse.x - 0.5) * 0.9), 0.25 + (mouse.y - 0.5) * 0.5); }
float orbD(vec3 p) {
  vec3 o = obj(p);
  float R = 1.0 + 0.09 * exp(-pulse * 3.5) * sin(pulse * 16.0);
  float w = sin(o.x * 4.0 + time * 1.6) * sin(o.y * 4.5 + time * 1.25) * sin(o.z * 4.0 + time * 1.05);
  return length(p) - R - w * (0.025 + level * 0.17);
}
vec3 ringQ(vec3 p) { return ryz(rxy(p, -0.18), 0.42); }
float ringD(vec3 p) { vec3 q = ringQ(p); return length(vec2(length(q.xz) - 1.75, q.y)) - 0.02; }
float map(vec3 p) { float d = orbD(p); if (scene > 1.5) d = min(d, ringD(p)); return d; }
vec3 nrm(vec3 p) {
  vec2 e = vec2(0.002, -0.002);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

vec2 orbScene(vec2 fc) {
  vec2 c = center * res;
  vec2 s = (fc - c) / (radius * res.y);
  float r = length(s);
  float fall = max(r - 1.0, 0.0);
  vec2 cd = (fc - cursor * res) / res.y;
  float light = glow * exp(-dot(cd, cd) * 38.0);
  float base;
  if (scene < 1.5) {
    float mask = smoothstep(-1.4, -0.9, s.x) * (1.0 - smoothstep(0.45, 0.95, s.y));
    base = 0.667 + 0.1 * exp(-fall * 4.0) * mask;
    float ring = smoothstep(0.9, 1.0, sin(r * 7.0 - time * 1.5));
    base += ring * exp(-fall * 1.2) * (level * 0.4) * step(1.0, r) * mask;
    base += light;
  } else {
    base = 0.08 * exp(-fall * 1.8) + light;
  }
  float lim = scene > 1.5 ? 2.1 : 1.45;
  if (r > lim) return vec2(base);
  vec2 q = vec2(s.x, -s.y) * 0.62;
  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(q, -2.0));
  float t = 1.6, hit = -1.0;
  for (int i = 0; i < 64; i++) {
    float d = map(ro + rd * t);
    if (d < 0.0015) { hit = t; break; }
    t += d * 0.8;
    if (t > 6.0) break;
  }
  if (hit < 0.0) return vec2(base);
  vec3 p = ro + rd * hit;
  vec3 n = nrm(p);
  vec3 L = normalize(vec3(-0.55 + (mouse.x - 0.5) * 1.4, 0.65 - (mouse.y - 0.5) * 1.2, 0.85));
  float dif = max(dot(n, L), 0.0);
  vec3 h = normalize(L - rd);
  float spec = pow(max(dot(n, h), 0.0), 40.0);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  if (scene > 1.5 && ringD(p) < orbD(p)) {
    vec3 rq = ringQ(p);
    float a = atan(rq.z, rq.x);
    return vec2(0.3 + 0.7 * smoothstep(0.7, 1.0, sin(a * 5.0 - time * 1.8)), base);
  }
  vec3 ob = obj(p);
  float lon = atan(ob.z, ob.x);
  float groove = smoothstep(0.75, 1.0, sin(ob.y * 24.0 + sin(lon * 5.0 + time * 3.0) * (0.4 + level * 4.0)));
  float v = 0.05 + 0.85 * dif + 0.55 * spec + 0.18 * rim - 0.16 * groove * (0.4 + dif);
  if (scene > 1.5) v *= 0.85;
  return vec2(v, base);
}

float terr(vec2 xz) {
  float z = xz.y + time * 0.55, x = xz.x;
  float h = 0.42 * exp(-(x + 0.9) * (x + 0.9) * 1.6) * (0.55 + 0.45 * sin(z * 1.6))
          + 0.32 * exp(-(x - 0.3) * (x - 0.3) * 2.2) * (0.5 + 0.5 * sin(z * 2.2 + 1.0))
          + 0.22 * exp(-(x - 1.3) * (x - 1.3) * 2.6) * (0.5 + 0.5 * sin(z * 2.9 + 2.0));
  h *= 0.9 + level * 1.6;
  return h + 0.04 * sin(x * 3.1 + z * 0.7) * sin(z * 1.9);
}
vec2 terrScene(vec2 fc) {
  vec2 uv = fc / res;
  vec2 q = vec2((uv.x - 0.5) * res.x / res.y, 0.5 - uv.y);
  float base = sky;
  vec3 ro = vec3((mouse.x - 0.5) * 0.6, 0.95, -2.4);
  vec3 rd = normalize(vec3(q.x, q.y - 0.26, 1.2));
  float t = 0.3; bool hit = false;
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float d = p.y - terr(p.xz);
    if (d < 0.003) { hit = true; break; }
    t += max(d * 0.45, 0.01);
    if (t > 14.0) break;
  }
  if (!hit) return vec2(base);
  vec3 p = ro + rd * t;
  vec2 e = vec2(0.01, 0.0);
  vec3 n = normalize(vec3(terr(p.xz - e.xy) - terr(p.xz + e.xy), 2.0 * e.x, terr(p.xz - e.yx) - terr(p.xz + e.yx)));
  vec3 L = normalize(vec3(-0.5, 0.8, -0.3));
  float dif = max(dot(n, L), 0.0);
  float slice = smoothstep(0.82, 1.0, sin((p.z + time * 0.55) * 14.0));
  float v = 0.06 + 0.5 * dif + 0.22 * n.y + 0.55 * slice * (0.45 + p.y * 1.3);
  float f = max(1.0 - exp(-t * 0.09), smoothstep(1.0 - fade, 1.0, uv.y));
  return vec2(mix(v, base, f), base);
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 vb = (scene > 0.5 && scene < 1.5) ? terrScene(fc) : orbScene(fc);
  float v = vb.x;
  float b = bayer(fc);
  float rr = length(fc / res - center);
  if (b > reveal * 1.5 - rr * 0.5) v = vb.y;
  float idx = clamp(v, 0.0, 1.0) * 3.0;
  float i0 = floor(idx);
  float k = i0 + step(b, idx - i0);
  vec4 col = k < 0.5 ? c0 : k < 1.5 ? c1 : k < 2.5 ? c2 : c3;
  o = vec4(col.rgb, 1.0);
}`;

type Frame = { w: number; h: number; mx: number; my: number; cx: number; cy: number; ux: number; uy: number; t: number; level: number; reveal: number; pulse: number; scene: number; r: number; spin: number; sky: number; fade: number; glow: number; pal: number[] };
type Draw = (f: Frame) => void;

// One GPU device and one pipeline for every dither canvas on the page.
let gpu: Promise<{ device: GPUDevice; pipeline: GPURenderPipeline; format: GPUTextureFormat } | null> | null = null;
function gpuPipeline() {
  gpu ??= (async () => {
    if (!("gpu" in navigator)) return null;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();
    device.pushErrorScope("validation");
    const module = device.createShaderModule({ code: WGSL });
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vs" },
      fragment: { module, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
    const err = await device.popErrorScope();
    const info = await module.getCompilationInfo();
    if (err || info.messages.some(m => m.type === "error")) { console.warn("dither: WGSL failed, using WebGL", err ?? info.messages); return null; }
    return { device, pipeline, format };
  })().catch(() => null);
  return gpu;
}

async function webgpu(canvas: HTMLCanvasElement): Promise<Draw | null> {
  const g = await gpuPipeline();
  if (!g) return null;
  const ctx = canvas.getContext("webgpu");
  if (!ctx) return null;
  const { device, pipeline, format } = g;
  ctx.configure({ device, format, alphaMode: "opaque" });
  const ubuf = device.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const data = new Float32Array(36);
  return f => {
    data.set([f.w, f.h, f.mx, f.my, f.cx, f.cy, f.ux, f.uy, f.t, f.level, f.reveal, f.pulse, f.scene, f.r, f.spin, f.sky, f.fade, f.glow, 0, 0, ...f.pal]);
    device.queue.writeBuffer(ubuf, 0, data);
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(3); pass.end();
    device.queue.submit([enc.finish()]);
  };
}

function webgl(canvas: HTMLCanvasElement): Draw | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, GLSL_V));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, GLSL_F));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("dither: GLSL failed", gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  const L = (n: string) => gl.getUniformLocation(prog, n);
  const u = { res: L("res"), mouse: L("mouse"), center: L("center"), cursor: L("cursor"), fade: L("fade"), glow: L("glow"), time: L("time"), level: L("level"), reveal: L("reveal"), pulse: L("pulse"), scene: L("scene"), radius: L("radius"), spin: L("spin"), sky: L("sky"), c: [L("c0"), L("c1"), L("c2"), L("c3")] };
  return f => {
    gl.viewport(0, 0, f.w, f.h);
    gl.uniform2f(u.res, f.w, f.h); gl.uniform2f(u.mouse, f.mx, f.my); gl.uniform2f(u.center, f.cx, f.cy); gl.uniform2f(u.cursor, f.ux, f.uy);
    gl.uniform1f(u.fade, f.fade); gl.uniform1f(u.glow, f.glow);
    gl.uniform1f(u.time, f.t); gl.uniform1f(u.level, f.level); gl.uniform1f(u.reveal, f.reveal); gl.uniform1f(u.pulse, f.pulse);
    gl.uniform1f(u.scene, f.scene); gl.uniform1f(u.radius, f.r); gl.uniform1f(u.spin, f.spin); gl.uniform1f(u.sky, f.sky);
    u.c.forEach((loc, i) => gl.uniform4f(loc, f.pal[i * 4], f.pal[i * 4 + 1], f.pal[i * 4 + 2], 1));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1]; };

type Props = {
  scene: Scene;
  palette: [string, string, string, string];
  px?: number;
  layout?: Layout;
  sky?: number;
  idle?: number;
  /** Bottom share of a landscape that dissolves into the sky colour. */
  fade?: number;
  /** Strength of the dithered light that follows the pointer. */
  glow?: number;
  className?: string;
};

// The pointer, shared by every canvas, so each one can place it after a scroll.
const pointer = { x: -1e4, y: -1e4, on: false };
if (typeof window !== "undefined") {
  window.addEventListener("pointermove", e => { if (e.pointerType === "mouse") { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; } }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { pointer.on = false; });
}

export function Dither({ scene, palette, px = 3, layout = () => [0.5, 0.5, 0.3], sky = 0.62, idle = 0, fade = 0, glow = 0, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ palette, layout, sky, idle, px, fade, glow });
  opts.current = { palette, layout, sky, idle, px, fade, glow };

  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0, alive = true, draw: Draw | null = null, visible = false, shownAt = 0, last = performance.now();
    let spin = 0, doneAt = -1e9, phase = voice.phase;
    const mouse = { x: 0.5, y: 0.5, ux: -9, uy: -9, a: 0 };
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (v: number) => Math.max(-0.5, Math.min(1.5, v));
    const size = () => { const p = opts.current.px; canvas.width = Math.max(1, Math.ceil(canvas.clientWidth / p)); canvas.height = Math.max(1, Math.ceil(canvas.clientHeight / p)); };
    const ro = new ResizeObserver(size); ro.observe(canvas); size();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !shownAt) shownAt = performance.now(); }, { rootMargin: "120px" });
    io.observe(canvas);
    const t0 = performance.now();

    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!visible || !draw || document.hidden) return;
      const o = opts.current;
      const rect = canvas.getBoundingClientRect();
      const px = (pointer.x - rect.left) / rect.width, py = (pointer.y - rect.top) / rect.height;
      if (pointer.on) {
        mouse.x += (clamp(px) - mouse.x) * 0.05; mouse.y += (clamp(py) - mouse.y) * 0.05;
        if (mouse.ux < -8) { mouse.ux = px; mouse.uy = py; }
        mouse.ux += (px - mouse.ux) * 0.16; mouse.uy += (py - mouse.uy) * 0.16;
      }
      mouse.a += ((pointer.on ? 1 : 0) - mouse.a) * 0.06;
      if (voice.phase !== phase) { phase = voice.phase; if (phase === "done") doneAt = now; }
      const level = Math.max(voice.level, o.idle);
      spin += dt * (0.12 + (phase === "thinking" ? 2.4 : 0) + level * 0.8);
      const [cx, cy, r] = o.layout(canvas.clientWidth, canvas.clientHeight);
      const k = still ? 1 : Math.min(1, (now - shownAt) / 1800);
      draw({
        w: canvas.width, h: canvas.height, mx: still ? 0.5 : mouse.x, my: still ? 0.5 : mouse.y, cx, cy, r,
        ux: mouse.ux, uy: mouse.uy, fade: o.fade, glow: still ? 0 : o.glow * mouse.a,
        t: still ? 2 : (now - t0) / 1000, level: still ? 0 : level, reveal: 1 - Math.pow(1 - k, 3),
        pulse: (now - doneAt) / 1000, scene, spin: still ? 0.6 : spin, sky: o.sky, pal: o.palette.flatMap(hex),
      });
    };
    (async () => {
      try { draw = await webgpu(canvas); } catch { draw = null; }
      if (!draw) draw = webgl(canvas);
      if (draw) canvas.dataset.gl = "on";
      raf = requestAnimationFrame(loop);
    })();
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [scene]);

  return <canvas ref={ref} className={`dither ${className ?? ""}`} style={{ background: palette[2] }} aria-hidden="true" />;
}
