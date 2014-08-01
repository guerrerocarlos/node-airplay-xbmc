node-airplay-xbmc 
=================

node-airplay-xbmc is a client library for Apple's AirPlay remote playback protocol.

## Installation

From npm:

	npm intall airplay-xbmc

From source:

	git clone https://github.com/guerrerocarlos/node-airplay-xbmc.git
	npm link


## Usage

``` javascript
// remote video
var browser = require( 'airplay-xbmc' ).createBrowser();
browser.on( 'deviceOn', function( device ) {
    device.play( 'http://remotehost/video.mp4', 0, function() {
        console.info( 'video playing...' );
    });
});
browser.start();
```

