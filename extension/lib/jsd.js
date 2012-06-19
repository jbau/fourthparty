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


var js_instrument = require("javascript-instrument");
var pageMod = require("page-mod");
const data = require("self").data;
var loggingDB = require("logging-db");
var pageManager = require("page-manager");
var tabs = require("tabs");

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
recordHTML = function(src,html) {
    staticHTMLs[src]=html;
    //console.log(src+":"+html);
}

exports.clearHTMLStore = function() {
    staticHTMLs = {};
}

exports.run = function() {

         
	// Set up logging
	var createJavascriptTable = data.load("create_javascript_table.sql");
	loggingDB.executeSQL(createJavascriptTable, false);
	var createJavascriptCallsTable = data.load("create_javascript_calls_table.sql");
	loggingDB.executeSQL(createJavascriptCallsTable, false);
	var javascriptID = 0;
	
	// Inject content script to instrument JavaScript API
	pageMod.PageMod({
		include: "*",
		contentScriptWhen: "start",
		contentScriptFile: data.url("content.js"),
		onAttach: function onAttach(worker) {
			var pageID = worker.windowID;

			worker.port.on("instrumentation", function(data) {
				/*
                var update = {};
				
				update["id"] = javascriptID;
				update["page_id"] = pageID;
                update["disposition"] = data.disposition;//inline or external
                update["creator_script_id"] = data.creatorID;//the script ID of the creator
                update["created_method"] = data.method;//how was the script created? doc.createElement etc.
                update["is_static"]= data.is_static;//if script fetched statically? or dynamically
                update["location"]=data.location;//location of the script origin+path

				loggingDB.executeSQL(loggingDB.createInsert("javascript", update), true);   
			*/

                dump("working!\n");
				javascriptID++;
			});
            
           worker.port.on('staticHTML', function(data) {
                recordHTML(data.src,data.html);
           }); 

		}
	});
    
    pageMod.PageMod({
        include: "*",
		contentScriptWhen: "ready",
		contentScriptFile: data.url("ready.js")
    });

    
    
    jsd.topLevelHook = {
        onCall: function(frame, type) {
            var patt = new RegExp("^(http|https):\/\/","i");
            if (patt.test(frame.script.fileName) &&  type == Ci.jsdICallHook.TYPE_TOPLEVEL_START) {
                var result={};
                var fileNameWODomain = frame.script.fileName.slice(frame.script.fileName.lastIndexOf('/')+1); 
                //dump('"'+frame.script.fileName+ '"\n');
                //dump('"'+fileNameWODomain + '"\n');
                frame.eval("if(!document.currentScript.hasAttribute('__fp_tag'))"+
                           "document.currentScript.setAttribute('__fp_tag',"+(js_tags++)+")","",1,result); //js_tag is the javascript tag?
                var location = frame.executionContext.globalObject.getWrappedValue().document.location;

		//dump('script_location:'+frame.script.fileName+'\n');               


		var result4={};
		frame.eval( "self.port.emit('instrumentation',{})","",1,result4);

		//self.port.emit('instrumentation',{});
 
		var result2={};
                frame.eval("document.currentScript.setAttribute('__fp_execOnPage','"+location+"')","",1,result2);
                //dump(staticHTMLs[location].toLowerCase());
                
		var result3={};
		frame.eval("console.log(document.currentScript.getAttribute('__fp_curScriptDuringCreate'))","",1,result3);
               
                //Test for script filename in the static source of the document.  If found, then
                //document.location is the parent of the current script (encode with -1).  
                if(fileNameWODomain != "" && staticHTMLs[location]!=null && 
                   staticHTMLs[location].toLowerCase().indexOf(fileNameWODomain.toLowerCase()) >= 0) {
                     frame.eval("if(!document.currentScript.hasAttribute('__fp_curScriptDuringCreate'))"+
                                "document.currentScript.setAttribute('__fp_curScriptDuringCreate',-1);","",1,result);
                }
                else {//Try to see if the script source code is in the static HTML.  Again, if found,
                      //document.location is the parent of the current script (encode with -1).
                    if (staticHTMLs[location].toLowerCase().indexOf(
                         frame.script.functionSource.toLowerCase().slice(0,63))) {
                            frame.eval("if(!document.currentScript.hasAttribute('__fp_curScriptDuringCreate'))"+
                                      "document.currentScript.setAttribute('__fp_curScriptDuringCreate',-1);","",1,result);
                            }

                }
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
