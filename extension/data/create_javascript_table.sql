CREATE TABLE javascript(
	id INTEGER PRIMARY KEY ASC,
	page_id INTEGER,
	disposition BYTE,
	creator_script_id INTEGER,
	created_method TEXT,
	is_static BYTE,
	location TEXT
);
