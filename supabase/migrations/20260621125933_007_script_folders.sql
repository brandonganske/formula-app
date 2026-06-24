-- Script folders for the Saved (Toolkit) tab.
-- Mirrors product_folders (005) so scripts and products stay consistent.
-- Saved scripts themselves live behind the /creators/scripts REST API (a
-- different store), so membership is a junction table keyed by an opaque
-- text script_id rather than a foreign key — a script can live in many folders.

CREATE TABLE script_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id text NOT NULL,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#FF3755',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE script_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_script_folders" ON script_folders FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_script_folders" ON script_folders FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_script_folders" ON script_folders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_script_folders" ON script_folders FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX idx_script_folders_creator_id ON script_folders(creator_id);

-- Junction: many folders per script.
CREATE TABLE script_folder_items (
  folder_id  uuid NOT NULL REFERENCES script_folders(id) ON DELETE CASCADE,
  script_id  text NOT NULL,
  creator_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, script_id)
);

ALTER TABLE script_folder_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_script_folder_items" ON script_folder_items FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_script_folder_items" ON script_folder_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_script_folder_items" ON script_folder_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_script_folder_items" ON script_folder_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX idx_script_folder_items_creator_id ON script_folder_items(creator_id);
CREATE INDEX idx_script_folder_items_folder_id  ON script_folder_items(folder_id);
