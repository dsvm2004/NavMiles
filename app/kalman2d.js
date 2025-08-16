// app/utils/kalman2d.js
import * as math from 'mathjs';

export default class Kalman2D {
  constructor(processNoise = 1, measurementNoise = 4) {
    // state: [lat, lon, vLat, vLon]
    this.x = math.zeros(4, 1);
    this.P = math.multiply(math.identity(4), 1e6);          // huge → trust 1st fix
    this.Q = math.multiply(math.identity(4), processNoise); // model noise
    this.R = math.multiply(math.identity(2), measurementNoise); // sensor noise
    this.lastT = null;
  }

  step(zLat, zLon, t) {
    if (!this.lastT) {
  this.x.set([0,0], zLat);
  this.x.set([1,0], zLon);
  this.lastT = t;
  return { lat: zLat, lon: zLon };
}

    const dt = (t - this.lastT) / 1000;           // ms → s
    this.lastT = t;

    /* ---------- PREDICT ---------- */
    const F = math.matrix([
      [1, 0, dt, 0],
      [0, 1, 0 , dt],
      [0, 0, 1 , 0 ],
      [0, 0, 0 , 1 ]
    ]);
    this.x = math.multiply(F, this.x);
    this.P = math.add(math.multiply(math.multiply(F, this.P), math.transpose(F)), this.Q);

    /* ---------- UPDATE ---------- */
    const z = math.matrix([[zLat], [zLon]]);
    const H = math.matrix([[1,0,0,0], [0,1,0,0]]);
    const y = math.subtract(z, math.multiply(H, this.x));
    const S = math.add(math.multiply(math.multiply(H, this.P), math.transpose(H)), this.R);
    const K = math.multiply(math.multiply(this.P, math.transpose(H)), math.inv(S));

    this.x = math.add(this.x, math.multiply(K, y));
    const I = math.identity(4);
    this.P = math.multiply(math.subtract(I, math.multiply(K, H)), this.P);

    return { lat: this.x.get([0,0]), lon: this.x.get([1,0]) };
  }
}
