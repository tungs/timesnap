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
const fs = require('fs');
const path = require('path');
const sprintf = require('sprintf-js').sprintf;

const stringArrayFind = function (array, findString) {
  return array.find(iterateString => iterateString.includes(findString));
};

const getBrowserFrames = function (frame) {
  return [frame].concat(...frame.childFrames().map(getBrowserFrames));
};

const runInAllFrames = async function (page, fn, arg) {
  var browserFrames = getBrowserFrames(page.mainFrame());
  for (let i = 0; i < browserFrames.length; i++) {
    let frame = browserFrames[i];
    if (!frame.isDetached()) {
      await frame.evaluate(fn, arg);
    }
  }
};

const evaluateOnNewDocument = function (page, fn, arg) {
  if (page.evaluateOnNewDocument) {
    if (arg !== undefined) {
      return page.evaluateOnNewDocument(fn, arg);
    } else {
      return page.evaluateOnNewDocument(fn);
    }
  } else if (page.addInitScript) {
    if (arg !== undefined) {
      return page.addInitScript(fn, arg);
    } else {
      return page.addInitScript(fn);
    }
  }
};

const getPageViewportSize = function (page) {
  if (page.viewport) {
    return page.viewport();
  } else if (page.viewportSize) {
    return page.viewportSize();
  }
};

const setPageViewportSize = async function (page, config) {
  if (page.setViewport) {
    return page.setViewport(config);
  } else if (page.setViewportSize) {
    return page.setViewportSize(config);
  }
};

const getSelectorDimensions = async function (page, selector) {
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
        var extension = config.screenshotType === 'jpeg' ? 'd.jpg' : 'd.png';
        var outputPattern = '%0' + maxNum.toString().length + extension;
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

const writeFile = async function (filePath, buffer) {
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
  getBrowserFrames,
  runInAllFrames,
  evaluateOnNewDocument,
  getPageViewportSize,
  setPageViewportSize,
  getSelectorDimensions,
  writeFile,
  stringArrayFind,
  makeFilePathConverter,
  makeFileDirectoryIfNeeded
};
