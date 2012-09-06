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



con=lite.connect('results_july16th.sqlite')

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
	depth_arr=[] #max depth of included scripts
	origin_arr=[] #Number of unique dynamically included scripts (i.e., not created by the site author)

	x=0;
	
	for i in res:
		#average number of unique origins after lvl 1 depth and lvl 2+
		lvl_1_origins = [];
		lvl_2_origins = [];
		for j in res[i]:
			if res[i][j]['parent_id'] == -1: #if it's included statically
				total_2.append(1)
				origin = re.findall(r'^[^/]*//[^/]*', res[i][j]['src'])
				#print origin
				if len(origin)>0 and origin[0] not in lvl_1_origins:
					lvl_1_origins.append(origin[0]) #append if not already there

		for j in res[i]:
			if res[i][j]['parent_id'] != -1: # if included dynamically
				total_2.append(1)
				origin = re.findall(r'^[^/]*//[^/]*', res[i][j]['src'])
				if len(origin)>0 and (origin[0] not in lvl_1_origins) and (origin[0] not in lvl_2_origins):
					lvl_2_origins.append(origin[0])


		ele_queue= deque()
		tag_list={}
		for j in res[i]:
			ele_queue.append(res[i][j])
			if res[i][j]['tag'] not in tag_list:
				tag_list[res[i][j]['tag']]=0#a list of tags
			else:
				tag_list[res[i][j]['tag']]+=1


		#average depths of script inclusion
		depth = []
	
		while len(ele_queue)>0:

			x+=1

			ele = ele_queue.popleft()
			if ele['parent_id'] == -1:
				found =0
				for item in depth: #is the script already there?
					if ele['tag'] in item:
						found =1;
	
				if found ==0: #if script does not exist, we add it
					item={} #item is a dictionary where key is the "tag" and value is the element
					item[ele['tag']] = ele 
					depth.append(item)

					#remove tag from list
					if tag_list[ele['tag']] >0:
						tag_list[ele['tag']]-=1
					else:
						del tag_list[ele['tag']]
					total_1.append(1)#debug
		

			else: # if the script is not top level
				#first, we must find its parent
				found =0
				#if x< 100:
				#	print i

				for branch in depth:
					if ele['parent_id'] in branch: #if the parent tag is a key of ele
						if ele['tag'] not in branch:
							branch[ele['tag']] = ele
							branch[ele['tag']]['depth'] = branch[ele['parent_id']]['depth']+1
							
							#remove tag from list
							if tag_list[ele['tag']] >0:
								tag_list[ele['tag']]-=1
							else:
								del tag_list[ele['tag']]
							
							total_1.append(1)#debug
						found =1

				

				# if we can't find the parent we must add the item back
				if found ==0:
					#if nothing in the list has a smaller id
					smallest=1
					for x in tag_list:
						if x < ele['tag']:#if there is another element that is smaller
							smallest=0

					if smallest ==1: #if this element is the smallest, then its parent is missing
						item={}
						item[ele['tag']] = ele
						depth.append(item)
						#remove tag from list
						if tag_list[ele['tag']] >0:
							tag_list[ele['tag']]-=1
						else:
							del tag_list[ele['tag']]
						total_1.append(1)
					else: #if there is a smallerelement, we append the element back
						ele_queue.append(ele);


		size=0 # size is the script depth of each top level domain

		for ele in depth:
			for site in ele:
				if ele[site]['depth'] > size:
					size = ele[site]['depth']



		if size > max_depth:
			max_depth = size

		if size > 8:
			print i

		if len(lvl_2_origins) > max_origin:
			max_origin = len(lvl_2_origins)

		depth_arr.append(size)
		origin_arr.append(len(lvl_2_origins))

	
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

	print "\n\n\n"
	print "# of nodes in depth calculation: ",len(total_1) 
	print "#of nodes in origin calculation: ", len(total_2)
	print "#of nodes in total: ",len(total)+len(total_dup)+len(iframe)," iframed pages:",len(iframe)," google domains:", len(google_domain), " uniques w/o google:",len(total)-len(google_domain), " duplicates:",len(total_dup)
	print "# of scripts collected: ", len(rows)

	print "\n\n\n"

	for key in range(len(norm_origin)):
		print key,"	",norm_origin[key]
