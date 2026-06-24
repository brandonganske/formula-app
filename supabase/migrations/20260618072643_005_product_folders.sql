CREATE TABLE product_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id text NOT NULL,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#FF3755',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_product_folders" ON product_folders FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_product_folders" ON product_folders FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_product_folders" ON product_folders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_product_folders" ON product_folders FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX idx_product_folders_creator_id ON product_folders(creator_id);

ALTER TABLE saved_products ADD COLUMN folder_id uuid REFERENCES product_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_saved_products_folder_id ON saved_products(folder_id);
