CREATE TABLE saved_products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     text NOT NULL,
  external_id    text NOT NULL,
  title          text NOT NULL,
  image_url      text,
  price          numeric,
  commission_rate numeric,
  shop_name      text,
  category       text,
  product_url    text,
  product_brain_id text,
  learn          jsonb NOT NULL,
  intel          jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, external_id)
);

ALTER TABLE saved_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_saved_products" ON saved_products FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_own_saved_products" ON saved_products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_own_saved_products" ON saved_products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_saved_products" ON saved_products FOR DELETE
  TO anon, authenticated USING (true);
