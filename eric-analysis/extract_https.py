#!/usr/bin/python

from __future__ import division
from collections import deque
import sqlite3 as lite
import sys
import re


#first, we fetch the sites from alexa top 10k
site_list={}
f=open('10k.txt','r')
line = f.readline()

while line != "":
	stripped_str = "".join([c for c in line if c.isalnum()])
	#stores the site into the hashmap
	site_list[stripped_str] = 1
	line = f.readline()

f.close()



con=lite.connect('results_https.sqlite')

with con:
	
	cur = con.cursor()
	cur.execute("SELECT * FROM javascript")
	
	rows = cur.fetchall()

	res = {} #{["www.google.com],[www.yahoo.com], etc}

	#debug var
	total=[]
	total_1=[]
	total_2=[]
	total_dup=[]
	google_domain=[]
	iframe=[]
	tag_dict={} #matches tag with location

	#-------How 'res' should look like-------------/
	#key in res = document.location of each script. This is the top level origin
	#res[key] is a dictionary, where the key to this dictionary is 'tag' and value is 'ele' shown below
	#--------------------------------------------/
	for row in rows:

		#first, we test if the page is iframed if it is, then we skip it
		url_origin = re.findall(r'[^/]*//[^/]*', row[2])
		url_host = re.sub(r'[^/]*//(www)*',"", url_origin[0])
		stripped_host = "".join([c for c in url_host if c.isalnum()])
		
		#print "url_origin: "+url_origin[0]
		#print "url_host: "+url_host
		#print "stripped_host: "+stripped_host
		
		if stripped_host not in site_list: 
			iframe.append(1);
			continue

		#if a page is new, we create an array for it
		#row[2] is document_location, row[1] is tag
		if row[2] not in res:
			res[row[2]]={}

		#if the script is not already saved, we proceed
		if row[1] not in res[row[2]]:
			ele = {}
			ele['id'] = row[0]
			ele['tag'] = row[1]
			ele['loc'] = row[2]
			ele['disposition'] = row[3]
			ele['parent_id'] = row[4]
			ele['method'] = row[5]
			ele['is_static'] = row[6]
			ele['src'] = row[7]
			ele['depth'] =0
			res[row[2]][row[1]] = ele
			total.append(1);
			tag_dict[row[1]] = row[7]

		else:
			#record duplicated items
			total_dup.append(1);


	count =0;

	rmv=[]
	#remove all results with google top level domain
	#this may not be the best way to do it, but I'm lazy
	for key in res:
		#key stores the URL
		#if google is in the url, we remove it
		if re.search("google\.", key):
			rmv.append(key);

	for key in rmv:
		for item in res[key]:
			google_domain.append(1)
		del res[key]


	max_depth=0;
	max_origin=0;

	#-------------------format of depth_arr --------------/
	# Elements in depth_arr are main "branches" of a tree 
	#
	# Consider:            www.google.com
	#                      /           \
	#                 ads1.com        ads2.com
	#                 /     \         /     \
	#           ads3.com   ads4.com ads5.com ads6.com
	#
	# In this case, depth_arr has 2 elements,
	# the first element is {tag(ads1), tag(ads3), tag(ads4)}
	# the second element is {tag(ads2), tag(ads5), tag(ads6)}
	#
	origin_arr=[]

	x=0;

	mc_arr=[]
	for i in res:
		#average number of unique origins after lvl 1 depth and lvl 2+
		lvl_1_origins = []
		lvl_2_origins = []
		tmp_arr={}

		for j in res[i]:
			if res[i][j]['parent_id'] == -1: #if it's included statically
				total_2.append(1)
				origin = re.findall(r'^[^/]*//[^/]*', res[i][j]['src'])
				#print origin
				if len(origin)>0 and origin[0] not in lvl_1_origins:
					lvl_1_origins.append(origin[0]) #append if not already there

		for j in res[i]:
			if res[i][j]['parent_id'] >=0 : # if included dynamically
				total_2.append(1)
				origin = re.findall(r'^[^/]*//[^/]*', res[i][j]['src'])
				if len(origin)>0 and (origin[0] not in lvl_1_origins) and (origin[0] not in lvl_2_origins):
					lvl_2_origins.append(origin[0])

					#find if this is a mixed content script inclusion
					httpObj = re.search(r'^http[^s]', origin[0])
					topHTTPS = re.search(r'^https', i)
					if res[i][j]['parent_id'] not in tag_dict: continue
					parentHTTPS = re.search(r'^https', tag_dict[res[i][j]['parent_id']])

					if parentHTTPS and httpObj:
						tmp_arr[item]=1
						print "top", i 
						print "parent:",tag_dict[res[i][j]['parent_id']]
						print "Child:",origin[0]

		mc_arr.append(len(tmp_arr))	

		if len(tmp_arr) > max_origin:
			max_origin = len(tmp_arr)

	
	aggregated_origin = [0 for x in range(max_origin+1)]

	for x in mc_arr:
		aggregated_origin[x]+=1


	cdf_origin = [0 for x in range(max_origin+1)]
	cdf_origin[0] = aggregated_origin[0];



	for x in range(len(aggregated_origin)):
		if x > 0:
			cdf_origin[x] = cdf_origin[x-1] + aggregated_origin[x]


	norm_origin=[0 for x in range(max_origin+1)]

	for ele in range(len(cdf_origin)):
		norm_origin[ele] = cdf_origin[ele]/sum(aggregated_origin)

	for key in range(len(norm_origin)):
		print key,"	",norm_origin[key]
