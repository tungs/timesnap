/**
 * BSD 3-Clause License
 *
 * Copyright (c) 2018-2022, Steve Tung
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

const { evaluateOnNewDocument } = require('./utils.js');
const fs = require('fs');
const path = require('path');

// unrandomizer seed constants
// default seed values are only used if all of the seed values end up being 0
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

const overwritePageRandom = async function (page, seed1 = 0, seed2 = 0, seed3 = 0, seed4 = 0) {
  const unrandomizeLib = fs.readFileSync(
    path.join(require.resolve('unrandomize/dist/unrandomize.js')),
    { encoding: 'utf8' }
  );
  await evaluateOnNewDocument(page, unrandomizeLib);
  await evaluateOnNewDocument(page, function ({ seed1, seed2, seed3, seed4, seedIterations }){
    (function (exports) {
      var i;
      exports.unrandomize.setState([ seed1, seed2, seed3, seed4 ]);
      for (i = 0; i < seedIterations; i++) {
        Math.random();
      }
    })(this);
  }, {
    seed1, seed2, seed3, seed4, seedIterations
  });
};


module.exports = {
  overwriteRandom
};