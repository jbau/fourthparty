<!-- contributed by Myk Melez [myk@mozilla.org] -->
<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com] -->

The `panel` module creates floating modal "popup dialogs" that appear on top of
web content and browser chrome and persist until dismissed by users or programs.
Panels are useful for presenting temporary interfaces to users in a way that is
easier for users to ignore and dismiss than a modal dialog, since panels are
hidden the moment users interact with parts of the application interface outside
them.

Introduction
------------

The module exports a single constructor function `Panel` which constructs a
new panel.

A panel's content is loaded as soon as it is created, before the panel is shown,
and the content remains loaded when a panel is hidden, so it is possible
to keep a panel around in the background, updating its content as appropriate
in preparation for the next time it is shown.

Panels have associated content scripts, which are JavaScript scripts that have
access to the content loaded into the panels.  An add-on can specify one or
more content scripts to load for a panel, and the add-on can communicate with
those scripts via an asynchronous event emitter API.  See
[Working with Content Scripts](dev-guide/addon-development/web-content.html)
for more information.

Events
------

Panels emit the following types of
[events](dev-guide/addon-development/events.html).

### message ###

This event is emitted when the panel's content scripts post a message.
Listeners are passed the message as their first and only argument.

### show ###

This event is emitted when the panel is shown.

### hide ###

This event is emitted when the panel is hidden.

Examples
--------

Create and show a simple panel with content from the `data/` directory:

    const data = require("self").data;
    var panel = require("panel").Panel({
      contentURL: data.url("foo.html")
    });

    panel.show();

The tutorial section on
[web content](dev-guide/addon-development/web-content.html) has
a more complex example using panels.

<api name="Panel">
@class
The Panel object represents a floating modal dialog that can by an add-on to
present user interface content.

Once a panel object has been created it can be shown and hidden using its
`show()` and `hide()` methods. Once a panel is no longer needed it can be
deactivated using `destroy()`.

The content of a panel is specified using the `contentURL` option. An add-on
can interact with the content of a panel using content scripts which it
supplies in the `contentScript` and/or `contentScriptFile` options. For example,
a content script could create a menu and send the user's selection to the
add-on.

<api name="Panel">
@constructor
Creates a panel.
@param options {object}
  Options for the panel, with the following keys:
  @prop [width] {number}
    The width of the panel in pixels. Optional.
  @prop [height] {number}
    The height of the panel in pixels. Optional.
  @prop [contentURL] {string}
    The URL of the content to load in the panel.
  @prop [allow] {object}
    An optional object describing permissions for the content.  It should
    contain a single key named `script` whose value is a boolean that indicates
    whether or not to execute script in the content.  `script` defaults to true.
  @prop [contentScriptFile] {string,array}
    A local file URL or an array of local file URLs of content scripts to load.
    Content scripts specified by this property are loaded *before* those
    specified by the `contentScript` property.
  @prop [contentScript] {string,array}
    A string or an array of strings containing the texts of content scripts to
    load.  Content scripts specified by this property are loaded *after* those
    specified by the `contentScriptFile` property.
  @prop [contentScriptWhen="end"] {string}
    When to load the content scripts. This may take one of the following
    values:

    * "start": load content scripts immediately after the document
    element for the panel is inserted into the DOM, but before the DOM content
    itself has been loaded
    * "ready": load content scripts once DOM content has been loaded,
    corresponding to the
    [DOMContentLoaded](https://developer.mozilla.org/en/Gecko-Specific_DOM_Events)
    event
    * "end": load content scripts once all the content (DOM, JS, CSS,
    images) for the panel has been loaded, at the time the
    [window.onload event](https://developer.mozilla.org/en/DOM/window.onload)
    fires

    This property is optional and defaults to "end".

  @prop [onMessage] {function}
    An optional "message" event listener.  See Events above.
  @prop [onShow] {function}
    An optional "show" event listener.  See Events above.
  @prop [onHide] {function}
    An optional "hide" event listener.  See Events above.
</api>

<api name="port">
@property {EventEmitter}
[EventEmitter](packages/api-utils/docs/events.html) object that allows you to:

* send events to the content script using the `port.emit` function
* receive events from the content script using the `port.on` function

See
<a href="dev-guide/addon-development/web-content.html#content_script_events">
Communicating with Content Scripts</a> for details.
</api>

<api name="isShowing">
@property {boolean}
Tells if the panel is currently shown or not. This property is read-only.
</api>

<api name="height">
@property {number}
The height of the panel in pixels.
</api>

<api name="width">
@property {number}
The width of the panel in pixels.
</api>

<api name="contentURL">
@property {string}
The URL of the content loaded in the panel.
</api>

<api name="allow">
@property {object}
An object describing permissions for the content.  It contains a single key
named `script` whose value is a boolean that indicates whether or not to execute
script in the content.
</api>

<api name="contentScriptFile">
@property {string,array}
A local file URL or an array of local file URLs of content scripts to load.
Content scripts specified by this property are loaded *before* those
specified by the `contentScript` property.
</api>

<api name="contentScript">
@property {string,array}
A string or an array of strings containing the texts of content scripts to
load.  Content scripts specified by this property are loaded *after* those
specified by the `contentScriptFile` property.
</api>

<api name="contentScriptWhen">
@property {string}
When to load the content scripts. This may have one of the following
values:

* "start": load content scripts immediately after the document
element for the panel is inserted into the DOM, but before the DOM content
itself has been loaded
* "ready": load content scripts once DOM content has been loaded,
corresponding to the
[DOMContentLoaded](https://developer.mozilla.org/en/Gecko-Specific_DOM_Events)
event
* "end": load content scripts once all the content (DOM, JS, CSS,
images) for the panel has been loaded, at the time the
[window.onload event](https://developer.mozilla.org/en/DOM/window.onload)
fires

</api>

<api name="destroy">
@method
Destroys the panel, unloading any content that was loaded in it. Once
destroyed, the panel can no longer be used. If you just want to hide
the panel and might show it later, use `hide` instead.
</api>

<api name="postMessage">
@method
Sends a message to the content scripts.
@param message {value}
The message to send.  Must be stringifiable to JSON.
</api>

<api name="show">
@method
Displays the panel.
@param [anchor] {handle}
A handle to a DOM node in a page to which the panel should appear to be
anchored.  If not given, the panel is centered inside the most recent browser
window. Note that it is not currently possible to anchor panels in this way
using only the high level APIs.
</api>

<api name="hide">
@method
Stops displaying the panel.
</api>

<api name="resize">
@method
Resizes the panel.
@param width {number}
The new width of the panel in pixels.
@param height {number}
The new height of the panel in pixels.
</api>

<api name="on">
@method
  Registers an event listener with the panel.
@param type {string}
  The type of event to listen for.
@param listener {function}
  The listener function that handles the event.
</api>

<api name="removeListener">
@method
  Unregisters an event listener from the panel.
@param type {string}
  The type of event for which `listener` was registered.
@param listener {function}
  The listener function that was registered.
</api>
</api>
