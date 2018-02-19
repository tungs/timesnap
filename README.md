# timesnap

timesnap is a node.js program that uses [puppeteer](https://github.com/GoogleChrome/puppeteer) to open a webpage, overwrite its time-handling functions, and record screenshots in virtual time. For some web pages, this allows frames to be recorded slower than real time, while appearing smooth and consistent when recreated into a movie.

## Limitations
Only JavaScript functions are overwritten, so pages where changes occur via other means (e.g. through video or transitions/animations from css rules) will likely not render as intended.

## Command Line

### Installation

Global Install:

Due to [an issue in puppeteer](https://github.com/GoogleChrome/puppeteer/issues/375), timesnap is not supported for installation for global install for root. You can configure npm to install global packages for a specific user following this guide: https://docs.npmjs.com/getting-started/fixing-npm-permissions#option-two-change-npms-default-directory

After configuring, run:

```
npm install -g timesnap
```

Local Install
```
cd /path/to/installation/directory
npm install timesnap
```

### Use and Options
Global Install:
```
timesnap url [options]
```

Local Install
```
node /path/to/installation/directory/node_modules/timesnap/bin/cli.js url [options]
```

#### URL
The url can be a web url (e.g. `https://github.com`) or a relative path to the current working directory (e.g. `index.html`). If no URL is specified, defaults to `index.html`.

#### Options
TBD


## How it works
timesnap uses puppeteer's `page.evaluateOnNewDocument` feature to overwrite a page's native time-handling JavaScript functions (`Date.now`, `performance.now`, `requestAnimationFrame`, `setTimeout`, `setInterval`, `cancelAnimationFrame`, `cancelTimeout`, and `cancelInterval`) to custom ones that use virtual time instead.

Then the page's virtual time is incremented frame by frame for the desired length of time, allowing for any computation to complete before taking a screenshot.
