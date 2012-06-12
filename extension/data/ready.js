(function (){


//Get static text of this page
/*
var request = new XMLHttpRequest();
request.open('GET', document.location, false); 
request.send(null);

var staticHTML = "";

if (request.status == 200)
  staticHTML = request.responseText;

alert(staticHTML);
*/


/*
var scripts = document.getElementsByTagName('script');

var srcs=Array();
var parents=Array();
var tags=Array();
for (i=0;i<scripts.length;i++){
    srcs[i]=scripts[i].getAttribute('src');
    parents[i]=scripts[i].getAttribute('__fp_curScriptDuringCreate');
    tags[i]=scripts[i].getAttribute('__fp_tag');
}
*/


/*
for (i=0;i<scripts.length;i++) {
  if (scripts[i].getAttribute('__fp_curScriptDuringCreate')==null)
    scripts[i].setAttribute('__fp_curScriptDuringCreate', document.location);
}
*/
})();