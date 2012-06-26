#!/usr/bin/python

from __future__ import division
import sqlite3 as lite
import sys
import re
import urlparse
import json

#tries to return as much of a fully-qualified origin name as possible
def constructFQON(script_src, doc_loc):
    joined=urlparse.urljoin(doc_loc, script_src) # present parts of script_src should take precedence
    parsed=urlparse.urlparse(joined)
    return parsed.scheme+"://"+parsed.netloc+"/"

con=lite.connect('results.sqlite')

with con:
	
	cur = con.cursor()
	cur.execute("SELECT * FROM javascript WHERE script_src != '' AND document_location != ''")
	
	rows = cur.fetchall()

	origin_edges = {} #trying to record edge relationships between origins, i.e. script x
	                  #with origin A which was statically embedded in the HTML source 
	                  #brings in a script from ORIGIN B

	db={}
	for row in rows:
		#row[0]=id row[1]=tag row[2]=doc_location row[3]=disposition 
		#row[4]=creator_script_id row[5]=created_method row[6]=is_static
		#row[7]=script_src row[8]=code_snippet
		#print (row[7],  "   ", row[2],  "\n")
		db[row[1]]={}
		db[row[1]]['id'] = row[0]
		db[row[1]]['doc_loc'] = row[2]
		db[row[1]]['disposition'] = row[3]
		db[row[1]]['parent_id'] = row[4]
		db[row[1]]['method'] = row[5]
		db[row[1]]['is_static'] = row[6]
		db[row[1]]['src'] = row[7]
		origin_edges[constructFQON(row[7],row[2])]=[]
		

	print len(origin_edges)
	
	cur = con.cursor()
	cur.execute("SELECT * FROM javascript WHERE creator_script_id is NOT NULL AND creator_script_id != '' AND creator_script_id != -1 AND script_src != '' AND document_location != ''")
	rows = cur.fetchall()
	for row in rows:
		if row[4] in db:
			parent=db[row[4]]
			parent_FQON=constructFQON(parent['src'],parent['doc_loc'])
			if parent_FQON in origin_edges:
				origin_edges[parent_FQON].append(constructFQON(row[7],row[2]))

	i=0
	for parent,children in origin_edges.items():
		if len(children) !=0:
			print json.dumps({parent: children})
			
