/**
 * node-airplay
 * 
 * @file airplay protocol client
 * @author zfkun(zfkun@msn.com)
 * @thanks https://github.com/benvanik/node-airplay/blob/master/lib/airplay/client.js
 */

var buffer = require( 'buffer' );
var events = require( 'events' );
var net = require( 'net' );
var util = require( 'util' );
var http = require( 'http' );
var plist = require( 'plist-with-patches' );

var CLIENT_USERAGENT = 'MediaControl/1.0';
var CLIENT_PING_DELAY = 30; // 心跳间隔(s)


var Client = function ( options, callback ) {
    events.EventEmitter.call( this );

    var self = this;
    this.options = options;
    this.responseQueue = [];
    this.host = options.host
    this.port = options.port
    self.responseQueue.push( callback );
    self.ping();

    this.on( 'received', function( data ) {
        var res = self.parseResponse(data.res, data.body);
        var fn = self.responseQueue.shift();
        if ( fn ) {
            fn( res );
        }
    });
};

util.inherits( Client, events.EventEmitter );
exports.Client = Client;


// just for keep-alive
// bug fix for '60s timeout'
Client.prototype.ping = function ( force ) {
    var self = this
    if ( !this.pingTimer || force === true ) {
        clearTimeout( this.pingTimer );
    }

    if ( !this.pingHandler ) {
        this.pingHandler = this.ping.bind( this );
    }

    var header = {'User-Agent':CLIENT_USERAGENT,
              'Content-Length':0}
    var req = http.request({host:this.host,port:this.port,path:'/playback-info'},
        function(res){
          var str = ''
          var ans = {}
          ans.res = res
          res.on('data', function(dat){
            str+= dat
          })
          res.on('end', function(){
            ans.body = str
            self.emit('received',ans)
          }) 
        }
    )
    req.on('error',function(e){
      console.log('problem with request: ' + e.message);
    })
    
    req.end();

    this.emit( 'ping', !!force );

    // next
    this.pingTimer = setTimeout( this.pingHandler, CLIENT_PING_DELAY * 1000 );

    return this;
};

Client.prototype.close = function() {
    if ( this.socket ) {
        this.socket.destroy();
    }
    this.socket = null;
    return this;
};

Client.prototype.parseResponse = function( res ,body ) {
    // Look for HTTP response:
    // HTTP/1.1 200 OK
    // Some-Header: value
    // Content-Length: 427
    // \n
    // body (427 bytes)


    // Trim body?
    return {
        statusCode: res.statusCode,
        headers: res.headers,
        body: body
       }

};

Client.prototype.request = function( req, body, callback ) {
    var self = this

    req.headers = req.headers || {};
    req.headers['User-Agent'] = CLIENT_USERAGENT;
    req.headers['Content-Type'] = "text/parameters"
    req.headers['Content-Length'] = body ? buffer.Buffer.byteLength( body ) : 0;
    req.host = this.host
    req.port = this.port

    // GET时不能启用Keep-Alive,会造成阻塞
    if ( req.method === 'POST') {
        // req.headers['Connection'] = 'keep-alive';
    }


    // 1. base
    var text = req.method + ' ' + req.path + ' HTTP/1.1\n';
    // 2. header
    for ( var key in req.headers ) {
        text += key + ': ' + req.headers[key] + '\n';
    }
    text += '\n'; // 这个换行不能少~~
    // 3. body
    text += body || '';


    this.responseQueue.push( callback );

    http.request(req,function(res){
          var str = ''
          var ans = {}
          ans.res = res
          res.on('data', function(dat){
            str+= dat
          })
          res.on('end', function(){
            ans.body = str
            self.emit('received',ans)
          })
        }
    ).end();
};

Client.prototype.get = function( path, callback ) {
    this.request( { method: 'GET', path: path }, null, callback );
};

Client.prototype.post = function( path, body, callback ) {
    this.request( { method: 'POST', path: path }, body, callback );
};



Client.prototype.serverInfo = function ( callback ) {
    this.request( { path:'/server-info'}, "",function ( res ) {
        var info = {};
        
        var obj = plist.parseStringSync( res.body );
        if ( obj ) {
            info = {
                deviceId: obj.deviceid,
                features: obj.features,
                model: obj.model,
                osVersion: obj.osBuildVersion,
                protocolVersion: obj.protovers,
                sourceVersion: obj.srcvers,
                vv: obj.vv
            };
        }
        else {
            this.emit( 'error', { type: 'serverInfo', res: res } );
        }

        if ( callback ) {
            callback( info );
        }
    });
};
Client.prototype.playbackInfo = function ( callback ) {
    this.get( '/playback-info', function ( res ) {
        var info;

        if ( res ) {
            var obj = plist.parseStringSync( res.body );
            if ( obj && Object.keys( obj ).length > 0 ) {
                info = {
                    duration: obj.duration,
                    position: obj.position,
                    rate: obj.rate,
                    readyToPlay: obj.readyToPlay,
                    readyToPlayMs: obj.readyToPlayMs,
                    playbackBufferEmpty: obj.playbackBufferEmpty,
                    playbackBufferFull: obj.playbackBufferFull,
                    playbackLikelyToKeepUp: obj.playbackLikelyToKeepUp,
                    loadedTimeRanges: obj.loadedTimeRanges,
                    seekableTimeRanges: obj.seekableTimeRanges,

                    uuid: obj.uuid,
                    stallCount: obj.stallCount
                };
            }
        }
        else {
            this.emit( 'error', { type: 'playbackInfo', res: res } );
        }

        if ( callback) {
            callback( info );
        }
    });
};

// position: 0 ~ 1
Client.prototype.play = function ( src, position, callback ) {
var h = {}
h['User-Agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/36.0.1985.125 Safari/537.36"
h['User-Agent'] = CLIENT_USERAGENT
h['Content-Type'] = "text/parameters"
h['connection'] = "keep-alive"

var data = ""
data+= 'Content-Location: '+src+'\n'
data+= 'Start-Position: 0\n'
h['Content-Length'] = Buffer.byteLength(data)

var req = http.request({path:'/play', host:this.host, port:this.port, method:'POST', headers:h}, function(res){
      callback && callback( res );
})
req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
});

req.write(data)
req.end()
};
Client.prototype.stop = function ( callback ) {
    this.post( '/stop', null, function( res ) {
        callback && callback( res );
    });
};
Client.prototype.rate = function ( value, callback ) {
    this.post( '/rate?value=' + value, null, function( res ) {
        callback && callback( res );
    });
};
Client.prototype.volume = function ( value, callback ) {
    this.post( '/volume?value=' + value, null, function( res ) {
        callback && callback( res );
    });
};
Client.prototype.scrub = function ( position, callback ) {
    this.post( '/scrub?position=' + position, null, function( res ) {
        callback && callback( res );
    });
};
Client.prototype.reverse = function ( callback ) {
    this.post( '/reverse', null, function( res ) {
        callback && callback( res );
    });
};
Client.prototype.photo = function ( callback ) {
    callback && callback();
};
Client.prototype.authorize = function ( callback ) {
    callback && callback();
};
Client.prototype.slideshowFeatures = function ( callback ) {
    callback && callback();
};
