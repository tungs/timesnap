# timesnap

**timesnap** is a node.js program that uses [puppeteer](https://github.com/GoogleChrome/puppeteer) to open a web page, overwrite its time-handling functions, and record screenshots in virtual time. For some web pages, this allows frames to be recorded slower than real time, while appearing smooth and consistent when recreated into a movie.

You can use **timesnap** from the command line or as a node.js library.

## <a name="limitations" href="#limitations">#</a> Limitations
**timesnap** only overwrites JavaScript functions, so pages where changes occur via other means (e.g. through video or transitions/animations from css rules) will likely not render as intended.

## <a name="cli-use" href="#cli-use">#</a> From the Command Line

### <a name="cli-global-install" href="#cli-global-install">#</a> Global Install and Use

Due to [an issue in puppeteer](https://github.com/GoogleChrome/puppeteer/issues/375) with permissions, timesnap is not supported for global installation for root. You can configure `npm` to install global packages for a specific user following this guide: https://docs.npmjs.com/getting-started/fixing-npm-permissions#option-two-change-npms-default-directory

After configuring, to install, run:
```
npm install -g timesnap
```

To use:
```
timesnap "url" [options]
```

### <a name="cli-local-install" href="#cli-local-install">#</a> Local Install and Use
```
cd /path/to/installation/directory
npm install timesnap
```

To use:
```
node /path/to/installation/directory/node_modules/timesnap/cli.js "url" [options]
```

### <a name="cli-url-use" href="#cli-url-use">#</a> Command Line *url*
The url can be a web url (e.g. `https://github.com`) or a relative path to the current working directory (e.g. `index.html`). If no url is specified, defaults to `index.html`. For urls with special characters (like `&`), enclose the urls with quotes.

### <a name="cli-options" href="#cli-options">#</a> Command Line *options*
* <a name="cli-options-output-directory" href="#cli-options-output-directory">#</a> Output Directory: `-o`, `--output-directory` *directory*
    * Saves images to a *directory* (default './').
* <a name="cli-options-output-pattern" href="#cli-options-output-pattern">#</a> Output Pattern: `-O`, `--output-pattern` *pattern*
    * Save each file to a *pattern* as a printf-style string (e.g. `image-%03d.png`).
* <a name="cli-options-fps" href="#cli-options-fps">#</a> fps: `-R`, `--fps` *frame rate*
    * *frame rate* (in frames per virtual second) of capture (default: 60).
* <a name="cli-options-duration" href="#cli-options-duration">#</a> Duration: `-d`, `--duration` *seconds*
    * Duration of capture, in *seconds* (default: 5).
* <a name="cli-options-frames" href="#cli-options-frames">#</a> Frames: `-f`, `--frames` *count*
    * Number of frames to capture.
* <a name="cli-options-selector" href="#cli-options-selector">#</a> Selector: `-S`, `--selector` *selector*
    * CSS *selector* of item to capture.
* <a name="cli-options-stdout" href="#cli-options-stdout">#</a> stdout: `--stdout`
    * Output images to stdout. Useful for piping. CLI only option.
* <a name="cli-options-viewport" href="#cli-options-viewport">#</a> Viewport: `-V`, `--viewport` *dimensions*
    * Viewport dimensions, in pixels. For example `800` (for width) or `800,600` (for width and height).
* <a name="cli-options-start" href="#cli-options-start">#</a> Start: `-s`, `--start` *n seconds*
    * Runs code for n virtual seconds before saving any frames (default: 0).
* <a name="cli-options-x-offset" href="#cli-options-x-offset">#</a> X Offset: `-x`, `--x-offset` *pixels*
    * X offset of capture, in pixels (default: 0).
* <a name="cli-options-y-offset" href="#cli-options-y-offset">#</a> Y Offset: `-y`, `--y-offset` *pixels*
    * Y offset of capture, in pixels (default: 0).
* <a name="cli-options-width" href="#cli-options-width">#</a> Width: `-W`, `--width` *pixels*
    * Width of capture, in pixels.
* <a name="cli-options-height" href="#cli-options-height">#</a> Height: `-H`, `--height` *pixels*
    * Height of capture, in pixels.
* <a name="cli-options-left" href="#cli-options-left">#</a> Left: `-l`, `--left` *pixels*
    * Left edge of capture, in pixels. Equivalent to `--x-offset`.
* <a name="cli-options-right" href="#cli-options-right">#</a> Right: `-r`, `--right` *pixels*
    * Right edge of capture, in pixels. Ignored if `width` is specified.
* <a name="cli-options-top" href="#cli-options-top">#</a> Top: `-t`, `--top` *pixels*
    * Top edge of capture, in pixels. Equivalent to `--y-offset`.
* <a name="cli-options-bottom" href="#cli-options-bottom">#</a> Bottom: `-b`, `--bottom` *pixels*
    * Bottom edge of capture, in pixels. Ignored if `height` is specified.
* <a name="cli-options-load-delay" href="#cli-options-load-delay">#</a> Load Delay: `--load-delay` *n seconds*
    * Wait *n real seconds* after loading.
* <a name="cli-options-quiet" href="#cli-options-quiet">#</a> Quiet: `-q`, `--quiet`
    * Suppress console logging.

## <a name="node-use" href="#node-use">#</a> From node.js
**timesnap** can also be included as a library inside node.js programs.

### <a name="node-install" href="#node-install">#</a> Node Install
```
npm install timesnap --save-prod
```

### <a name="node-use" href="#node-use">#</a> Node Use
```
const timesnap = require('timesnap');
timesnap({
  url: 'https://github.com',
  fps: 30,
  duration: 10
}).then(function () {
  console.log('Done!');
});
```

### <a name="node-api" href="#node-api">#</a> Node API

There are a few options for the Node API that are not accessible through the command line interface: `config.logToStdErr`, and `config.stream`.

**timesnap(config)**
* `config` &lt;[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)&gt;
    * <a name="js-config-url" href="#js-config-url">#</a> `url` &lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)&gt; The url to load. It can be a web url, like `https://github.com` or a relative path to the current working directory, like `index.html` (default: 'index.html').
    * <a name="js-config-output-directory" href="#js-config-output-directory">#</a> `outputDirectory` &lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)&gt; Saves images to a directory. Makes one if necessary.
    * <a name="js-config-output-pattern" href="#js-config-output-pattern">#</a> `outputPattern` &lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)&gt; Save each file to a pattern as a printf-style string (e.g. `image-%03d.png`)
    * <a name="js-config-fps" href="#js-config-fps">#</a> `fps` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; frame rate, in frames per virtual second, of capture (default: 60).
    * <a name="js-config-duration" href="#js-config-duration">#</a> `duration` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Duration of capture, in seconds (default: 5).
    * <a name="js-config-frames" href="#js-config-frames">#</a> `frames` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Number of frames to capture. Overrides default fps or default duration. 
    * <a name="js-config-selector" href="#js-config-selector">#</a> `selector` &lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)&gt; [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) of item to capture.
    * <a name="js-config-viewport" href="#js-config-viewport">#</a> `viewport` &lt;[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)&gt;
        * <a name="js-config-viewport-width" href="#js-config-viewport-width">#</a> `width` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Width of viewport.
        * <a name="js-config-viewport-height" href="#js-config-viewport-height">#</a> `height` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Height of viewport.
        * <a name="js-config-viewport-scale-factor" href="#js-config-viewport-scale-factor">#</a> `deviceScaleFactor` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Device scale factor (default: 1).
        * <a name="js-config-viewport-mobile" href="#js-config-viewport-mobile">#</a> `isMobile` &lt;[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)&gt; Specifies whether the `meta viewport` tag should be used (default: false).
        * <a name="js-config-viewport-touch" href="#js-config-viewport-touch">#</a> `hasTouch` &lt;[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)&gt; Specifies whether the viewport supports touch (default: false).
        * <a name="js-config-viewport-landscape" href="#js-config-viewport-landscape">#</a> `isLandscape` &lt;[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)&gt; Specifies whether the viewport is in landscape mode (default: false).
    * <a name="js-config-start" href="#js-config-start">#</a> `start` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Runs code for `config.start` virtual seconds before saving any frames (default: 0).
    * <a name="js-config-x-offset" href="#js-config-x-offset">#</a> `x` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; X offset of capture, in pixels (default: 0).
    * <a name="js-config-y-offset" href="#js-config-y-offset">#</a> `y` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Y offset of capture, in pixels (default: 0).
    * <a name="js-config-width" href="#js-config-width">#</a> `width` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Width of capture, in pixels.
    * <a name="js-config-height" href="#js-config-height">#</a> `height` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Height of capture, in pixels.
    * <a name="js-config-left" href="#js-config-left">#</a> `left` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Left edge of capture, in pixels. Equivalent to `config.x`.
    * <a name="js-config-right" href="#js-config-right">#</a> `right` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Right edge of capture, in pixels. Ignored if `width` is specified.
    * <a name="js-config-top" href="#js-config-top">#</a> `top` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Top edge of capture, in pixels. Equivalent to `config.y`.
    * <a name="js-config-bottom" href="#js-config-bottom">#</a> `bottom` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Bottom edge of capture, in pixels. Ignored if `height` is specified.
    * <a name="js-config-load-delay" href="#js-config-load-delay">#</a> `loadDelay` &lt;[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)&gt; Wait `config.loadDelay` real seconds after loading (default: 0).
    * <a name="js-config-quiet" href="#js-config-quiet">#</a> `quiet` &lt;[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)&gt; Suppress console logging.
    * <a name="js-config-log-to-std-err" href="#js-config-log-to-std-err">#</a> `logToStdErr` &lt;[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)&gt; Log to stderr instead of stdout. Doesn't do anything if `config.quiet` is set to true.
    * <a name="js-config-stream" href="#js-config-stream">#</a> `stream` &lt;[Writable Stream](https://https://nodejs.org/api/stream.html#stream_writable_streams)&gt; Stream to write images to (as [`Buffer`s](https://nodejs.org/api/buffer.html#buffer_class_buffer)). This suppresses writing individual frame images if `outputPattern` is not specified.
* returns: &lt;[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&gt;

## <a name="how-it-works" href="#how-it-works">#</a> How it works
**timesnap** uses puppeteer's `page.evaluateOnNewDocument` feature to overwrite a page's native time-handling JavaScript functions (`Date.now`, `performance.now`, `requestAnimationFrame`, `setTimeout`, `setInterval`, `cancelAnimationFrame`, `cancelTimeout`, and `cancelInterval`) to custom ones that use virtual time instead.

Then the page's virtual time is incremented frame by frame for the desired length of time, allowing for any computation to complete before taking a screenshot.
