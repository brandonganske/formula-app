/*
  # Creator Blueprint - Initial Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, PK, references auth.users)
      - `email` (text)
      - `username` (text, unique)
      - `profile_image` (text)
      - `ai_generations_remaining` (integer, default 10)
      - `created_at` (timestamptz)

    - `saved_videos`
      - `id` (uuid, PK)
      - `user_id` (uuid, references profiles)
      - `platform` (text - tiktok/instagram/youtube)
      - `video_url` (text)
      - `thumbnail_url` (text)
      - `caption` (text)
      - `creator_handle` (text)
      - `transcript` (text)
      - `ai_summary` (jsonb - structured analysis)
      - `status` (text - idea/drafting/ready_to_record/recorded/posted/archived)
      - `folder_id` (uuid, references folders)
      - `created_at` (timestamptz)

    - `products`
      - `id` (uuid, PK)
      - `user_id` (uuid, references profiles)
      - `product_name` (text)
      - `product_url` (text)
      - `product_description` (text)
      - `benefits` (text)
      - `ingredients` (text)
      - `category` (text)
      - `target_customer` (text)
      - `brand_voice` (text)
      - `pricing` (text)
      - `offer` (text)
      - `created_at` (timestamptz)

    - `generated_scripts`
      - `id` (uuid, PK)
      - `user_id` (uuid, references profiles)
      - `video_id` (uuid, references saved_videos)
      - `product_id` (uuid, references products)
      - `script_15` (text - 15-second script)
      - `script_30` (text - 30-second script)
      - `script_60` (text - 60-second script)
      - `hook_variations` (jsonb - array of hook options)
      - `cta_variations` (jsonb - array of CTA options)
      - `caption` (text)
      - `shot_list` (jsonb - array of shot suggestions)
      - `broll_suggestions` (jsonb - array of b-roll ideas)
      - `teleprompter_script` (text - formatted for teleprompter)
      - `script_length` (text - 15/30/60)
      - `status` (text - draft/final)
      - `created_at` (timestamptz)

    - `folders`
      - `id` (uuid, PK)
      - `user_id` (uuid, references profiles)
      - `name` (text)
      - `color` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Profiles: users can read/update own data
    - saved_videos: users can CRUD own videos
    - products: users can CRUD own products
    - generated_scripts: users can CRUD own scripts
    - folders: users can CRUD own folders

  3. Indexes
    - saved_videos user_id index
    - products user_id index
    - generated_scripts user_id index
    - folders user_id index
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  username text UNIQUE,
  profile_image text DEFAULT '',
  ai_generations_remaining integer DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- Saved videos table
CREATE TABLE IF NOT EXISTS saved_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'tiktok',
  video_url text DEFAULT '',
  thumbnail_url text DEFAULT '',
  caption text DEFAULT '',
  creator_handle text DEFAULT '',
  transcript text DEFAULT '',
  ai_summary jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'idea',
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  product_url text DEFAULT '',
  product_description text DEFAULT '',
  benefits text DEFAULT '',
  ingredients text DEFAULT '',
  category text DEFAULT '',
  target_customer text DEFAULT '',
  brand_voice text DEFAULT '',
  pricing text DEFAULT '',
  offer text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Generated scripts table
CREATE TABLE IF NOT EXISTS generated_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id uuid REFERENCES saved_videos(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  script_15 text DEFAULT '',
  script_30 text DEFAULT '',
  script_60 text DEFAULT '',
  hook_variations jsonb DEFAULT '[]'::jsonb,
  cta_variations jsonb DEFAULT '[]'::jsonb,
  caption text DEFAULT '',
  shot_list jsonb DEFAULT '[]'::jsonb,
  broll_suggestions jsonb DEFAULT '[]'::jsonb,
  teleprompter_script text DEFAULT '',
  script_length text DEFAULT '30',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Folders policies
CREATE POLICY "Users can read own folders"
  ON folders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own folders"
  ON folders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own folders"
  ON folders FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Saved videos policies
CREATE POLICY "Users can read own videos"
  ON saved_videos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own videos"
  ON saved_videos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own videos"
  ON saved_videos FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own videos"
  ON saved_videos FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Products policies
CREATE POLICY "Users can read own products"
  ON products FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Generated scripts policies
CREATE POLICY "Users can read own scripts"
  ON generated_scripts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own scripts"
  ON generated_scripts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own scripts"
  ON generated_scripts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own scripts"
  ON generated_scripts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_videos_user_id ON saved_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_scripts_user_id ON generated_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_videos_status ON saved_videos(status);
CREATE INDEX IF NOT EXISTS idx_saved_videos_folder_id ON saved_videos(folder_id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
