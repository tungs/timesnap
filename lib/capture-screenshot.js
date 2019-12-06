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

const { getSelectorDimensions, makeFilePathConverter, makeFileDirectoryIfNeeded } = require('./utils.js');

module.exports = function (config) {
  var page = config.page;
  var log = config.log;
  var frameProcessor = config.frameProcessor;
  var screenshotClip;
  var filePathConverter = makeFilePathConverter(config);
  return {
    beforeCapture: function () {
      return Promise.resolve().then(function () {
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
        screenshotClip = {
          x: x,
          y: y,
          width: width,
          height: height
        };
        if (screenshotClip.height <= 0) {
          throw new Error('Capture height is ' + (screenshotClip.height < 0 ? 'negative!' : '0!'));
        }
        if (screenshotClip.width <= 0) {
          throw new Error('Capture width is ' + (screenshotClip.width < 0 ? 'negative!' : '0!'));
        }
      });
    },
    capture: function (sameConfig, frameCount, framesToCapture) {
      var filePath = filePathConverter(frameCount, framesToCapture);
      if (filePath) {
        makeFileDirectoryIfNeeded(filePath);
      }
      log('Capturing Frame ' + frameCount + (filePath ? ' to ' + filePath : '') + '...');
      var p = page.screenshot({
        type: config.sreenshotType,
        quality: config.screenshotQuality,
        path: filePath,
        clip: screenshotClip,
        omitBackground: config.transparentBackground ? true : false
      });
      if (frameProcessor) {
        p = p.then(function (buffer) {
          return frameProcessor(buffer, frameCount, framesToCapture);
        });
      }
      return p;
    }
  };
};
