CREATE TABLE javascript(
	id INTEGER PRIMARY KEY ASC,
	page_id INTEGER,
	disposition BYTE,
	creator_script_idi INTEGER,
	created_method TEXT,
	is_static INTEGER,
	location TEXT
);
