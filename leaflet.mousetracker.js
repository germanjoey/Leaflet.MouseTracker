/* globals L:true */

/*
    A simple Leaflet plugin for conveniently interacting with the map with your mouse.
    First, create a mouseTracker object when you create your map:
    
        map.options.mouseTracker = new L.MouseTracker(map);
        
    And then you can enable it whenever you want to do mousey-stuff:
    
        map.options.mouseTracker.enable({
            moveCb: function (latlng) {
                // ...
            },
            clickCb: function (latlng) {
                // ..
            },
            cancelCb: function () {}
        });
        
    And disable when you're done:
    
        map.options.mouseTracker.disable();
        
    There are no instantiation options, although there are a few options you can pass in on the call to enable()
*/

L.MouseTracker = L.Handler.extend({
    includes: L.Evented.prototype,
    
    // @method initialize(): void
    initialize: function (map, options) {
        L.Handler.prototype.initialize.call(this);
        
        this._map = map;
        this._container = map._container;
        this._enabled = false;
        this.moveCb = null;
        this.clickCb = null;
        this.cancelCb = null;
        
		L.setOptions(this, options);
        this.options.icon = new L.DivIcon({
			iconSize: new L.Point(8, 8),
			className: 'leaflet-div-icon leaflet-editing-icon lmt-base-icon'
		});
    },

    // callOptions:
    //   moveCb: callback function that is called whenever the mouse is moved; it will receive one argument, the mouse's current latlng. Defaults to null.
    //   clickCb: callback function that is called when the mouse is clicked; it will receive one argument, the mouse's final latlng. Defaults to null.
    //   cancelCb: callback function that is called when the escape key is pressed while the mouseTracker is enabled. Defaults to null.
    //
    //   forceFocusMap: when calling mouseTracker.enable(), forceFocusMap=true will cause the map to be focused. Defaults to false.
    //   snap: if L.Snap exists and this option is set to true, then mouseTracker will always snap coordinates. Defaults to false.
    //   pointer: if a custom pointer is to be used, specify its name here. see leaflet.mousetracker.css.
    //   returnTo: after clickCb has finished, then if returnTo is set to a DOM element, then will be focused. To be used with forceFocusMap. Defaults to null.
    
    enable: function (callOptions) {
        if (this._enabled) {
            return;
        }
        
        this.callOptions = callOptions || {};

        L.Handler.prototype.enable.call(this);
        this.fire('enabled');
    },

    disable: function () {
        if ( !this._enabled) {
            return;
        }

        this.fire('disabled');
        L.Handler.prototype.disable.call(this);
    },
    
    addHooks: function () {
        var co = this.callOptions;
        L.DomUtil.disableTextSelection();
        
        if (co.forceFocusMap === true) {
            this._map.getContainer().focus();
        }
        
        this.moveCb = (co.moveCb) ? co.moveCb : null;
        this.clickCb = (co.clickCb) ? co.clickCb : null;
        this.cancelCb = (co.cancelCb) ? co.cancelCb : null;
        L.DomEvent.on(this._container, 'keyup', this._cancelDrawing, this);
        
        var clickthrough = ' lmt-base-icon';
        if (co.hasOwnProperty('pointer')) {
            L.DomUtil.addClass(document.documentElement, 'lmt_' + co.pointer);
            L.DomUtil.addClass(this._map._container, 'lmt_inheritcursor');
        }
        
        // Make a transparent marker that will used to catch click events. These click
        // events will create the vertices. We need to do this so we can ensure that
        // we can create vertices over other map layers (markers, vector layers). We
        // also do not want to trigger any click handlers of objects we are clicking on
        // while drawing.
        if (! this._mouseMarker) {
            this._mouseMarker = L.marker(this._map.getCenter(), {
                icon: L.divIcon({
                    className: 'leaflet-mouse-marker' + clickthrough,
                    iconAnchor: [20, 20],
                    iconSize: [40, 40]
                }),
                opacity: 0,
                zIndexOffset: 3000,
                noShadow: true
            });
        }
        
        this._mouseMarker
            .on('mousedown', this._onMouseDown, this)
            .on('mouseup', this._onMouseUp, this) // Necessary for 0.8 compatibility
            .on('mousemove', this._onMouseMove, this) // Necessary to prevent 0.8 stutter
            .addTo(this._map);

        this._map
            .on('mousedown', this._onMouseDown, this)
            .on('mouseup', this._onMouseUp, this) // Necessary for 0.7 compatibility
            .on('touchstart', this._onTouch, this)
            .on('mousemove', this._onMouseMove, this);
            
        L.DomEvent.on(this._container, 'keyup', this._cancelDrawing, this);
    },
    
    removeHooks: function () {
        this._mouseMarker
            .off('mousedown', this._onMouseDown, this)
            .off('mouseup', this._onMouseUp, this)
            .off('mousemove', this._onMouseMove, this);
            
        this._map.removeLayer(this._mouseMarker);
        delete this._mouseMarker;

        this._map
            .off('mousedown', this._onMouseDown, this)
            .off('mouseup', this._onMouseUp, this)
            .off('mousemove', this._onMouseMove, this)
            .off('touchstart', this._onTouch, this);
            
        L.DomUtil.enableTextSelection();
        L.DomEvent.off(this._container, 'keyup', this._cancelDrawing);
        
        var co = this.callOptions;
        if (co.hasOwnProperty('pointer')) {
            L.DomUtil.removeClass(document.documentElement, 'lmt_' + co.pointer);
            L.DomUtil.removeClass(this._map._container, 'lmt_inheritcursor');
        }
        
        if (co.hasOwnProperty('returnTo') && (co.returnTo !== null) && (typeof(co.returnTo) != 'undefined')) {
            setTimeout(function () {
                co.returnTo.focus();
            }, 10);
        }
        
        this.callOptions = {};
    },
    
    _getSnappedLL: function (latlng) {
        if (this.callOptions.hasOwnProperty('snap') && this.callOptions.snap && latlng) {
            this._mouseMarker.setLatLng(latlng);
            var snappedLatLngInfo = this._manuallyCorrectClick(latlng);
            if (snappedLatLngInfo && snappedLatLngInfo.latlng) {
                return snappedLatLngInfo.latlng;
            }
        }
        
        return latlng;
    },
    
    _onMouseMove: function (e) {
        var newPos = this._map.mouseEventToLayerPoint(e.originalEvent);
        var latlng = this._map.layerPointToLatLng(newPos);
        this._currentLatLng = this._getSnappedLL(latlng);
        
        // Update the mouse marker position
        this._mouseMarker.setLatLng(this._currentLatLng);

        L.DomEvent.preventDefault(e.originalEvent);
        if (this.moveCb !== null) {
            this.moveCb(this._currentLatLng);
        }
    },
    
    _onMouseDown: function (e) {
        var originalEvent = e.originalEvent;
        var clientX = originalEvent.clientX;
        var clientY = originalEvent.clientY;
        
        this._startPoint.call(this, clientX, clientY);
    },
    
    _startPoint: function (clientX, clientY) {
        this._mouseDownOrigin = L.point(clientX, clientY);
    },

    _onMouseUp: function (e) {
        var originalEvent = e.originalEvent;
        var clientX = originalEvent.clientX;
        var clientY = originalEvent.clientY;
        
        this._endPoint.call(this, clientX, clientY, e);
    },
    
    _endPoint: function (clientX, clientY, e) {
        if (this._mouseDownOrigin) {
            // We detect clicks within a certain tolerance, otherwise let it
            // be interpreted as a drag by the map
            /*var distance = L.point(clientX, clientY)
                .distanceTo(this._mouseDownOrigin);
                
            console.log('checking end', distance, window.devicePixelRatio, L.point(clientX, clientY), this._mouseDownOrigin, e.latlng);
            if (Math.abs(distance) < 9 * (window.devicePixelRatio || 1)) {*/
                var bbounds = this._map.options.maxBounds;
                if (!bbounds || (bbounds && bbounds.contains(e.latlng))) {
                    var latlng = this._getSnappedLL(e.latlng);
                    this._map.fire('mousetracker:click', { 'latlng': latlng });
                    if (this.clickCb !== null) {
                        this.clickCb(latlng);
                    }
                }
            //}
        }
        
        this._mouseDownOrigin = null;
    },

    _onTouch: function (e) {
        var originalEvent = e.originalEvent;
        var clientX;
        var clientY;
        if (originalEvent.touches && originalEvent.touches[0]) {
            clientX = originalEvent.touches[0].clientX;
            clientY = originalEvent.touches[0].clientY;
            this._startPoint.call(this, clientX, clientY);
            this._endPoint.call(this, clientX, clientY, e);
        }
    },

    // Cancel drawing when the escape key is pressed
    _cancelDrawing: function (e) {
        if (this._enabled) {
            if (e.keyCode === 27) {
                if (this.cancelCb !== null) {
                    this.cancelCb();
                }
                this.disable();
                this._map.fire('mousetracker:canceled', { 'latlng': e.latlng });
            }
        }
    }
});

if (L.Draw && L.Draw.Feature.SnapMixin) {
    L.MouseTracker.include(L.Draw.Feature.SnapMixin);
    L.MouseTracker.addInitHook('_snap_initialize');
}

if (L.Draw && L.Draw.Feature.GuidelineMixin) {
    L.MouseTracker.include(L.Draw.Feature.GuidelineMixin);
    L.MouseTracker.addInitHook('_guide_initialize');
}