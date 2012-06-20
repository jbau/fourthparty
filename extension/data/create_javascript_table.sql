CREATE TABLE javascript(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
	tag INTEGER,
    document_location TEXT,
	disposition TEXT,
	creator_script_id INTEGER,
	created_method TEXT,
	is_static BYTE,
    script_src TEXT,
	code_snippet TEXT
);
