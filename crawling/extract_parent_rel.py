#!/usr/bin/python

from __future__ import division
import sqlite3 as lite
import sys
import re
import urlparse
import json
import csv

#tries to return as much of a fully-qualified origin name as possible
def constructFQON(script_src, doc_loc):
    joined=urlparse.urljoin(doc_loc, script_src) # present parts of script_src should take precedence
    parsed=urlparse.urlparse(joined)
    return parsed.scheme+"://"+parsed.netloc+"/"

#successively shortens domain names and looks for the in the alexa top 100 list
#i.e. for domain="www.cnn.com" tries "www.cnn.com" then "cnn.com" then "com"
def successiveDomainFind(domain, list):
    while '.' in domain:
        if domain in list:
            return True
        domain = domain[domain.find('.')+1:]
    return False

read_10k = csv.reader(open('10k.txt', 'rb'), delimiter='\n')

alexa_10k = {}

for row in read_10k:
    alexa_10k[row[0]]=1

print len(alexa_10k)

con=lite.connect('results.sqlite')

with con:
	
	cur = con.cursor()
	cur.execute("SELECT * FROM javascript WHERE script_src != '' AND document_location != ''")
	
	rows = cur.fetchall()

	origin_edges = {} #trying to record edge relationships between origins, i.e. script x
	                  #with origin A which was statically embedded in the HTML source 
	                  #brings in a script from ORIGIN B


	db={}      # this sets up a cache of the db, from where we will lookup parent information
        
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
                

        print len(db)
	
        #now we want to go through scripts (viewing them as children) and try to record information regarding their parents
        result={}  # this will record the parent -> child results.   the key will be the parent script origin.  the value is another dict whose key
                   # is the child script origin and whose value is another dict whose key is a document.locations on which this 
                   # parent->child relationship exists and whose value is the number of times it occurs
                   #                one  many       one  many                                                         one  one
                   # result = parent  --->  children  --->  document.locations where parent script loaded child script  --->  number of time parent loads child on this document.location

        cur = con.cursor()
	cur.execute("SELECT * FROM javascript WHERE creator_script_id is NOT NULL AND creator_script_id != '' AND creator_script_id != -1 AND script_src != '' AND document_location != ''")
	rows = cur.fetchall()
        
	for row in rows:
		if row[4] in db: #make sure parent was recorded by db
			parent=db[row[4]]
			parent_FQON=constructFQON(parent['src'],parent['doc_loc'])
			if successiveDomainFind(urlparse.urlparse(row[2]).netloc, alexa_10k): #make sure document.location is in alexa_10k
                            if parent_FQON not in result:  #found new parent, so create entry
                                result[parent_FQON]={}
                            child_origin=constructFQON(row[7],row[2])
                            doc_origin=constructFQON(row[2],row[2]) 
                            if child_origin not in result[parent_FQON]: #new parent->child relationship, initiate it
                                result[parent_FQON][child_origin]={}
                            if doc_origin not in result[parent_FQON][child_origin]: #new doc_location on which this parent->child relationship occurs
                                result[parent_FQON][child_origin]={doc_origin:1}    #count that the relationship occurs once
                            else:                                                   #found existing parent->child relationship at this doc_location
                                result[parent_FQON][child_origin][doc_origin]+=1    #increment
          

        
        print len(result)

        f=open('parent_rels.json','w')
        json.dump(result,f,indent=2)
