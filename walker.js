const puppeteer = require('puppeteer');
const csvParse = require('csv-parse');
const csvStringify = require('csv-stringify');
const fs = require('fs');

const serviceRules = {
	'an.facebook.com': 'Facebook Audience Network',
	'googletagservices.com/tag/js/gpt.js': 'Google DFP',
	'openx.net/w/': 'OpenX',
	'cas.criteo.com': 'Criteo',
	'go.sonobi.com': 'Sobobi',
	'googlesyndication.com/pagead/js/adsbygoogle.js': 'Google AdSense',
	'googletagmanager.com/gtm': 'Google Tag Manager',
};

if ( 'undefined' === typeof process.argv[2] ) {
	return console.error( 'Need a CSV file of URLs to check.' );
}

function getReportId() {
	let d = new Date();

	return [
		d.getFullYear(),
		d.getMonth() + 1,
		d.getDate(),
		'-',
		d.getHours(),
		d.getMinutes(),
		d.getSeconds()
	].map( part => part.toString().padStart( 2, 0 ) ).join('');
}

function mapRequestUrl( url ) {
	// @todo Not sure how to pass url using the ES6 syntax.
	return Object.keys( serviceRules ).filter( function( rule ) {
		return this.url.includes( rule );
	}, { url: url } ).map( rule => serviceRules[ rule ] );
}

function logToCsvString( log ) {
	return log.join(',') + "\n";
}

function logReport( filename, url, log ) {
	let csv = {
		'URL': url,
	};

	for ( var serviceLabel in log ) {
		csv[ serviceLabel ] = log[ serviceLabel ] ? 1 : 0;
	}

	// Write the CSV header first.
	return fs.stat( filename, ( err, stats ) => {
		if ( ! stats ) {
			fs.appendFile( filename, logToCsvString( Object.keys( csv ) ), ( err ) => {
				if ( err ) throw err;
			} );
		}

		fs.appendFile( filename, logToCsvString( Object.values( csv ) ), ( err ) => {
			if ( err ) throw err;
		} );
	} );
}

// @todo Add validation, catch fail.
var urlCsv = process.argv[2] + '';

fs.readFile( urlCsv, ( err, data ) => {

	csvParse( data, ( err, csv ) => {

		if ( err ) {
			throw err;
		}

		const urls = csv.map( entry => entry[0] ).filter( url => ( url.length ) );
		const reportFilename = [ 'reports/report-', getReportId(), '.csv' ].join('');

		puppeteer.launch().then( async browser => {

			let tasks = urls.map( async url => {

				let urlServicesFound = {};
				let varServicesFound = {};
				let page = await browser.newPage();

				// Mark all services as not found by default.
				Object.values( serviceRules ).forEach( serviceLabel => {
					urlServicesFound[ serviceLabel ] = false;
				} );

				await page.on( 'request', request => {
					mapRequestUrl( request.url ).forEach( serviceFound => {
						urlServicesFound[ serviceFound ] = true;
					} );
				} );

				varServicesFound = await page.goto( url ).then( () => {
					console.log( 'Checking:', url );

					return page.evaluate( () => {
						return {
							'Prebid.js': ( window.pbjs && 'object' === typeof window.pbjs.cmd ) === true,
						};
					} );
				} );

				await page.close();

				let found = Object.assign( urlServicesFound, varServicesFound );

				// Log it to a file.
				logReport( reportFilename, url, found );

				return {
					url: url,
					services: found,
				};

			} );

			return Promise.all( tasks ).then( taskReport => {
				browser.close();

				return taskReport;
			} );

		} ).then( report => {
			console.log( 'Done!' );
		} );

	} );

} );
