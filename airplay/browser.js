/**
 * node-airplay
 * 
 * @file bojour server
 * @author zfkun(zfkun@msn.com)
 * @thanks https://github.com/benvanik/node-airplay/blob/master/lib/airplay/browser.js
 */

var util = require( 'util' );
var events = require( 'events' );

var mdns = require( 'mdns-js2' );

var Device = require( './device' ).Device;



var Browser = function( options ) {
    events.EventEmitter.call( this );
    this.init( options );
};

util.inherits( Browser, events.EventEmitter );

exports.Browser = Browser;




Browser.prototype.init = function ( options ) {
    var self = this;
    var nextDeviceId = 0;

    this.devices = {};

    var mdnsBrowser = new mdns.Mdns(mdns.tcp('airplay'));
    mdnsBrowser.on('ready', function () {
            mdnsBrowser.discover()
    });
    mdnsBrowser.on( 'update', function(data) {
        var info = data.addresses
        var name = data.name
        console.log(info)
        if(info.length>0){
          device = new Device( nextDeviceId++, info , name);
          device.on( 'ready', function( d ) {
              console.log('DEVICE FOUND!!',d)
              self.emit( 'deviceOn', d );
          });
          device.on( 'close', function( d ) {
              delete self.devices[ d.id ];
              self.emit( 'deviceOff', d );
          });

          self.devices[ device.id ] = device;
        }

    });
};

Browser.prototype.start = function () {
    this.emit( 'start' );
    return this;
};

Browser.prototype.stop = function() {
    this.browser.stop();
    this.emit( 'stop' );
    return this;
};

Browser.prototype.isValid = function ( info ) {
    if ( !info || !/^en\d+$/.test( info.networkInterface ) ) {
        return !1;
    }
    return !0;
};

Browser.prototype.getDevice = function ( info ) {
    for ( var deviceId in this.devices ) {
        var device = this.devices[ deviceId ];
        if ( device.match( info ) ) {
            return device;
        }
    }
};

Browser.prototype.getDeviceById = function ( deviceId, skipCheck ) {
    var device = this.devices[ deviceId ];
    if ( device && ( skipCheck || device.isReady() ) ) {
        return device;
    }
};

Browser.prototype.getDevices = function ( skipCheck ) {
    var devices = [];
    for ( var deviceId in this.devices ) {
        var device = this.devices[ deviceId ];
        if ( skipCheck || device.isReady() ) {
            devices.push( device );
        }
    }
    return devices;
};
