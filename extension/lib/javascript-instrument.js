var pageMod = require("page-mod");
const data = require("self").data;
var loggingDB = require("logging-db");
var pageManager = require("page-manager");
var tabs = require("tabs");
var jsdI = require('jsd');


tabs.on('ready',function(tab){
    jsdI.clearHTMLStore();
});

exports.run = function() {

	// Set up logging
	/*
    var createJavascriptTable = data.load("create_javascript_table.sql");
	loggingDB.executeSQL(createJavascriptTable, false);
	var createJavascriptCallsTable = data.load("create_javascript_calls_table.sql");
	loggingDB.executeSQL(createJavascriptCallsTable, false);
	var javascriptID = 0;
	*/
	// Inject content script to instrument JavaScript API
	pageMod.PageMod({
		include: "*",
		contentScriptWhen: "start",
		contentScriptFile: data.url("content.js"),
		onAttach: function onAttach(worker) {
			var pageID = worker.windowID;

            /*
			worker.port.on("instrumentation", function(data) {
				
                var update = {};
				
				update["id"] = javascriptID;
				update["page_id"] = pageID;
                update["disposition"] = data.disposition;//inline or external
                update["creator_script_id"] = data.creatorID;//the script ID of the creator
                update["created_method"] = data.method;//how was the script created? doc.createElement etc.
                update["is_static"]= data.is_static;//if script fetched statically? or dynamically
                update["location"]=data.location;//location of the script origin+path

				loggingDB.executeSQL(loggingDB.createInsert("javascript", update), true);   
			

				javascriptID++;
			});
            */
            
           worker.port.on('staticHTML', function(data) {
                jsdI.recordHTML(data.src,data.html);
           }); 

		}
	});
    
    pageMod.PageMod({
        include: "*",
		contentScriptWhen: "ready",
		contentScriptFile: data.url("ready.js")
    });
	
};
