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

const timeHandler = require('./overwrite-time');
const makeCanvasCapturer = require('./make-canvas-capturer');

var overwriteTime = timeHandler.overwriteTime;
var oldGoToTime = timeHandler.goToTime;

const canvasCapturer = makeCanvasCapturer(function (page) {
  return page.evaluate(function () {
    return window._timesnap_canvasData;
  }).then(function (dataUrl) {
    var data = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return new Buffer(data, 'base64');
  });
});

module.exports = function (config) {
  var capturer = canvasCapturer(config);
  var canvasCaptureMode = capturer.canvasCaptureMode;
  var canvasSelector = capturer.canvasSelector;
  var quality = capturer.quality;
  var page = config.page;
  var goToTime;
  if (config.alwaysSaveCanvasData) {
    goToTime = function (browserFrames, time) {
      // Goes to a certain time. Can't go backwards
      return page.evaluate(function (ms, canvasSelector, type, quality) {
        window._timesnap_processUntilTime(ms);
        var canvasElement = document.querySelector(canvasSelector);
        window._timesnap_canvasData = canvasElement.toDataURL(type, quality);
      }, time, canvasSelector, canvasCaptureMode, quality);
    };
  } else {
    goToTime = oldGoToTime;
  }

  const goToTimeAndAnimateForCapture = function (browserFrames, time) {
    // Goes to a certain time. Can't go backwards
    return page.evaluate(function (ms, canvasSelector, type, quality) {
      window._timesnap_processUntilTime(ms);
      return window._timesnap_runFramePreparers(ms, function () {
        window._timesnap_runAnimationFrames();
        var canvasElement = document.querySelector(canvasSelector);
        window._timesnap_canvasData = canvasElement.toDataURL(type, quality);
      });
    }, time, canvasSelector, canvasCaptureMode, quality);
  };

  var goToTimeAndAnimate;
  if (config.alwaysSaveCanvasData) {
    goToTimeAndAnimate = goToTimeAndAnimateForCapture;
  } else {
    goToTimeAndAnimate = function (browserFrames, time) {
      // Goes to a certain time. Can't go backwards
      return page.evaluate(function (ms) {
        window._timesnap_processUntilTime(ms);
        return window._timesnap_runFramePreparers(ms, window._timesnap_runAnimationFrames);
      }, time);
    };
  }

  return {
    capturer: capturer,
    timeHandler: {
      overwriteTime,
      goToTime,
      goToTimeAndAnimate,
      goToTimeAndAnimateForCapture
    }
  };
};
