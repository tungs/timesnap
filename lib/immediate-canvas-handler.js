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

const timeHandler = require('./overwrite-time');
const makeCanvasCapturer = require('./make-canvas-capturer');
const { evaluateOnNewDocument } = require('./utils');
var overwriteTime = timeHandler.overwriteTime;

const canvasCapturer = makeCanvasCapturer(async (page) => {
  var dataUrl = await page.evaluate(() => window._timesnap_canvasData);
  var data = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return new Buffer(data, 'base64');
});

module.exports = function (config) {
  var capturer = canvasCapturer(config);
  var canvasCaptureMode = capturer.canvasCaptureMode;
  var canvasSelector = capturer.canvasSelector;
  var quality = capturer.quality;
  var preparePage = async function ({ page }) {
    await page.evaluate(function ({ canvasSelector, type, quality }) {
      window._timesnap_saveCanvasData = function () {
        var canvasElement = document.querySelector(canvasSelector);
        window._timesnap_canvasData = canvasElement.toDataURL(type, quality);
      };
    }, { canvasSelector, type: canvasCaptureMode, quality });
    if (config.alwaysSaveCanvasData) {
      // the event detail filtering should be aligned with those found in overwrite-time.js
      await page.evaluate(function () {
        window.timeweb.on('postseek', (e) => {
          if (e.detail === 'only seek') {
            window._timesnap_saveCanvasData();
          }
        });
        window.timeweb.on('postanimate', (e) => {
          window._timesnap_saveCanvasData();
        });
      })
    } else {
      await page.evaluate(function () {
        window.timeweb.on('postanimate', (e) => {
          if (e.detail !== 'no capture') {
            window._timesnap_saveCanvasData();
          }
        });
      })
    }
  };

  return {
    capturer: capturer,
    timeHandler: {
      overwriteTime,
      preparePage,
      goToTime: timeHandler.goToTime,
      goToTimeAndAnimate: timeHandler.goToTimeAndAnimate,
      goToTimeAndAnimateForCapture: timeHandler.goToTimeAndAnimateForCapture
    }
  };
};
