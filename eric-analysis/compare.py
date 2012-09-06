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

res = {} #{["www.google.com],[www.yahoo.com], etc}
res1 ={}

#debug var

con=lite.connect('results_july10th.sqlite')

with con:
	
	cur = con.cursor()
	cur.execute("SELECT * FROM javascript")
	
	rows = cur.fetchall()

	

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



con1=lite.connect('results_july11th.sqlite')

with con1:
	
	cur = con1.cursor()
	cur.execute("SELECT * FROM javascript")
	
	rows = cur.fetchall()


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
			continue

		#if a page is new, we create an array for it
		#row[2] is document_location, row[1] is tag
		if row[2] not in res1:
			res1[row[2]]={}

		#if the script is not already saved, we proceed
		if row[1] not in res1[row[2]]:
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
			res1[row[2]][row[1]] = ele




rmv=[]
#remove all results with google top level domain
#this may not be the best way to do it, but I'm lazy
for key in res:
	#key stores the URL
	#if google is in the url, we remove it
	if re.search("google\.", key):
		rmv.append(key);

for key in rmv: del res[key]

rmv1=[]
for key in res1:
	if re.search("google\.", key):
		rmv1.append(key)
for key in rmv1: del res1[key]


max_origin=0

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
origin_arr={}
origin1_arr={}
diff_arr =[]

x=0;

for i in res:
	#average number of unique origins after lvl 1 depth and lvl 2+
	lvl_1_origins = [];
	lvl_2_origins = [];
	for j in res[i]:
		if res[i][j]['parent_id'] == -1: #if it's included statically
			origin = re.findall(r'^[^/]*//[^/]*', res[i][j]['src'])
			#print origin
			if len(origin)>0 and origin[0] not in lvl_1_origins:
				lvl_1_origins.append(origin[0]) #append if not already there

	for j in res[i]:
		if res[i][j]['parent_id'] != -1: # if included dynamically
			origin = re.findall(r'^[^/]*//[^/]*', res[i][j]['src'])
			if len(origin)>0 and (origin[0] not in lvl_1_origins) and (origin[0] not in lvl_2_origins):
				lvl_2_origins.append(origin[0])

	
	origin_arr[i] = lvl_2_origins



for i in res1:
	#average number of unique origins after lvl 1 depth and lvl 2+
	lvl_1_origins = [];
	lvl_2_origins = [];
	for j in res1[i]:
		if res1[i][j]['parent_id'] == -1: #if it's included statically
			origin = re.findall(r'^[^/]*//[^/]*', res1[i][j]['src'])
			#print origin
			if len(origin)>0 and origin[0] not in lvl_1_origins:
				lvl_1_origins.append(origin[0]) #append if not already there

	for j in res1[i]:
		if res1[i][j]['parent_id'] != -1: # if included dynamically
			origin = re.findall(r'^[^/]*//[^/]*', res1[i][j]['src'])
			if len(origin)>0 and (origin[0] not in lvl_1_origins) and (origin[0] not in lvl_2_origins):
				lvl_2_origins.append(origin[0])


	origin1_arr[i] = lvl_2_origins

	#if len(lvl_2_origins) > max_origin:
	#	max_origin = len(lvl_2_origins)


#origin1_arr[key] is an array of all distinct dynamic included origins, where key is the url of the host page
for i in origin_arr:
	if i in origin1_arr: # if the host page exists in both pages
		set1 = set(origin_arr[i])
		set2 = set(origin1_arr[i])

		#(S union T) - (S intersect T)
		difference_set = (set1.union(set2)).difference(set1.intersection(set2))
		#print "set 1: ", set1
		#print "set 2: ", set2
		#print "diff: ",difference_set
		if len(difference_set) > max_origin:
			max_origin = len(difference_set)

		diff_arr.append(len(difference_set))




aggregated_origin = [0 for x in range(max_origin+1)]


for x in diff_arr:
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
