# Website Walker

Crawl websites using [headless Chrome](https://developers.google.com/web/updates/2017/04/headless-chrome).

## Requirements

- [Chromium](https://www.chromium.org) (version 59 or later which supports the [headless mode](https://developers.google.com/web/updates/2017/04/headless-chrome))
- [Node.js](https://nodejs.org)

## Setup

### MacOS (OS X)

- Install [Google Chrome](https://www.google.com/chrome/browser/desktop/)
- Install [Node.js](https://nodejs.org)

### Debian

	$ sudo apt-get install chromium
	$ curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
	$ sudo apt-get install nodejs


## Usage

	$ node walker path/to/urls.csv

where `path/to/urls.csv` is a path to a file with URLs to check (one per line or CSV).
