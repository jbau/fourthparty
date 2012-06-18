const {Cc, Ci} = require("chrome");
const data = require("self").data;
var loggingDB = require("logging-db");
var observerService = require("observer-service");

exports.setup = function() {
	// Set up logging
	var createPagesTable = data.load("create_pages_table.sql");
	loggingDB.executeSQL(createPagesTable, false);
	
	// Log new windows
	observerService.add("content-document-global-created", function(subject, data) {
		var window = subject;
		var pageID = pageIDFromWindow(window);
		var parentID = window.parent ? pageIDFromWindow(window.parent) : -1;
		var location = window.document && window.document.location ? window.document.location : "";
		//if (window.document && window.document.location != "")dump("hit1: "+window.document.location+"\n");
		//else dump("hit2: "+data+"\n");
		insertPage(pageID, location, parentID);
	});
	
};

var insertPage = function(pageID, location, parentID) {
	var update = { };
	update["id"] = pageID;
	update["location"] = loggingDB.escapeString(location);
	update["parent_id"] = parentID;
	loggingDB.executeSQL(loggingDB.createInsert("pages", update), true);
};
exports.insertPage = insertPage;

var pageIDFromWindow = function (window) {
	try {
		return window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID;
	}
	catch(error) {
	}
	return -1;
};
exports.pageIDFromWindow = pageIDFromWindow;

exports.pageIDFromHttpChannel = function(httpChannel) {
	try {
		var notificationCallbacks = null;
		if(httpChannel.notificationCallbacks)
			notificationCallbacks = httpChannel.notificationCallbacks;
		else
			notificationCallbacks = httpChannel.loadGroup.notificationCallbacks;
		if(notificationCallbacks) {
			var interfaceRequestor = notificationCallbacks.QueryInterface(Ci.nsIInterfaceRequestor);
			var window = interfaceRequestor.getInterface(Ci.nsIDOMWindow);
			return pageIDFromWindow(window);
		}
	}
	catch(error) {
		//console.log("Error getting page ID: " + httpChannel.URI.spec);
	}
	return -1;
};
