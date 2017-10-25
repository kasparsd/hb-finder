const puppeteer = require('puppeteer');
const csvParse = require('csv-parse');
const csvStringify = require('csv-stringify');
const fs = require('fs');

function reportToCsv( report ) {
	var csv = [];

	// Add the header row.
	csv.push( Object.keys( report[0] ) );

	report.forEach( function( urlReport ) {
		csv.push( Object.values( urlReport ) );
	} );

	return csv;
}

function getReportId() {
	var d = new Date();
	var parts = [
		d.getFullYear(),
		d.getMonth() + 1,
		d.getDate(),
		'-',
		d.getHours(),
		d.getMinutes(),
		d.getSeconds()
	];

	return parts.join('');
}

function mapRequestUrl( url ) {
	let rules = {
		'an.facebook.com': 'Facebook Audience Network',
		'googletagservices.com/tag/js/gpt.js': 'Google DFP',
		'openx.net/w/': 'OpenX',
		'cas.criteo.com': 'Criteo',
		'go.sonobi.com': 'Sobobi',
		'googlesyndication.com/pagead/js/adsbygoogle.js': 'Google AdSense',
	};

	// @todo Not sure how to pass url using the ES6 syntax.
	return Object.keys( rules ).filter( function( rule ) {
		return this.url.includes( rule );
	}, { url: url } ).map( rule => rules[ rule ] );
}

if ( 'undefined' === typeof process.argv[2] ) {
	return console.error( 'Need a CSV file of URLs to check.' );
}

// @todo Add validation, catch fail.
var urlCsv = process.argv[2] + '';

fs.readFile( urlCsv, ( err, data ) => {

	csvParse( data, (err, csv ) => {

		if ( err ) {
			throw err;
		}

		puppeteer.launch().then( async browser => {
			var urls = csv.map( entry => entry[0] ).filter( url => ( url.length ) );
			var reportFilename = [ 'reports/report-', getReportId(), '.csv' ].join('');
			var log = {};

			while ( true ) {
				var url = urls.shift();
				var requests = [];

				if ( ! url ) {
					break;
				}

				log[ url ] = {
					url: url,
					services: [],
					stats: {}
				};

				let page = await browser.newPage();

				await page.on( 'request', request => {
					requests.push( request.url );
				});

				log[ url ].stats = await page.goto( url ).then( response => {
					return page.evaluate( () => {
						return {
							is_prebid: ( window.pbjs && 'object' === typeof window.pbjs.cmd ),
							is_dfp: ( window.googletag && 'object' === typeof window.googletag.cmd )
						};
					} );
				} ).catch( error => console.error( error ) );

				log[ url ].services = requests.map( requestUrl => {
					var matchedServices = mapRequestUrl( requestUrl );

					if ( matchedServices.length ) {
						return matchedServices.shift();
					}

					return false;
				} ).filter( service => service.length );

				await page.close();
			}

			await browser.close();
		} );

		console.log( log );

		/*
		var csv = reportToCsv( log );

		csvStringify( csv, function( error, output ) {
			fs.writeFile( reportFilename, output, ( err ) => {
				if ( err ) {
					throw err;
				}

				console.log( 'Report Completed!' );
				console.log( output );
			} );
		} );
		*/
	} );

} );
