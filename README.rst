===============
Leaflet.MouseTracker
===============

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
    
There are no instantiation options, although there are a few options you can pass in on the call to enable():

----------------
moveCb
----------------

Callback function that is called whenever the mouse is moved; it will receive one argument, the mouse's current latlng. Defaults to null.

----------------
clickCb
----------------

Callback function that is called when the mouse is clicked; it will receive one argument, the mouse's final latlng. Defaults to null.

----------------
cancelCb
----------------

Callback function that is called when the escape key is pressed while the mouseTracker is enabled. Defaults to null.
    
----------------
forceFocusMap
----------------

When calling mouseTracker.enable(), forceFocusMap=true will cause the map to be focused. Defaults to false.

----------------
snap
----------------

If L.Snap exists and this option is set to true, then mouseTracker will always snap coordinates. Defaults to false.

----------------
pointer
----------------

If a custom pointer is to be used, specify its name here. Make sure to create a pointer class as is done in leaflet.mousetracker.css.

----------------
returnTo
----------------

After clickCb has finished, then if returnTo is set to a DOM element, then will be focused. To be used with forceFocusMap. Defaults to null.