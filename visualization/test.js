var request = new XMLHttpRequest();
var edges;


request.open('GET', 'parent_rels_june26.json', false); //since it's a local file, use synchronous

//load the data from json file
request.send();
//document.write('data loaded<br />');
edges=JSON.parse(request.responseText);
document.write('<form id="submitter"><label for="scriptFilter">Enter part of parent or child script origin: </label><input name="scriptFilter" id="scriptFilter" type="text" /> <label for="docLocFilter">Enter part of document.location on which parent&rarr;child relationship exists: </label><input name="docLocFilter" id="docLocFilter" type="text" />  <input type="submit"/></form>');

form1 = document.getElementById('submitter');
form1.addEventListener("submit",render,false);

//now build a secondary index by the top document.location
//disabled for now
/*
var indexByDoc={};

for (parent in edges) {
    for (child in edges[parent]) {
        for (doc_location in edges[parent][child]) {
            //if index using document.location does not exist, create it
            if (!indexByDoc.hasOwnProperty(doc_location))                 
                indexByDoc[doc_location]=[];
            //push parent->child relationship into the index at doc_loc
            var obj = new Object;
            obj[parent]=child;
            indexByDoc[doc_location].push(obj); 
        }
    }
}
*/
//document.write('data indexed by document.location<br />');


function isStringInAnyKey(searchString, obj) {
    for (key in obj) {
        if (key.indexOf(searchString) >= 0)
            return true;
    }
    return false
}


function render(evt) {
    var links=[];
    var nodes={};


    evt.preventDefault();
    if (old_svg=document.getElementById('disp'))
        document.body.removeChild(old_svg);
    
    
    var scriptFilter=document.getElementById('scriptFilter').value;
    var docLocFilter=document.getElementById('docLocFilter').value;
    for (parent in edges) {
        for (child in edges[parent]) {
            if ((parent.indexOf(scriptFilter) >=0 || child.indexOf(scriptFilter) >= 0) &&
                isStringInAnyKey(docLocFilter,edges[parent][child]))
                    links.push({source:parent, target:child, type: "parent"});
        }
    }
    // Compute the distinct nodes from the links.
    links.forEach(function(link) {
                  link.source = nodes[link.source] || (nodes[link.source] = {name: link.source});
                  link.target = nodes[link.target] || (nodes[link.target] = {name: link.target});
                  });
    
    var w = 1280,
    h = 760;
    
    var svg = d3.select("body").append("svg:svg")
    .attr("id","disp")
    .attr("width", w)
    .attr("height", h);

    
    var force = d3.layout.force()
    .nodes(d3.values(nodes))
    .links(links)
    .size([w, h])
    .linkDistance(60)
    .charge(-300)
    .on("tick", tick)
    .start();
    
        
    // Per-type markers, as they don't inherit styles.
    
    svg.append("svg:defs").selectAll("marker")
    .data(["parent"])
    .enter().append("svg:marker")
    .attr("id", String)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", -1.5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5");
    
    
    var path = svg.append("svg:g").selectAll("path")
    .data(force.links())
    .enter().append("svg:path")
    .attr("class", function(d) { return "link " + d.type; })
    .attr("marker-end", function(d) { return "url(#" + d.type + ")"; });
    
    var circle = svg.append("svg:g").selectAll("circle")
    .data(force.nodes())
    .enter().append("svg:circle")
    .attr("r", 6)
    .call(force.drag);
    
    
    var text = svg.append("svg:g").selectAll("g")
    .data(force.nodes())
    .enter().append("svg:g");
    
    // A copy of the text with a thick white stroke for legibility.
    text.append("svg:text")
    .attr("x", 8)
    .attr("y", ".31em")
    .attr("class", "shadow")
    .text(function(d) { return d.name; });
    
    text.append("svg:text")
    .attr("x", 8)
    .attr("y", ".31em")
    .text(function(d) { return d.name; });
    
    function tick() {
        path.attr("d", function(d) {
                  var dx = d.target.x - d.source.x,
                  dy = d.target.y - d.source.y,
                  dr = Math.sqrt(dx * dx + dy * dy);
                  return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
                  });
        
        circle.attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y + ")";
                    });
        
        text.attr("transform", function(d) {
                  return "translate(" + d.x + "," + d.y + ")";
                  });
    }
    
    return false;
}
// Use elliptical arc path segments to doubly-encode directionality.

