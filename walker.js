const puppeteer = require('puppeteer');
const csvParse = require('csv-parse');
const csvStringify = require('csv-stringify');
const fs = require('fs');

const serviceRules = {
	'an.facebook.com': 'Facebook Audience Network',
	'googletagservices.com/tag/js/gpt.js': 'Google DFP',
	'openx.net/w/': 'OpenX',
	'.casalemedia.com': 'Index Exchange',
	'cas.criteo.com': 'Criteo',
	'go.sonobi.com': 'Sobobi',
	'googlesyndication.com/pagead/js/adsbygoogle.js': 'Google AdSense',
	'googletagmanager.com/gtm': 'Google Tag Manager',
	'google-analytics.com/analytics.js': 'Google Analytics',
	'amazon-adsystem.com': 'Amazon Ads',
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
			fs.appendFileSync( filename, logToCsvString( Object.keys( csv ) ), ( err ) => {
				if ( err ) throw err;
			} );
		}

		fs.appendFileSync( filename, logToCsvString( Object.values( csv ) ), ( err ) => {
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

			// @todo Is there a way to do this using map or forEach?
			for ( let u = 0; u < urls.length; u++ ) {

				let url = urls[u];
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

				varServicesFound = await page.goto( url ).then( async () => {
					console.log( 'Checking:', url );

					return await page.evaluate( () => {
						return {
							'Prebid.js': ( window.pbjs && 'object' === typeof window.pbjs.cmd ) === true,
							'Pubfood': ( window.pubfood && 'object' === typeof window.pubfood ) === true,
						};
					} ).catch( error => console.log( url, error ) );
				} ).catch( error => console.error( 'Failed to open', url ) );

				await page.close();

				let found = Object.assign( urlServicesFound, varServicesFound );

				// Log it to a file.
				logReport( reportFilename, url, found );
			}

			await browser.close();

		} ).then( () => {
			console.log( 'Done!' );
		} );

	} );

} );
