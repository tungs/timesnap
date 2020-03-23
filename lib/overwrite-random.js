/**
 * BSD 3-Clause License
 *
 * Copyright (c) 2018-2020, Steve Tung
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * * Neither the name of the copyright holder nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// unrandomizer seed constants
// default seed values are only used if all of the seed values end up being 0
const defaultSeed1 = 10;
const defaultSeed2 = 20;
const defaultSeed3 = 0;
const defaultSeed4 = 0;
const seedIterations = 10;
const randomSeedLimit = 1000000000;

const overwriteRandom = function (page, unrandom, log) {
  if (unrandom === undefined || unrandom === false) {
    return;
  }
  var args, seed;
  if (Array.isArray(unrandom)) {
    args = unrandom;
  } else if (unrandom === 'random-seed') {
    seed = Math.floor(Math.random() * randomSeedLimit) + 1;
    log('Generated seed: ' + seed);
    args = [ seed ];
  } else if (typeof unrandom === 'string') {
    args = unrandom.split(',').map(n=>parseInt(n));
  } else if (typeof unrandom === 'number') {
    args = [ unrandom ];
  } else {
    args = [];
  }
  return overwritePageRandom(page, ...args);
};

const overwritePageRandom = function (page, seed1 = 0, seed2 = 0, seed3 = 0, seed4 = 0) {
  return page.evaluateOnNewDocument(function (config) {
    (function (exports) {
      let shift1 = 23;
      let shift2 = 17;
      let shift3 = 26;

      let state0 = new ArrayBuffer(8);
      let state1 = new ArrayBuffer(8);

      let state0SInts = new Int32Array(state0);
      let state1SInts = new Int32Array(state1);

      let state0UInt = new Uint32Array(state0);
      let state1UInt = new Uint32Array(state1);

      state0UInt[0] = config.seed1;
      state0UInt[1] = config.seed3;
      state1UInt[0] = config.seed2;
      state1UInt[1] = config.seed4;

      if (!state0SInts[0] && !state0SInts[1] && !state1SInts[0] && !state1SInts[1]) {
        // if the states are all zero, it does not advance to a new state
        // in this case, set the states to the default seeds
        state0UInt[0] = config.defaultSeed1;
        state0UInt[1] = config.defaultSeed3;
        state1UInt[0] = config.defaultSeed2;
        state1UInt[1] = config.defaultSeed4;
      }

      let _xorshift128 = function () {
        let xA = state1SInts[0];
        let xB = state1SInts[1];
        let yA = state0SInts[0];
        let yB = state0SInts[1];

        yA = yA ^ ((yA << shift1) | (yB >>> (32 - shift1)));
        yB = yB ^ (yB << shift1);

        yB = yB ^ ((yA << (32 - shift2)) | (yB >>> shift2));
        yA = yA ^ (yA >>> shift2);

        yA = yA ^ xA;
        yB = yB ^ xB;

        yB = yB ^ ((xA << (32 - shift3)) | (xB >>> shift3));
        yA = yA ^ (xA >>> shift3);

        state0SInts[0] = xA;
        state0SInts[1] = xB;
        state1SInts[0] = yA;
        state1SInts[1] = yB;
      };

      let byteLimit = Math.pow(2, 32);
      let mantissaLimit = Math.pow(2, 53);

      let _statesToDouble = function () {
        let aSum = state0UInt[0] + state1UInt[0];
        let bSum = state0UInt[1] + state1UInt[1];
        if (bSum >= byteLimit) {
          aSum = aSum + 1;
          bSum -= byteLimit;
        }
        aSum = aSum & 0x001FFFFF;
        return (aSum * byteLimit + bSum) / mantissaLimit;
      };

      for (let i = 0; i < config.seedIterations; i++) {
        _xorshift128();
      }

      // overwriting built-in functions...
      exports.Math.random = function () {
        _xorshift128();
        return _statesToDouble();
      };
    })(this);
  }, {
    seed1, seed2, seed3, seed4,
    defaultSeed1, defaultSeed2, defaultSeed3, defaultSeed4,
    seedIterations
  });
};


module.exports = {
  overwriteRandom
};