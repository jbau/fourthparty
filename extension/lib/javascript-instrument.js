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
				var update = {};
				
				update["id"] = javascriptID;
				update["page_id"] = pageID;
				update["symbol"] = loggingDB.escapeString(data.symbol);
				update["operation"] = loggingDB.escapeString(data.operation);
				update["value"] = loggingDB.escapeString(data.value);

				loggingDB.executeSQL(loggingDB.createInsert("javascript", update), true);   
				
				if(data.operation == "call") {
					var call_update = {};
					call_update["javascript_id"] = javascriptID;
					for(var i = 0; i < data.args.length; i++) {
						call_update["parameter_index"] = i;
						call_update["value"] = loggingDB.escapeString(data.args[i]);
						loggingDB.executeSQL(loggingDB.createInsert("javascript_calls", call_update), true);
					}
				}
				
				javascriptID++;
			});
            
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