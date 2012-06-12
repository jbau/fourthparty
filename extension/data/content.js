

//FOURTH-PARTY content.js
// Wrap in a function closure to hide variables
(function () {

var request = new XMLHttpRequest();
request.open('GET', document.location, false); 
request.send(null);

var staticHTML = "";

if (request.status == 200) {
  staticHTML = request.responseText;
  self.port.emit('staticHTML', {
    src:document.location,
    html:staticHTML});
}


// Bypass the Jetpack DOM wrapper
//let(window = unsafeWindow) {

// Header guard workaround for Jetpack multiple script loading bug
if(typeof window.navigator.instrumented == "undefined") {
window.navigator.__defineGetter__("instrumented", function() { return true; });

// Debugging

// Default is off, to enable include in your script
// window.navigator.__defineGetter__("intrumentation_debugging", function() { return true; });
window.navigator.__defineGetter__("intrumentation_debugging", function() { return false; });
function debugging() { return window.navigator.instrumentation_debugging; }

// Debugging tool - last accessed variable
var last_accessed = "";
window.navigator.__defineGetter__("last_accessed", function() { return last_accessed; });

// Instrumentation helpers

// Recursively generates a path for an element
function getPathToDomElement(element) {
	if(element == document.body)
		return element.tagName;
	if(element.parentNode == null)
		return 'NULL/' + element.tagName;
	
    var siblingIndex = 1;
    var siblings = element.parentNode.childNodes;
    for (var i = 0; i < siblings.length; i++) {
        var sibling = siblings[i];
        if (sibling == element) {
        	var path = getPathToDomElement(element.parentNode);
        	path += '/' + element.tagName + '[' + siblingIndex;
        	path += ',' + element.id;
        	path += ',' + element.className;
        	if(element.tagName == 'A')
        		path += ',' + element.href;
        	path += ']';
        	return path;
        }
        if (sibling.nodeType == 1 && sibling.tagName == element.tagName)
            siblingIndex++;
    }
}

// Helper for JSONifying objects
function serializeObject(object) {
	
	// Handle permissions errors
	try {
		if(object == null)
			return "null";
		if(typeof object == "function")
			return "FUNCTION";
		if(typeof object != "object")
			return object;
		var seenObjects = [];
		return JSON.stringify(object, function(key, value) {
			if(value == null)
				return "null";
			if(typeof value == "function")
				return "FUNCTION";
			if(typeof value == "object") {
				
				// Remove wrapping on content objects
				if("wrappedJSObject" in value) {
					value = value.wrappedJSObject;
				}
				
				// Serialize DOM elements
				if(value instanceof HTMLElement)
					return getPathToDomElement(value);

				// Prevent serialization cycles
				if(key == "" || seenObjects.indexOf(value) < 0) {
					seenObjects.push(value);
					return value;
				}
				else
					return typeof value;
			}
			return value;
		});
	}
	catch(error) {
		console.log("SERIALIZATION ERROR: " + error);
		return "SERIALIZATION ERROR: " + error;
	}
}

function logErrorToConsole(error) {
	console.log("Error name: " + error.name);
	console.log("Error message: " + error.message);
	console.log("Error filename: " + error.fileName);
	console.log("Error line number: " + error.lineNumber);
	console.log("Error stack: " + error.stack);
}

// Prevent logging of gets arising from logging
var inLog = false;

// For gets, sets, etc. on a single value
function logValue(instrumentedVariableName, value, operation) {
	if(inLog)
		return;
	inLog = true;
	try {
		self.port.f("instrumentation", {
			operation: operation,
			symbol: instrumentedVariableName,
			value: serializeObject(value)
		});
	}
	catch(error) {
	/*
		console.log("Unsuccessful value log!");
		console.log("Operation: " + operation);
		console.log("Symbol: " + instrumentedVariableName);
		console.log("String Value: " + value);
		console.log("Serialized Value: " + serializeObject(value));
		logErrorToConsole(error);
	*/
	}
	inLog = false;
}

// For functions
function logCall(instrumentedFunctionName, args) {
	if(inLog)
		return;
	inLog = true;
	try {	
		/*
		console.log("logCall");
		console.log("Function Name: " + instrumentedFunctionName);
		console.log("Args: " + args.length);
		for(var i = 0; i < args.length; i++) {
			var logLine = "Arg " + i + ": ";
			console.log(logLine + typeof args[i]);
			if(typeof args[i] == "string")
				console.log(logLine + args[i]);
			if(typeof args[i] == "object") {
				console.log("" + args[i]);
				console.log("" + args[i].wrappedJSObject);
				console.log(logLine + Object.keys(args[i]));
			}
		}*/
		// Convert special arguments array to a standard array for JSONifying
		var serialArgs = [ ];
		for(var i = 0; i < args.length; i++)
			serialArgs.push(serializeObject(args[i]));
		self.port.emit("instrumentation", {
			operation: "call",
			symbol: instrumentedFunctionName,
			args: serialArgs,
			value: ""
		});
	}
	catch(error) {
		console.log("Unsuccessful call log: " + instrumentedFunctionName);
		logErrorToConsole(error);
	}
	inLog = false;
}

/*
function log(instrumentedVariableName) {
	try {
		self.postMessage(instrumentedVariableName);
		if(debugging())
			last_accessed = instrumentedVariableName;
	}
	catch(error) {
		console.log("Attempted to log: " + instrumentedVariableName);
	}
}
*/

// Disable setting the document location directly
// Jetpack scripts currently detach when the document is changed in JavaScript

// Make an anonymous handler function that returns an object
function makeHandler(object) {
	return function() { return object; };
}

// Make an instrumented object proxy
function makeObjectProxy(objectName, object) {
	return Proxy.create({
		getOwnPropertyDescriptor: function(name) {
			return Object.getOwnPropertyDescriptor(object, name);
		},

		getPropertyDescriptor: function(name) {
			return Object.getPropertyDescriptor(object, name);
		},

		getOwnPropertyNames: function() {
			return Object.getOwnPropertyNames(object);
		},

		getPropertyNames: function() {
			return Object.getPropertyNames(object);
		},

		defineProperty: function(name, description) {
			Object.defineProperty(object, name, description);
		},

		delete: function(name) {
			return delete object[name];
		},

		fix: function() {
			return undefined;
		},

		has: function(name) {
			return name in object;
		},

		hasOwn: function(name) {
			return ({}).hasOwnProperty.call(object, name);
		},
		
		get: function(receiver, name) {
			if(typeof object[name] == "function")
				return makeFunctionProxy(object, objectName + "." + name, object[name]);
			else {
				logValue(objectName + "." + name, object[name], "get");
				return object[name];
			}
		},
		
		set: function(receiver, name, val) {
			logValue(objectName + "." + name, val, "set");
			object[name] = val;
			return true;
		},
		
		enumerate: function() {
			logValue(objectName, null, "enumerate");
			var result = [];
			for(name in object)
				result.push(name);
			return result;
		},
		
		keys: function() {
			logValue(objectName, null, "keys");
			return Object.keys(object);
		}
	});
}

function prettyPrintParameter(parameter)
{
	if(typeof parameter == "string")
		return '"' + parameter + '"';
	else
		return parameter;
}

// Make an instrumented function proxy
function makeFunctionProxy(object, functionName, func) {
	return Proxy.createFunction({
		getOwnPropertyDescriptor: function(name) {
			return Object.getOwnPropertyDescriptor(func, name);
		},

		getPropertyDescriptor: function(name) {
			return Object.getPropertyDescriptor(func, name);
		},

		getOwnPropertyNames: function() {
			return Object.getOwnPropertyNames(func);
		},

		getPropertyNames: function() {
			return Object.getPropertyNames(func);
		},

		defineProperty: function(name, description) {
			Object.defineProperty(func, name, description);
		},

		delete: function(name) {
			return delete func[name];
		},

		fix: function() {
			return undefined;
		},

		has: function(name) {
			return name in func;
		},

		hasOwn: function(name) {
			return ({}).hasOwnProperty.call(func, name);
		},
		
		get: function(receiver, name) {
			return func[name];
		},
		
		set: function(receiver, name, val) {
			func[name] = val;
			return true;
		},
		
		enumerate: function() {
			for(name in func)
				result.push(name);
			return result;
		},
		
		keys: function() {
			return Object.keys(func);
		}
	},
	function() {
		logCall(functionName, arguments);
        if (functionName == "document.createElement" && 
            arguments[0]=="script") {
            //try{throw new Error("StackTrace");}
            //catch (e){};
            var scr = func.apply(object,arguments);
            //scr.addEventListener('load',alert_source(scr));
            //scr.setAttribute('__fp_sTag',  document.location + ":" + (s_tag++));
            scr.setAttribute('__fp_curScriptDuringCreate',  document.currentScript.getAttribute('__fp_tag'));
            return scr;
            //console.log(object.location);
            //console.trace();            
        }
        if (functionName == "document.write" && 
            arguments[0].indexOf("script") != -1) {
            var tmp_arg = arguments[0];
            var replacement = '<script __fp_curScriptDuringCreate="' + document.currentScript.getAttribute('__fp_tag') + '" '; 
            //alert(replacement);
            arguments[0]=tmp_arg.replace(/<script/gi, replacement); 
            //try{throw new Error("StackTrace");}
            //catch (e){};
            //console.log(object.location);
            //console.trace();
        }
		return func.apply(object, arguments);
	},
	function() {
		return null;
	});
}

var s_tag = 0;

/*
document.onbeforescriptexecute = function(e) {
        alert(document.currentScript);
    };
*/

function alert_source(arg){
    return function(){alert(arg.src)};
}

// Make an instrumented object handler
function makeObjectProxyHandler(objectName, object) {
	return makeHandler(makeObjectProxy(objectName, object));
}

// Make an instrumented function handler
function makeFunctionProxyHandler(object, functionName, func) {
	return makeHandler(makeFunctionProxy(object, functionName, func));
}

// Make an instrumented variable handler
// TODO: Include support for setting variables
function makeVariableProxyHandler(name, value) {
	return function() {
		logValue(name, value, "get");
		return value;
	};
}

// Instrument an object's property, treating the property as an object
function instrumentObjectPropertyAsObject(object, objectName, property, propertyName) {
	object.__defineGetter__(propertyName, makeObjectProxyHandler(objectName + "." + propertyName, property));
}

// Instrument an object's property, treating the property as a variable
function instrumentObjectPropertyAsVariable(object, objectName, property, propertyName) {
	object.__defineGetter__(propertyName, makeVariableProxyHandler(objectName + "." + propertyName, property));
}

// Instrumentation

// Instrument window.screen.*
// WORKS
instrumentObjectPropertyAsObject(window, "window", window.screen, "screen");

// Instrument window.navigator.*
// window.navigator is defined as const, so must instrument variable by variable
// WORKS
var navigatorProperties = [ "appCodeName", "appMinorVersion", "appName", "appVersion", "cookieEnabled", "cpuClass", "onLine", "opsProfile", "platform", "product", "systemLanguage", "userAgent", "userLanguage", "userProfile" ];
for each (var property in navigatorProperties)
	instrumentObjectPropertyAsVariable(window.navigator, "window.navigator", window.navigator[property], property);

// Instrument each plugin in window.navigator.plugins
// WORKS
// TODO: Instrument plugins returned by the item and namedItem methods
// TODO: Instrument the mime type within each plugin
// TODO: Separately instrument the mimetypes for lookup by type and index
for(var i = 0; i < window.navigator.plugins.length; i++) {
	// Instrument name lookup
	if(typeof window.navigator.plugins[i].name == "string" && window.navigator.plugins[i].name != "")
		window.navigator.plugins.__defineGetter__(window.navigator.plugins[i].name, makeObjectProxyHandler('window.navigator.plugins["' + window.navigator.plugins[i].name + '"]', window.navigator.plugins[i]));
	// Instrument index lookup
	window.navigator.plugins.__defineGetter__(i, makeObjectProxyHandler("window.navigator.plugins[" + i + "]", window.navigator.plugins[i]));
}

// Instrument window.navigator.plugins.*
// WORKS
instrumentObjectPropertyAsObject(window.navigator, "window.navigator", window.navigator.plugins, "plugins");

// Instrument each mime type in window.navigator.mimeTypes
// Uses deep copies of each mime type to preserve the path through the enabledPlugin property
// WORKS
// TODO: Instrument mime types returned by the item and namedItem methods
// TODO: Separately instrument enabledPlugin for lookup by type and index
for(var i = 0; i < window.navigator.mimeTypes.length; i++) {
	// Instrument type lookup
	if(typeof window.navigator.mimeTypes[i].type == "string" && window.navigator.mimeTypes[i].type != "") {
		window.navigator.mimeTypes[i].__defineGetter__("enabledPlugin", makeObjectProxyHandler('window.navigator.mimeTypes["' + window.navigator.mimeTypes[i].type + '"].enabledPlugin', window.navigator.mimeTypes[i].enabledPlugin));
		window.navigator.mimeTypes.__defineGetter__(window.navigator.mimeTypes[i].type, makeObjectProxyHandler('window.navigator.mimeTypes["' + window.navigator.mimeTypes[i].type + '"]', window.navigator.mimeTypes[i]));
	}
	// Instrument index lookup
	window.navigator.mimeTypes.__defineGetter__(i, makeObjectProxyHandler("window.navigator.mimeTypes[" + i + "]", window.navigator.mimeTypes[i]));
}

// Instrument window.navigator.mimeTypes.*
// WORKS
instrumentObjectPropertyAsObject(window.navigator, "window.navigator", window.navigator.mimeTypes, "mimeTypes");

// Instrument window.navigator.geolocation.* (HTML5 geolocation API)
// WORKS
instrumentObjectPropertyAsObject(window.navigator, "window.navigator", window.navigator.geolocation, "geolocation");

// Instrument window.localStorage (HTML5 local storage API)
// WORKS
instrumentObjectPropertyAsObject(window, "window", window.localStorage, "localStorage");

// Instrument window.sessionStorage (HTML5 session storage API)
// WORKS
instrumentObjectPropertyAsObject(window, "window", window.sessionStorage, "sessionStorage");

// Instrument the HTML5 storage event
//window.addEventListener("storage", function(event) { log("EVENT: " + event.type); }, false);

// Instrument window.getComputedStyle
// WORKS
// TODO: Better represent the element called on
window.__defineGetter__("getComputedStyle", makeFunctionProxyHandler(window, "window.getComputedStyle", window.getComputedStyle));

document.__defineGetter__("createElement", makeFunctionProxyHandler(document, "document.createElement", document.createElement));

document.__defineGetter__("write", makeFunctionProxyHandler(document, "document.write", document.write));



function createWrapper(f) {
    var orig = f;
    orig.call = Function.prototype.call;
    return function (x) { console.log(getStackTrace());
                          return orig.call(this,x);
                          };
}

//document.createElement = createWrapper(document.createElement);

//var orig=document.createElement;
//document.createElement= function(x) {
//    console.trace();
//    alert(document.createElement.caller);
//}

// Instrument window.name
// WORKS
var window_name = window.name;
window.__defineGetter__("name", function() { logValue("window.name", window_name, "get"); return window_name; });
window.__defineSetter__("name", function(value) { logValue("window.name", value, "set"); window_name = value; });

}

//}

})();
