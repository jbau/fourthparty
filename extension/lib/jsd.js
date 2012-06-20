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
//A very primitive FIFO of size 
var fifo_size=20;
var staticHTMLkeys=[]; //keys stored in staticHTMLs 
var staticHTMLs = {};  //map used for storage
var deferred_scripts = {}; //map of arrays to handle the fact that the ajax call to fetch the source of the page (staticHTML) happens async


function numProperties(obj) {
    var i = 0;
    for (p in obj) {
        i++;
    }
    return i;
}

exports.recordHTML = function(src,html) {
    //see if we need to evict oldest record
    if (staticHTMLkeys.length >= fifo_size) {
        var key = staticHTMLkeys.shift();
        delete staticHTMLs[key]; //remove record from staticHTMLs
        delete deferred_scripts[key]; //remove scripts waiting for this staticHTML
    }
    staticHTMLkeys.push(src);
    staticHTMLs[src]=html;
    console.log(src+":"+html);
    checkDeferred(src);
    
}

function checkDeferred(src) {
    //now look through the deferred scripts to see if they are in the static HTML source
    while(deferred_scripts[src] && deferred_scripts[src].length>0) {
        var curScriptObj = deferred_scripts[src].pop();
        //console.log(curScriptObj.script.src);
        //console.log(curScriptObj.script.innerHTML);
        //Look for src in script
        if (curScriptObj.script.src!="" && staticHTMLs[src].toLowerCase().indexOf(curScriptObj.script.src) >=0) {
            curScriptObj.script.setAttribute('__fp_curScriptDuringCreate',-1);
        }
        if (curScriptObj.script.innerHTML !="" && staticHTMLs[src].toLowerCase().indexOf(curScriptObj.script.innerHTML.toLowerCase().slice(0,63)) >=0) {
            curScriptObj.script.setAttribute('__fp_curScriptDuringCreate',-1);
        }
        curScriptObj.creator_script_id=curScriptObj.script.getAttribute('__fp_curScriptDuringCreate');
        curScriptObj.is_static=(curScriptObj.creator_script_id==-1)?1:0;
        
        delete curScriptObj.script;
        
        dump('checkpoint4 reached\n');
        
        loggingDB.executeSQL(loggingDB.createInsert("javascript",curScriptObj),false);
        
    }
}

exports.clearHTMLStore = function() {
    staticHTMLs = {};
    staticHTMLkeys=[];
    deferred_scripts={};
}

exports.run = function() {
    
	var createJavascriptTable = data.load("create_javascript_table.sql");
	loggingDB.executeSQL(createJavascriptTable, false);
    
    jsd.topLevelHook = {
    onCall: function(frame, type) {
        js_tags++;
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
            var result3 = {}
            var myscript = {};
            frame.eval("document.currentScript","",1,myscript);
            //console.log(myscript.value.getWrappedValue());
            
            dump('checkpoint1 reached\n');               
            
            //many of the attributes below are set in other files
            
            var raw_scriptTag = {};
            frame.eval("document.currentScript.getAttribute('__fp_tag')","",1,raw_scriptTag);
            var scriptTag = raw_scriptTag.value.getWrappedValue();

            
            ////JASON HERE: THIS DOES NOT SEEM TO BE WORKING
            var raw_pageID = {};
            frame.eval("document.currentScript.getAttribute('__fp_pageID')","",1,raw_pageID);
            var pageID = raw_pageID.value.getWrappedValue();
            pageID=-1; /////////HARDCODING THIS FOR NOW
            
            dump('checkpoint2 reached\n');               
            
            var raw_src = {};
            var disposition; // 0 is inline, 1 is external
            frame.eval("document.currentScript.getAttribute('src')","",1,raw_src);
            var src = raw_src.value.getWrappedValue();
            if (!src || src == "")
                disposition = "inline";
            else disposition = "external";
            
            var ext_script_location="";
            
            if (disposition=="external")ext_script_location = src;	//if the script is external, then we fetch the real src
            
            dump('checkpoint3 reached\n');               
            
            var raw_method={};
            frame.eval("document.currentScript.getAttribute('__fp_creationMethod')","",1,raw_method);
            var method=raw_method.value.getWrappedValue();
            
            var is_static=0;
            
            var snippet = frame.script.functionSource.slice(0,255);

            
            dump('++++++++SRC++++++++\n');
            dump(frame.script.functionSource);
            dump('--------SRC--------\n');
            
            //use staticHTML of the page to determine if currentScript is installed by the HTML source
            //but can only do this if we already got the staticHTML
            if (staticHTMLs[location]!=null){         
                
                //Test for script filename in the static source of the document.  If found, then
                //document.location is the parent of the current script (encode with -1).  
                
                if(fileNameWODomain != ""  && 
                   staticHTMLs[location].toLowerCase().indexOf(fileNameWODomain.toLowerCase()) >= 0) {
                    
                    dump('first\n');
                    frame.eval("if(!document.currentScript.hasAttribute('__fp_curScriptDuringCreate'))"+
                               "document.currentScript.setAttribute('__fp_curScriptDuringCreate',-1);","",1,result3);
                }
                else {//Try to see if the script source code is in the static HTML.  Again, if found,
                    //document.location is the parent of the current script (encode with -1).
                    //dump(staticHTMLs[location]+"\n");
                    if (staticHTMLs[location].toLowerCase().indexOf(
                                                                    frame.script.functionSource.toLowerCase().slice(0,63)) >= 0) {
                        dump('third\n');
                        frame.eval("if(!document.currentScript.hasAttribute('__fp_curScriptDuringCreate'))"+
                                   "document.currentScript.setAttribute('__fp_curScriptDuringCreate',-1);","",1,result3);
                    }
                    
                }
                
                
                var raw_creatorID={};
                frame.eval("document.currentScript.getAttribute('__fp_curScriptDuringCreate')","",1,raw_creatorID);
                var creatorID=raw_creatorID.value.getWrappedValue();
                var is_static=(creatorID==-1)?1:0;
                
                
                //log everything!
                //id(int), page_id(int), document_location(TEXT), disposition(TEXT), creator_script_id(int), created_method(TEXT), is_static (byte), script_src(TEXT), 
                //code_snippet(TEXT)
                var update = {};
                update["tag"] = scriptTag;
                update["page_id"] = pageID;
                update["document_location"] = loggingDB.escapeString(location);
                update["disposition"] = loggingDB.escapeString(disposition);
                update["creator_script_id"] = creatorID;
                update["created_method"] = loggingDB.escapeString(method);
                update["is_static"] = is_static;
                update["script_src"] = loggingDB.escapeString(ext_script_location);
                update["code_snippet"] = loggingDB.escapeString(snippet);
                
                
                dump('checkpoint4 reached\n');
                
                loggingDB.executeSQL(loggingDB.createInsert("javascript",update),false);
                
                
                
            } else {
                //If staticHTML is not YET fetched, we have to push this script into a queue that waits 
                //for staticHTML to arrive
                console.log("deferring static HTML check until it is fetched\n");
                if (!deferred_scripts.hasOwnProperty(location)) deferred_scripts[location]=[];
                //gather up the object to be written
                //once we do the deferred check for creator_script_id, we'll write the stuff to db.
                deferred_scripts[location].push({script: myscript.value.getWrappedValue(), tag: scriptTag, page_id:pageID, 
                                                 document_location:loggingDB.escapeString(location), disposition:loggingDB.escapeString(disposition),
                                                created_method:loggingDB.escapeString(method), is_static:is_static, 
                                                script_src:loggingDB.escapeString(ext_script_location), 
                                                code_snippet:loggingDB.escapeString(snippet)});
                
                                
            }
            
        }
    }
    };
    
    
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
    
//	
//    jsd.scriptHook = {
//    onScriptCreated: function(script) {
//        var patt = new RegExp("^(http|https):\/\/","i");
//        if (patt.test(script.fileName)) {
//            //dump("file: "+script.fileName+"\n  fn:"+script.functionName +"\n");
//            //console.trace();
//        }
//    },
//    onScriptDestroyed: function(script) {
//        // your function here
//    }
//    };
//    
//    jsd.errorHook = {
//    onError: function(message, fileName, lineNo, colNo, flags, errnum, exc) {
//        
//        //dump(message + "@" + fileName + "@" + lineNo + "@" + colNo + "@" + errnum + "\n");
//        
//        
//        // check message type
//        var jsdIErrorHook = Ci.jsdIErrorHook;
//        var messageType;
//        if (flags & jsdIErrorHook.REPORT_ERROR){
//            messageType = "Error";
//        }
//        if (flags & jsdIErrorHook.REPORT_WARNING)
//            messageType = "Warning";
//        if (flags & jsdIErrorHook.REPORT_EXCEPTION){
//            messageType = "Uncaught-Exception";
//        }
//        if (flags & jsdIErrorHook.REPORT_STRICT)
//            messageType += "-Strict";
//        
//        //dump(messageType + "\n");
//        
//        //return false; // trigger debugHook
//        
//        return true;// return true if you do not wish to trigger debugHook
//    }
//    };
//    
//    // note that debugHook does not _always_ trigger when jsd.errorHook[onError] returns false 
//    // it is not well-known why debugHook sometimes fails to trigger 
//    jsd.debugHook = {
//    onExecute: function(frame, type, rv) {
//        stackTrace = "";
//        for (var f = frame; f; f = f.callingFrame) {
//            stackTrace += f.script.fileName + "@" + f.line + "@" + f.functionName + "\n";
//        }
//        dump(stackTrace);
//        console.log(stackTrace);
//        return Ci.jsdIExecutionHook.RETURN_CONTINUE;
//    }
//    };
//    
//    
//    
//    jsd.throwHook = {
//    onExecute: function(frame, type, rv) {
//        stackTrace =  "---------START TRACE-------\n";
//        for (var f = frame; f; f = f.callingFrame) {
//            stackTrace += "globalObject.location: " + f.executionContext.globalObject.getWrappedValue().document.location + "  trace:" + f.script.fileName + "@" + f.line + "@" + f.functionName + "\n";
//        }
//        stackTrace += "----------END TRACE--------\n";
//        var msg = rv.value.getWrappedValue().message;
//        if (msg == "StackTrace")
//            dump(msg + "\n" + stackTrace);
//        
//        return Ci.jsdIExecutionHook.RETURN_CONTINUE_THROW;
//    }
//    };
//    
    
    
}
