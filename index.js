/**
 * BSD 3-Clause License
 *
 * Copyright (c) 2018-2019, Steve Tung
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

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const sprintf = require('sprintf-js').sprintf;
const defaultDuration = 5;
const defaultFPS = 60;

// unrandomizer seed constants
// default seed values are only used if all of the seed values end up being 0
const defaultSeed1 = 10;
const defaultSeed2 = 20;
const defaultSeed3 = 0;
const defaultSeed4 = 0;
const seedIterations = 10;
const randomSeedLimit = 1000000000;

const overwriteTime = function (page, animationFrameDuration) {
  return page.evaluateOnNewDocument(function (animationFrameDuration) {
    (function (exports) {
      var _virtualTime = (new Date()).getTime();
      var _startTime = _virtualTime;
      var _oldDate = Date;
      // a block is a segment of blocking code, wrapped in a function
      // to be run at a certain virtual time. They're created by
      // window.requestAnimationFrame, window.setTimeout, and window.setInterval
      var _pendingBlocks = [];
      var _intervals = {};
      var _idCount = 1;
      var _sortPendingBlocks = function () {
        _pendingBlocks = _pendingBlocks.sort(function (a, b) {
          if (a.time !== b.time) {
            return a.time - b.time;
          }
          return a.id - b.id;
        });
      };
      var _processNextBlock = function () {
        if (!_pendingBlocks.length) {
          return null;
        }
        _sortPendingBlocks();
        var block = _pendingBlocks.shift();
        _virtualTime = block.time;
        block.fn.apply(exports, block.args);
      };
      var _processUntilTime = function (ms) {
        _sortPendingBlocks();

        while (_pendingBlocks.length && _pendingBlocks[0].time <= _startTime + ms) {
          _processNextBlock();
          _sortPendingBlocks();
        }
        // TODO: maybe wait a little while for possible promises to resolve?
        _virtualTime = _startTime + ms;
      };
      var _setTimeout = function (fn, timeout, ...args) {
        var id = _idCount;
        var blockFn;
        if (fn instanceof Function) {
          blockFn = fn;
        } else {
          // according to https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout,
          // setTimeout should support evaluating strings as code, though it's not recommended
          blockFn = function () {
            eval(fn);
          };
        }
        if (!timeout || isNaN(timeout)) {
          // If timeout is 0, there may be an infinite loop
          // Changing it to 1 shouldn't disrupt code, because
          // setTimeout doesn't usually execute code immediately
          timeout = 1;
        }
        _pendingBlocks.push({
          time: timeout + _virtualTime,
          id: id,
          fn: blockFn,
          args: args
        });
        _idCount++;
        return id;
      };

      var _clearTimeout = function (id) {
        // according to https://developer.mozilla.org/en-US-docs/Web/API/WindowOrWorkerGlobalScope/setInterval,
        // setInterval and setTimeout share the same pool of IDs, and clearInterval and clearTimeout
        // can technically be used interchangeably
        var i = 0;
        if (_intervals[id]) {
          _intervals[id].clear();
        }
        while (i < _pendingBlocks.length) {
          if (_pendingBlocks[i].id === id) {
            _pendingBlocks.splice(i, 1);
          } else {
            i++;
          }
        }
      };

      var _frameTime;
      var _requestAnimationFrame = function (fn) {
        return _setTimeout(function () {
          // According to https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame,
          // the passed argument to the callback should be the starting time of the
          // chunk of requestAnimationFrame callbacks that are called for that particular frame.
          // Since the processing time of callbacks do not advance virtual time, in most cases
          // there may not be significant differences between _frameTime and _virtualTime.
          fn(_frameTime);
        }, animationFrameDuration);
      };

      var _updateFrameTime = function () {
        // Using this implementation may potentially cause issues in the future
        // for high-fps capture, where _frameTime is not advanced per frame
        _requestAnimationFrame(_updateFrameTime);
        _frameTime = _virtualTime;
      };
      _updateFrameTime();

      // overwriting built-in functions...
      exports.Date = class Date extends _oldDate {
        constructor() {
          if (!arguments.length) {
            super(_virtualTime);
          } else {
            super(...arguments);
          }
        }
      };
      exports.Date.now = exports.performance.now = function () {
        return _virtualTime;
      };
      exports.setTimeout = _setTimeout;
      exports.requestAnimationFrame = _requestAnimationFrame;
      exports.setInterval = function (fn, interval, ...args) {
        var lastCallId;
        var id = _idCount;
        var running = true;
        var intervalFn = function () {
          if (fn instanceof Function) {
            fn.apply(exports, args);
          } else {
            // according to https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setInterval,
            // setInterval should support evaluating strings as code, though it's not recommended
            eval(fn);
          }
          if (running) {
            lastCallId = _setTimeout(intervalFn, interval);
          }
        };
        _intervals[id] = {
          clear: function () {
            _clearTimeout(lastCallId);
            running = false;
          }
        };
        _idCount++;
        lastCallId = _setTimeout(intervalFn, interval);
        // according to https://developer.mozilla.org/en-US-docs/Web/API/WindowOrWorkerGlobalScope/setInterval,
        // setInterval and setTimeout share the same pool of IDs, and clearInterval and clearTimeout
        // can technically be used interchangeably
        return id;
      };
      exports.cancelAnimationFrame = _clearTimeout;
      exports.clearTimeout = _clearTimeout;
      exports.clearInterval = _clearTimeout;
      // exported custom functions
      exports._processNextBlock = _processNextBlock;
      exports._processUntilTime  = _processUntilTime;
    })(this);
  }, animationFrameDuration);
};

const overwriteRandom = function (page, seed1 = 0, seed2 = 0, seed3 = 0, seed4 = 0) {
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

const promiseLoop = function (condition, body) {
  var loop = function () {
    if (condition()) {
      return body().then(loop);
    }
  };
  return Promise.resolve().then(loop);
};

const getBrowserFrames = function (frame) {
  return [frame].concat(...frame.childFrames().map(getBrowserFrames));
};

const goToTime = function (browserFrames, time) {
  // Goes to a certain time. Can't go backwards
  return Promise.all(browserFrames.map(function (frame) {
    return frame.evaluate(function (ms) {
      window._processUntilTime(ms);
    }, time);
  }));
};

const getSelectorDimensions = function (page, selector) {
  return page.evaluate(function (selector) {
    var el = document.querySelector(selector);
    var dim = el.getBoundingClientRect();
    if (el) {
      return {
        left: dim.left,
        top: dim.top,
        right: dim.right,
        bottom: dim.bottom,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        x: dim.x,
        y: dim.y,
        width: dim.width,
        height: dim.height
      };
    }
  }, selector);
};

const makeFileDirectoryIfNeeded = function (filepath) {
  var dir = path.parse(filepath).dir, ind, currDir;
  var directories = dir.split(path.sep);
  for (ind = 1; ind <= directories.length; ind++) {
    currDir = directories.slice(0, ind).join(path.sep);
    if (currDir && !fs.existsSync(currDir)) {
      fs.mkdirSync(currDir);
    }
  }
};

module.exports = function (config) {
  config = Object.assign({}, config || {});
  var url = config.url || 'index.html';
  var delayMs = 1000 * (config.start || 0);
  var startWaitMs = 1000 * (config.startDelay || 0);
  var frameProcessor = config.frameProcessor;
  var frameNumToTime = config.frameNumToTime;
  var unrandom = config.unrandomize;
  var fps = config.fps, frameDuration;
  var framesToCapture;
  var outputPath = path.resolve(process.cwd(), (config.outputDirectory || './'));
  var animationFrameDuration;

  if (url.indexOf('://') === -1) {
    // assume it is a file path
    url = 'file://' + path.resolve(process.cwd(), url);
  }

  if (config.frames) {
    framesToCapture = config.frames;
    if (!fps) {
      if (config.duration) {
        fps = framesToCapture / config.duration;
      }
      else {
        fps = defaultFPS;
      }
    }
  } else {
    if (!fps) {
      fps = defaultFPS;
    }
    if (config.duration) {
      framesToCapture = config.duration * fps;
    } else {
      framesToCapture = defaultDuration * fps;
    }
  }

  frameDuration = 1000/fps;
  if (fps > 60) {
    animationFrameDuration = frameDuration;
  } else {
    animationFrameDuration = 1000/60;
  }

  if (!frameNumToTime) {
    frameNumToTime = function (frameCount) {
      return (frameCount-1) * frameDuration;
    };
  }

  var fileNameConverter = config.fileNameConverter;
  if (!fileNameConverter) {
    if (config.outputPattern) {
      fileNameConverter = function (num) {
        return sprintf(config.outputPattern, num);
      };
    } else if (frameProcessor && !config.outputDirectory) {
      fileNameConverter = function () {
        return undefined;
      };
    } else {
      fileNameConverter = function (num, maxNum) {
        var outputPattern = '%0' + maxNum.toString().length + 'd.png';
        return sprintf(outputPattern, num);
      };
    }
  }

  const log = function () {
    if (!config.quiet) {
      if (config.logToStdErr) {
        // eslint-disable-next-line no-console
        console.error.apply(this, arguments);
      } else {
        // eslint-disable-next-line no-console
        console.log.apply(this, arguments);
      }
    }
  };

  const launchOptions = {
    dumpio: !config.quiet && !config.logToStdErr,
    headless: (config.headless !== undefined ? config.headless : true),
    executablePath: config.executablePath,
    args: config.launchArguments || []
  };

  return puppeteer.launch(launchOptions).then(function (browser) {
    return browser.newPage().then(function (page) {
      return Promise.resolve().then(function () {
        if (config.viewport) {
          if (!config.viewport.width) {
            config.viewport.width = page.viewport().width;
          }
          if (!config.viewport.height) {
            config.viewport.height = page.viewport().height;
          }
          return page.setViewport(config.viewport);
        }
      }).then(function () {
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
        return overwriteRandom(page, ...args);
      }).then(function () {
        return overwriteTime(page, animationFrameDuration);
      }).then(function () {
        log('Going to ' + url + '...');
        return page.goto(url, { waitUntil: 'networkidle0' });
      }).then(function () {
        log('Page loaded');
        if ('preparePage' in config) {
          log('Prepare page before screenshot');
          return config.preparePage(page);
        }
      }).then(function () {
        log('Page loaded and prepared');
        return new Promise(function (resolve) {
          setTimeout(resolve, startWaitMs);
        });
      }).then(function () {
        if (config.selector) {
          return getSelectorDimensions(page, config.selector).then(function (dimensions) {
            if (!dimensions) {
              log('Warning: no element found for ' + config.selector);
              return;
            }
            return dimensions;
          });
        }
      }).then(function (dimensions) {
        var browserFrames = getBrowserFrames(page.mainFrame());
        var frameCount = 0;
        var viewport = page.viewport();
        var x = config.xOffset || config.left || 0;
        var y = config.yOffset || config.top || 0;
        var right = config.right || 0;
        var bottom = config.bottom || 0;
        var width;
        var height;
        if (dimensions) {
          width = config.width || (dimensions.width - x - right);
          height = config.height || (dimensions.height - y - bottom);
          x += dimensions.scrollX + dimensions.left;
          y += dimensions.scrollY + dimensions.top;
        } else {
          width = config.width || (viewport.width - x - right);
          height = config.height || (viewport.height - y - bottom);
        }
        width = Math.ceil(width);
        if (config.roundToEvenWidth && (width % 2 === 1)) {
          width++;
        }
        height = Math.ceil(height);
        if (config.roundToEvenHeight && (height % 2 === 1)) {
          height++;
        }
        var screenshotClip = {
          x: x,
          y: y,
          width: width,
          height: height
        };
        return promiseLoop(function () {
          return frameCount++ < framesToCapture;
        }, function () {
          return goToTime(browserFrames, delayMs + frameNumToTime(frameCount, framesToCapture)).then(function () {
            var fileName = fileNameConverter(frameCount, framesToCapture);
            var filePath;
            if (fileName) {
              filePath = path.resolve(outputPath, fileName);
              makeFileDirectoryIfNeeded(filePath);
            } else {
              filePath = undefined;
            }
            if (screenshotClip.height <= 0) {
              throw new Error('Capture height is ' + (screenshotClip.height < 0 ? 'negative!' : '0!'));
            }
            if (screenshotClip.width <= 0) {
              throw new Error('Capture width is ' + (screenshotClip.width < 0 ? 'negative!' : '0!'));
            }
            log('Capturing Frame ' + frameCount + (filePath ? ' to ' + filePath : '') + '...');
            return page.screenshot({
              path: filePath,
              clip: screenshotClip,
              omitBackground: config.transparentBackground ? true : false
            }).then(function (buffer) {
              if (frameProcessor) {
                return frameProcessor(buffer, frameCount, framesToCapture);
              }
            });
          });
        });
      });
    }).then(function () {
      return browser.close();
    }).catch(function (err) {
      log(err);
    });
  });
};