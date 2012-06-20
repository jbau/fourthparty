/* Jason Bau 10-25-2011.  With much borrowing from Firebug source */

const {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");

const jsd = Cc["@mozilla.org/js/jsd/debugger-service;1"].getService(Ci.jsdIDebuggerService);

const COMPONENTS_FILTERS = [
    new RegExp("^(file:/.*/)extensions/%7B[\\da-fA-F]{8}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{12}%7D/components/.*\\.js$"),
    new RegExp("^(file:/.*/)extensions/firebug@software\\.joehewitt\\.com/modules/.*\\.js$"),
    new RegExp("^(file:/.*/extensions/)\\w+@mozilla\\.org/components/.*\\.js$"),
    new RegExp("^(file:/.*/components/)ns[A-Z].*\\.js$"),
    new RegExp("^(file:/.*/modules/)firebug-[^\\.]*\\.js$"),
    new RegExp("^(file:/.*/Contents/MacOS/extensions/.*/components/).*\\.js$"),
    new RegExp("^(file:/.*/modules/).*\\.jsm$"),
];

const data = require("self").data;
var pageManager = require("page-manager");
var loggingDB = require("logging-db");

var urlFilters = [
    'chrome://',
    'XStringBundle',
    'x-jsd:ppbuffer?type=function', // internal script for pretty printing
];

function createFilter(pattern, pass)
    {
        var jsdIFilter = Ci.jsdIFilter;
        var filter = {
            globalObject: null,
            flags: pass ? (jsdIFilter.FLAG_ENABLED | jsdIFilter.FLAG_PASS) : jsdIFilter.FLAG_ENABLED,
            urlPattern: pattern,
            startLine: 0,
            endLine: 0
        };
        return filter;
    }

var createChromeBlockingFilters = function() // call after components are loaded.
    {
        try
        {
            var filterModules = createFilter("*/firefox/modules/*");
            var filterComponents = createFilter("*/firefox/components/*");
            var filterFirebugComponents = createFilter("*/modules/firebug-*");
            var filterStringBundle = createFilter("XStringBundle");
            var filterChrome = createFilter("chrome://*");
            var filterPrettyPrint = createFilter("x-jsd:ppbuffer*");
            var filterWrapper = createFilter("XPCSafeJSObjectWrapper.cpp");
            var noFilterHalter = createFilter("resource://firebug/debuggerHalter.js", true);

            // jsdIFilter does not allow full regexp matching.
            // So to filter components, we filter their directory names, which we obtain by looking for
            // scripts that match regexps

            var componentsUnfound = [];
            for( var i = 0; i < COMPONENTS_FILTERS.length; ++i )
            {
                componentsUnfound.push(COMPONENTS_FILTERS[i]);
            }

            componentFilters = [];

            jsd.enumerateScripts( {
                enumerateScript: function(script) {
                    var fileName = script.fileName;
                for( var i = 0; i < componentsUnfound.length; ++i )
                    {
                        if ( componentsUnfound[i].test(fileName) )
                        {
                            var match = componentsUnfound[i].exec(fileName);
                            componentFilters.push(createFilter(match[1]));
                            componentsUnfound.splice(i, 1);
                            return;
                        }
                    }
                }
            });
            
        } catch (exc) {
        }
    };


var js_tags=0;
var staticHTMLs = {};
exports.recordHTML = function(src,html) {
    staticHTMLs[src]=html;
    //console.log(src+":"+html);
}

exports.clearHTMLStore = function() {
    staticHTMLs = {};
}

exports.run = function() {

	var createJavascriptTable = data.load("create_javascript_table.sql");
	loggingDB.executeSQL(createJavascriptTable, false);
    
    jsd.topLevelHook = {
        onCall: function(frame, type) {
            var patt = new RegExp("^(http|https):\/\/","i");
            if (patt.test(frame.script.fileName) &&  type == Ci.jsdICallHook.TYPE_TOPLEVEL_START) {
                var result={};
		var fileNameWODomain = frame.script.fileName.slice(frame.script.fileName.lastIndexOf('/')+1); 
                frame.eval("if(!document.currentScript.hasAttribute('__fp_tag'))"+
                           "document.currentScript.setAttribute('__fp_tag',"+(js_tags)+")","",1,result); //js_tag is the javascript tag?

		dump('script_location:'+frame.script.fileName+'\n');               

		var location = frame.executionContext.globalObject.getWrappedValue().document.location;
		//var result2={};
		//frame.eval("document.currentScript.setAttribute('__fp_execOnPage','"+location+"')","",1,result2);
		//dump(staticHTMLs[location].toLowerCase());
			
		      
		dump('checkpoint0 reached:'+ fileNameWODomain+ '\n');
         	//console.log(XPCSafeJSObjectWrapper(unwrapped));   
                            
                //Test for script filename in the static source of the document.  If found, then
                //document.location is the parent of the current script (encode with -1).  
		if (staticHTMLs[location]==null)dump("not fetched\n");
                if(fileNameWODomain != "" && staticHTMLs[location]!=null && 
                   staticHTMLs[location].toLowerCase().indexOf(fileNameWODomain.toLowerCase()) >= 0) {

			dump('first\n');
                     frame.eval("if(!document.currentScript.hasAttribute('__fp_curScriptDuringCreate'))"+
                                "document.currentScript.setAttribute('__fp_curScriptDuringCreate',-1);","",1,result);
                }
                else {//Try to see if the script source code is in the static HTML.  Again, if found,
                      //document.location is the parent of the current script (encode with -1).
			//dump(staticHTMLs[location]+"\n");
                    if (staticHTMLs[location].toLowerCase().indexOf(
                         frame.script.functionSource.toLowerCase().slice(0,63))) {
			    dump('third\n');
                            frame.eval("if(!document.currentScript.hasAttribute('__fp_curScriptDuringCreate'))"+
                                      "document.currentScript.setAttribute('__fp_curScriptDuringCreate',-1);","",1,result);
                            }

                }


		dump('checkpoint1 reached\n');               

		//many of the attributes below are set in other files
		var raw_pageID = {};
		frame.eval("document.currentScript.getAttribute('__fp_pageID')","",1,raw_pageID);
		var pageID = raw_pageID.value.getWrappedValue();

		dump('checkpoint2 reached\n');               

		var raw_src = {};
		var disposition; // 0 is inline, 1 is external
		frame.eval("document.currentScript.getAttribute('src')","",1,raw_src);
		var src = raw_src.value.getWrappedValue();
		if (!src || src == "")
			disposition = 0;
		else disposition =1;
		
		if (disposition)location = src;	//if the script is external, then we fetch the real src

		dump('checkpoint3 reached\n');               
		
		var raw_creatorID={};
		frame.eval("document.currentScript.getAttribute('__fp_curScriptDuringCreate')","",1,raw_creatorID);
		var creatorID=raw_creatorID.value.getWrappedValue();

		var raw_method={};
		frame.eval("document.currentScript.getAttribute('__fp_creationMethod')","",1,raw_method);
		var method=raw_method.value.getWrappedValue();

		var raw_duringCreate={};
		frame.eval("document.currentScript.getAttribute('__fp_curScriptDuringCreate')","",1,raw_duringCreate);
		var is_static = (raw_duringCreate.value.getWrappedValue() == -1) ? 1 : 0; // 1 is static, 0 is dynamic
		
                
		//log everything!
		//id(int), page_id(int), disposition(byte), creator_script_id(int), created_method(TEXT), is_static (byte), location(TEXT)
		var update = {};
		update["id"] = js_tags++;
		update["page_id"] = pageID;
		update["disposition"] = disposition;
		update["creator_script_id"] = creatorID;
		update["created_method"] = method;
		update["is_static"] = is_static;
		update["location"] = loggingDB.escapeString(location);


		dump('checkpoint4 reached\n');

		loggingDB.executeSQL(loggingDB.createInsert("javascript",update),true);
		
            }
        }
    }
    
    
    jsd.asyncOn(function(){
    
        jsd.clearFilters(); // clear the list of filters

                        
        // we exclude the scripts with the following filenames from being tracked
        jsd.appendFilter(createFilter("*/firefox/components/*"));
        jsd.appendFilter(createFilter("*/firefox/modules/*"));
        jsd.appendFilter(createFilter("XStringBundle"));
        jsd.appendFilter(createFilter("chrome://*"));
        jsd.appendFilter(createFilter("resource:///*"));
        jsd.appendFilter(createFilter("x-jsd:ppbuffer*"));
        jsd.appendFilter(createFilter("XPCSafeJSObjectWrapper.cpp"));
        jsd.appendFilter(createFilter("file://*"));

   
    
    });

	/*
    jsd.scriptHook = {
        onScriptCreated: function(script) {
            var patt = new RegExp("^(http|https):\/\/","i");
            if (patt.test(script.fileName)) {
                //dump("file: "+script.fileName+"\n  fn:"+script.functionName +"\n");
                //console.trace();
            }
        },
        onScriptDestroyed: function(script) {
        // your function here
        }
    };

    jsd.errorHook = {
        onError: function(message, fileName, lineNo, colNo, flags, errnum, exc) {
        
        //dump(message + "@" + fileName + "@" + lineNo + "@" + colNo + "@" + errnum + "\n");

        
        // check message type
        var jsdIErrorHook = Ci.jsdIErrorHook;
        var messageType;
        if (flags & jsdIErrorHook.REPORT_ERROR){
            messageType = "Error";
        }
        if (flags & jsdIErrorHook.REPORT_WARNING)
            messageType = "Warning";
        if (flags & jsdIErrorHook.REPORT_EXCEPTION){
            messageType = "Uncaught-Exception";
        }
        if (flags & jsdIErrorHook.REPORT_STRICT)
            messageType += "-Strict";

        //dump(messageType + "\n");
    
        //return false; // trigger debugHook
            
        return true;// return true if you do not wish to trigger debugHook
        }
    };

    // note that debugHook does not _always_ trigger when jsd.errorHook[onError] returns false 
    // it is not well-known why debugHook sometimes fails to trigger 
    jsd.debugHook = {
        onExecute: function(frame, type, rv) {
        stackTrace = "";
        for (var f = frame; f; f = f.callingFrame) {
            stackTrace += f.script.fileName + "@" + f.line + "@" + f.functionName + "\n";
        }
        dump(stackTrace);
        console.log(stackTrace);
        return Ci.jsdIExecutionHook.RETURN_CONTINUE;
        }
    };
   */ 
    /*
    
    jsd.throwHook = {
        onExecute: function(frame, type, rv) {
        stackTrace =  "---------START TRACE-------\n";
        for (var f = frame; f; f = f.callingFrame) {
            stackTrace += "globalObject.location: " + f.executionContext.globalObject.getWrappedValue().document.location + "  trace:" + f.script.fileName + "@" + f.line + "@" + f.functionName + "\n";
        }
        stackTrace += "----------END TRACE--------\n";
        var msg = rv.value.getWrappedValue().message;
        if (msg == "StackTrace")
            dump(msg + "\n" + stackTrace);

        return Ci.jsdIExecutionHook.RETURN_CONTINUE_THROW;
        }
    };
    */


}
