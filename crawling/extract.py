#!/usr/bin/python

from __future__ import division
import sqlite3 as lite
import sys
import re

con=lite.connect('results.sqlite')

with con:
	
	cur = con.cursor()
	cur.execute("SELECT * FROM javascript")
	
	rows = cur.fetchall()

	res = {} #{["www.google.com],[www.yahoo.com], etc}

	#-------How 'res' should look like-------------/
	#key in res = document.location of each script. This is the top level origin
	#res[key] is a dictionary, where the key to this dictionary is 'tag' and value is 'ele' shown below
	#--------------------------------------------/
	for row in rows:
	
		#if a page is new, we create an array for it
		#row[2] is document_location, row[1] is tag
		if row[2] not in res:
			res[row[2]]={}

		#if the script is not already saved, we proceed
		if row[1] not in res[row[2]]:
			ele = {}
			ele['id'] = row[0]
			ele['disposition'] = row[3]
			ele['parent_id'] = row[4]
			ele['method'] = row[5]
			ele['is_static'] = row[6]
			ele['src'] = row[7]
			res[row[2]][row[1]] = ele


	count =0;

	rmv=[]
	#remove all results with google top level domain
	#this may not be the best way to do it, but I'm lazy
	for key in res:
		#key stores the URL
		#if google is in the url, we remove it
		if re.search("google", key):
			rmv.append(key);

	for key in rmv:
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
	depth_arr=[]
	origin_arr=[]
	for i in res:
		#average depths of script inclusion
		depth = []
		for j in res[i]: #j should be the 'tag' of script
			if res[i][j]['parent_id'] == -1: # if the script is top lvl
				found =0
				for ele in depth: #is the script already there?
					if j in ele:
						found =1;

				if found ==0: #if script does not exist, we add it
					ele={}
					ele[j] = res[i][j]
					depth.append(ele)
			else: # if the script is not top level
				#first, we must find its parent
				for ele in depth:
					if res[i][j]['parent_id'] in ele:
						ele[j] = res[i][j]

		size=0;

		for ele in depth:
			if len(ele) > size:
				size = len(ele)

		#average number of unique origins after lvl 1 depts and lvl 2+
		lvl_1_origins = [];
		lvl_2_origins = [];

		for j in res[i]:
			if res[i][j]['parent_id'] == -1: #if it's included statically
				origin = re.findall(r'[^/]*//[^/]*', res[i][j]['src'])
				if origin not in lvl_1_origins:
					lvl_1_origins.append(origin) #append if not already there

		for j in res[i]:
			if res[i][j]['parent_id'] != -1: # if included dynamically
				origin = re.findall(r'[^/]*//[^/]*', res[i][j]['src'])
				if (origin not in lvl_1_origins) and (origin not in lvl_2_origins):
					lvl_2_origins.append(origin)

		if size > max_depth:
			max_depth = size

		if len(lvl_2_origins) > max_origin:
			max_origin = len(lvl_2_origins)

		depth_arr.append(size)
		origin_arr.append(len(lvl_2_origins))

	#aggregated_depth 	
	aggregated_depth = [0 for x in range(max_depth+1)]
	aggregated_origin = [0 for x in range(max_origin+1)]

	for x in depth_arr:
		aggregated_depth[x]+=1
	
	for x in origin_arr:
		aggregated_origin[x]+=1


	cdf_depth = [0 for x in range(max_depth+1)]
	cdf_origin = [0 for x in range(max_origin+1)]
	cdf_depth[0] = aggregated_depth[0];
	cdf_origin[0] = aggregated_origin[0];

	for x in range(len(aggregated_depth)):
		if x > 0:
			cdf_depth[x] = cdf_depth[x-1] + aggregated_depth[x]
		#print cdf_depth[x]

	for x in range(len(aggregated_origin)):
		if x > 0:
			cdf_origin[x] = cdf_origin[x-1] + aggregated_origin[x]


	norm_depth=[0 for x in range(max_depth+1)]
	norm_origin=[0 for x in range(max_origin+1)]

	for ele in range(len(cdf_depth)):
		norm_depth[ele] = cdf_depth[ele]/sum(aggregated_depth)

	for ele in range(len(cdf_origin)):
		norm_origin[ele] = cdf_origin[ele]/sum(aggregated_origin)

	for key in range(len(norm_depth)):
		print key,"	",norm_depth[key]

	print "\n\n\n\n\n\n\n\n"

	for key in range(len(norm_origin)):
		print key,"	",norm_origin[key]
