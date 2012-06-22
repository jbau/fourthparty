/*
A MozMill script for running a web crawl that:
-disables opening new tabs and popups
-disables most modal dialogs
-cycles private browsing with each page load
*/ 

// Point to a local copy of the latest mozmill-test repository
// See https://developer.mozilla.org/en/Mozmill_Tests/Shared_Modules
// On Windows, format path like file://C:/...
var MOZMILL_TEST_ROOT = "";

/*
var PrivateBrowsingAPI = require(MOZMILL_TEST_ROOT + "lib/private-browsing");
var privateBrowsing;
*/
var PAGE_LOAD_TIMEOUT = 10000;
var PAGE_WAIT = 10000;


var setupModule = function(module) {
	module.controller = mozmill.getBrowserController();
/*	
	// Setup private browsing control
	privateBrowsing = new PrivateBrowsingAPI.privateBrowsing(module.controller);
	privateBrowsing.showPrompt = false;
	privateBrowsing.waitForTransitionComplete = privateBrowsing.waitForTransistionComplete;
	module.cyclePrivateBrowsing = function() {
		privateBrowsing.stop();
		privateBrowsing.waitForTransitionComplete(false);
		privateBrowsing.start();
		privateBrowsing.waitForTransitionComplete(true);
	};

	*/
}
// BEGIN_REPEAT

var testURL_NUMBER = function(){
	controller.open("URL");
	controller.waitForPageLoad(PAGE_LOAD_TIMEOUT);
	controller.sleep(PAGE_WAIT);
}
// END_REPEAT

var teardownModule = function(module) {
	privateBrowsing.stop();
}
