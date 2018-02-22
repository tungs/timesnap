/**
 * BSD 3-Clause License
 *
 * Copyright (c) 2018, Steve Tung
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
        if (!timeout || isNaN(timeout)) {
          // If timeout is 0, there may be an infinite loop
          // Changing it to 1 shouldn't disrupt code, because
          // setTimeout doesn't usually execute code immediately
          timeout = 1;
        }
        _pendingBlocks.push({
          time: timeout + _virtualTime,
          id: id,
          fn: fn,
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
      exports.requestAnimationFrame = function (fn) {
        return _setTimeout(fn, animationFrameDuration);
      };
      exports.setInterval = function (fn, interval, ...args) {
        var lastCallId;
        var id = _idCount;
        var running = true;
        var intervalFn = function () {
          fn.apply(exports, args);
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
  config = Object.assign({ 'url': 'index.html' }, config || {});
  var url = config.url || 'index.html';
  var delayMs = 1000 * config.start;
  var loadWaitMs = 1000 * config.loadDelay;
  var framesToCapture;
  var dimensions;
  var stream = config.stream;
  var fps = config.fps, frameDuration;
  var outputPath = path.resolve(process.cwd(), config.outputDirectory);
  var animationFrameDuration;
  var browserFrames;

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

  var fileNameConverter = config.fileNameConverter;
  if (config.outputPattern) {
    fileNameConverter = function (num) {
      return sprintf(config.outputPattern, num);
    };
  }
  if (!fileNameConverter) {
    if (config.stream) {
      fileNameConverter = function () {
        return undefined;
      }
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
    dumpio: !config.quiet && !config.logToStdErr
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
        return overwriteTime(page, animationFrameDuration);
      }).then(function () {
        log('Going to ' + url + '...');
        return page.goto(url, { waitUntil: 'networkidle0' });
      }).then(function () {
        log('Page loaded');
        return new Promise(function (resolve) {
          setTimeout(resolve, loadWaitMs);
        });
      }).then(function () {
        if (config.selector) {
          return getSelectorDimensions(page, config.selector).then(function (ds) {
            if (!ds) {
              log('Warning: no element found for ' + config.selector);
              return;
            }
            dimensions = ds;
          });
        }
      }).then(function () {
        browserFrames = getBrowserFrames(page.mainFrame());
        var frameCount = 0;
        var viewport = page.viewport();
        var x = config.xOffset || config.left || 0;
        var y = config.yOffset || config.top || 0;
        var right = config.right || 0;
        var bottom = config.bottom || 0;
        var width;
        var height;
        if (dimensions) {
          width = config.width || Math.ceil(dimensions.width) - x - right;
          height = config.height || Math.ceil(dimensions.height) - y - bottom;
          x += dimensions.scrollX + dimensions.left;
          y += dimensions.scrollY + dimensions.top;
        } else {
          width = config.width || (viewport.width - x - right);
          height = config.height || (viewport.height - y - bottom);
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
          return goToTime(browserFrames, delayMs + frameCount * frameDuration).then(function () {
            log('Capturing Frame ' + frameCount + '...');
            var fileName = fileNameConverter(frameCount, framesToCapture);
            var filePath;
            if (fileName) {
              filePath = path.resolve(outputPath, fileName);
              makeFileDirectoryIfNeeded(filePath);
            } else {
              filePath = undefined;
            }
            return page.screenshot({
              path: filePath,
              clip: screenshotClip
            }).then(function (buffer) {
              if (stream) {
                stream.write(buffer);
              }
            });
          });
        });
      });
    }).then(function () {
      return browser.close();
    }).catch(function (err) {
      log(err);
    }).then(function () {
      // process.stdout and process.stderr can not be closed
      // https://nodejs.org/api/process.html#process_a_note_on_process_i_o
      if (stream && stream !== process.stdout && stream !== process.stderr) {
        stream.end();
      }
    });
  });
};