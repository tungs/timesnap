# <a name="timesnap" href="#timesnap">#</a> timesnap

**timesnap** is a node.js program that uses [puppeteer](https://github.com/GoogleChrome/puppeteer) to open a web page, overwrite its time-handling functions, and record screenshots in virtual time. For some web pages, this allows frames to be recorded slower than real time, while appearing smooth and consistent when recreated into a movie.

You can use **timesnap** from the command line or as a node.js library.

## <a name="limitations" href="#limitations">#</a> Limitations
**timesnap** only overwrites JavaScript functions, so pages where changes occur via other means (e.g. through video or transitions/animations from css rules) will likely not render as intended.

## <a name="cli-use" href="#cli-use">#</a> From the Command Line

### <a name="cli-installation" href="#cli-installation">#</a> Installation

#### <a name="cli-global-install" href="#cli-global-install">#</a> Global Install

Due to [an issue in puppeteer](https://github.com/GoogleChrome/puppeteer/issues/375) with permissions, timesnap is not supported for global installation for root. You can configure `npm` to install global packages for a specific user following this guide: https://docs.npmjs.com/getting-started/fixing-npm-permissions#option-two-change-npms-default-directory

After configuring, run:

```
npm install -g timesnap
```

#### <a name="cli-local-install" href="#cli-local-install">#</a> Local Install
```
cd /path/to/installation/directory
npm install timesnap
```

### <a name="cli-use-and-options" href="#cli-use-and-options">#</a> Use and Options

#### <a name="cli-global-install-use" href="#cli-global-install-use">#</a> Global Install
```
timesnap "url" [options]
```

#### <a name="cli-local-install-use" href="#cli-local-install-use">#</a> Local Install
```
node /path/to/installation/directory/node_modules/timesnap/cli.js "url" [options]
```

#### <a name="cli-url-use" href="#cli-url-use">#</a> url
The url can be a web url (e.g. `https://github.com`) or a relative path to the current working directory (e.g. `index.html`). If no url is specified, defaults to `index.html`. For urls with special characters (like `&`), enclose the urls with quotes.

#### <a name="cli-options" href="#cli-options">#</a> options
TBD

## <a name="node-use" href="#node-use">#</a> From node.js
**timesnap** can also be included as a library inside node.js programs.

### <a name="node-install" href="#node-install">#</a> Install
```
npm install timesnap --save-prod
```

### <a name="node-use-and-options" href="#cli-use-and-options">#</a> Use and Options
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

#### <a name="node-api" href="#node-api">#</a> Node API
TBD

## <a name="how-it-works" href="#how-it-works">#</a> How it works
**timesnap** uses puppeteer's `page.evaluateOnNewDocument` feature to overwrite a page's native time-handling JavaScript functions (`Date.now`, `performance.now`, `requestAnimationFrame`, `setTimeout`, `setInterval`, `cancelAnimationFrame`, `cancelTimeout`, and `cancelInterval`) to custom ones that use virtual time instead.

Then the page's virtual time is incremented frame by frame for the desired length of time, allowing for any computation to complete before taking a screenshot.
