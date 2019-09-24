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
const fs = require('fs');
const path = require('path');
const sprintf = require('sprintf-js').sprintf;

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

const makeFilePathConverter = function (config) {
  var fileNameConverter = config.fileNameConverter;
  if (!fileNameConverter) {
    if (config.outputPattern) {
      fileNameConverter = function (num) {
        return sprintf(config.outputPattern, num);
      };
    } else if (config.frameProcessor && !config.outputDirectory) {
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
  return function (num, maxNum) {
    var fileName = fileNameConverter(num, maxNum);
    if (fileName) {
      return path.resolve(config.outputPath, fileName);
    } else {
      return undefined;
    }
  };
};

const writeFile = function (filePath, buffer) {
  makeFileDirectoryIfNeeded(filePath);
  return new Promise(function (resolve, reject) {
    fs.writeFile(filePath, buffer, 'binary', function (err) {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
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

module.exports = {
  promiseLoop,
  getBrowserFrames,
  getSelectorDimensions,
  writeFile,
  makeFilePathConverter,
  makeFileDirectoryIfNeeded
};
