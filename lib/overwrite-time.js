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


const goToTime = function (browserFrames, time) {
  // Goes to a certain time. Can't go backwards
  return Promise.all(browserFrames.map(function (frame) {
    return frame.evaluate(function (ms) {
      window._processUntilTime(ms);
    }, time);
  }));
};

module.exports = {
  overwriteTime,
  goToTime
};