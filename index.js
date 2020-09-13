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

const puppeteer = require('puppeteer');
const path = require('path');
const defaultDuration = 5;
const defaultFPS = 60;
const { overwriteRandom } = require('./lib/overwrite-random');
const { promiseLoop, getBrowserFrames } = require('./lib/utils');
const initializePageUtils = require('./lib/page-utils');
const initializeMediaTimeHandler = require('./lib/media-time-handler');


module.exports = function (config) {
  config = Object.assign({}, config || {});
  var url = config.url || 'index.html';
  var delayMs = 1000 * (config.start || 0);
  var startWaitMs = 1000 * (config.startDelay || 0);
  var frameNumToTime = config.frameNumToTime;
  var unrandom = config.unrandomize;
  var fps = config.fps, frameDuration;
  var framesToCapture;
  var outputPath = path.resolve(process.cwd(), (config.outputDirectory || './'));

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

  frameDuration = 1000 / fps;

  if (!frameNumToTime) {
    frameNumToTime = function (frameCount) {
      return (frameCount-1) * frameDuration;
    };
  }

  const log = function () {
    if (!config.quiet) {
      if (config.logger) {
        config.logger(...arguments);
      } else if (config.logToStdErr) {
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

  const getBrowser = function (config, launchOptions) {
    if (config.browser) {
      return Promise.resolve(config.browser);
    } else if (config.launcher) {
      return Promise.resolve(config.launcher(launchOptions));
    } else if (config.remoteUrl) {
      let queryString = Object.keys(launchOptions).map(key => key + '=' + launchOptions[key]).join('&');
      let remote = config.remoteUrl + '?' + queryString;
      return puppeteer.connect({ browserWSEndpoint: remote });
    } else {
      return puppeteer.launch(launchOptions);
    }
  };

  return getBrowser(config, launchOptions).then(function (browser) {
    return browser.newPage().then(function (page) {
      // A marker is an action at a specific time
      var markers = [];
      var markerId = 0;
      var addMarker = function ({time, type, data}) {
        markers.push({ time, type, data, id: markerId++ });
      };
      config = Object.assign({
        log,
        outputPath,
        page,
        addMarker,
        framesToCapture
      }, config);
      var capturer, timeHandler;
      if (config.canvasCaptureMode) {
        if (typeof config.canvasCaptureMode === 'string' && config.canvasCaptureMode.startsWith('immediate')) {
          // remove starts of 'immediate' or 'immediate:'
          config.canvasCaptureMode = config.canvasCaptureMode.replace(/^immediate:?/, '');
          ({ timeHandler, capturer } = require('./lib/immediate-canvas-handler')(config));
          log('Capture Mode: Immediate Canvas');
        } else {
          timeHandler = require('./lib/overwrite-time');
          capturer = require('./lib/capture-canvas')(config);
          log('Capture Mode: Canvas');
        }
      } else {
        timeHandler = require('./lib/overwrite-time');
        capturer = require('./lib/capture-screenshot')(config);
        log('Capture Mode: Screenshot');
      }
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
        return overwriteRandom(page, unrandom, log);
      }).then(function () {
        return timeHandler.overwriteTime(page);
      }).then(function () {
        return initializePageUtils(page);
      }).then(function () {
        return initializeMediaTimeHandler(page);
      }).then(function () {
        log('Going to ' + url + '...');
        return page.goto(url, { waitUntil: 'networkidle0' });
      }).then(function () {
        log('Page loaded');
        if ('preparePage' in config) {
          log('Preparing page before screenshots...');
          return Promise.resolve(config.preparePage(page)).then(function () {
            log('Page prepared');
          });
        }
      }).then(function () {
        return new Promise(function (resolve) {
          setTimeout(resolve, startWaitMs);
        });
      }).then(function () {
        var browserFrames = getBrowserFrames(page.mainFrame());
        var captureTimes = [];
        if (capturer.beforeCapture) {
          // run beforeCapture right before any capture frames
          addMarker({
            time: delayMs + frameNumToTime(1, framesToCapture),
            type: 'Run Function',
            data: {
              fn: function () {
                return capturer.beforeCapture(config);
              }
            }
          });
        }
        for (let i = 1; i <= framesToCapture; i++) {
          addMarker({
            time: delayMs + frameNumToTime(i, framesToCapture),
            type: 'Capture',
            data: { frameCount: i }
          });
          captureTimes.push(delayMs + frameNumToTime(i, framesToCapture));
        }

        // run 'requestAnimationFrame' early on, just in case if there
        // is initialization code inside of it
        var addAnimationGapThreshold = 100;
        var addAnimationFrameTime = 20;
        if (captureTimes.length && captureTimes[0] > addAnimationGapThreshold) {
          addMarker({
            time: addAnimationFrameTime,
            type: 'Only Animate'
          });
        }

        var lastMarkerTime = 0;
        var maximumAnimationFrameDuration = config.maximumAnimationFrameDuration;
        captureTimes.forEach(function (time) {
          if (maximumAnimationFrameDuration) {
            let frameDuration = time - lastMarkerTime;
            let framesForDuration = Math.ceil(frameDuration / maximumAnimationFrameDuration);
            for (let i = 1; i < framesForDuration; i++) {
              addMarker({
                time: lastMarkerTime + (i * frameDuration / framesForDuration),
                type: 'Only Animate',
              });
            }
          }
          lastMarkerTime = time;
        });

        markers = markers.sort(function (a, b) {
          if (a.time !== b.time) {
            return a.time - b.time;
          }
          return a.id - b.id;
        });

        var startCaptureTime = new Date().getTime();
        var markerIndex = 0;
        return promiseLoop(function () {
          return markerIndex < markers.length;
        }, function () {
          var marker = markers[markerIndex];
          var p;

          markerIndex++;
          if (marker.type === 'Capture') {
            p = timeHandler.goToTimeAndAnimateForCapture(browserFrames, marker.time);
            // because this section is run often and there is a small performance
            // penalty of using .then(), we'll limit the use of .then()
            // to only if there's something to do

            var skipCurrentFrame;

            if (config.shouldSkipFrame) {
              p = p.then(function () {
                skipCurrentFrame = config.shouldSkipFrame({
                  page: page,
                  frameCount: marker.data.frameCount,
                  framesToCapture: framesToCapture
                });
              });
            }

            if (config.preparePageForScreenshot) {
              p = p.then(function () {
                if (skipCurrentFrame) {
                  log('Skipping frame: ' + marker.data.frameCount);
                  return;
                }

                log('Preparing page for screenshot...');
                return config.preparePageForScreenshot(page, marker.data.frameCount, framesToCapture);
              }).then(function () {
                if (skipCurrentFrame) {
                  return;
                }

                log('Page prepared');
              });
            }
            if (capturer.capture) {
              p = p.then(function () {
                if (skipCurrentFrame) {
                  return;
                }

                return capturer.capture(config, marker.data.frameCount, framesToCapture);
              });
            }
          } else if (marker.type === 'Only Animate') {
            p = timeHandler.goToTimeAndAnimate(browserFrames, marker.time);
          } else if (marker.type === 'Run Function') {
            p = marker.data.fn(marker);
          }
          return p;
        }).then(function () {
          log('Elapsed capture time: ' + (new Date().getTime() - startCaptureTime));
          if (capturer.afterCapture) {
            return capturer.afterCapture();
          }
        });
      });
    }).then(function () {
      return browser.close();
    }).catch(function (err) {
      log(err);
    });
  });
};