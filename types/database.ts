export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube';
export type ContentStatus = 'new' | 'studying' | 'ready_to_adapt' | 'adapted' | 'archived';
export type ScriptLength = '15' | '30' | '60';

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  profile_image: string;
  ai_generations_remaining: number;
  created_at: string;
}

export interface SavedVideo {
  id: string;
  user_id: string;
  platform: VideoPlatform;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  creator_handle: string;
  transcript: string;
  ai_summary: VideoAnalysis | null;
  status: ContentStatus;
  folder_id: string | null;
  created_at: string;
}

export interface VideoAnalysis {
  hook: string;
  problem: string;
  emotional_trigger: string;
  product_positioning: string;
  visual_flow: string;
  cta: string;
  tone: string;
  pacing: string;
  script_structure: string;
  key_moments: string[];
  why_it_performs: string;
}

export interface Product {
  id: string;
  user_id: string;
  product_name: string;
  product_url: string;
  product_description: string;
  benefits: string;
  ingredients: string;
  category: string;
  target_customer: string;
  brand_voice: string;
  pricing: string;
  offer: string;
  created_at: string;
}

export interface GeneratedScript {
  id: string;
  user_id: string;
  video_id: string | null;
  product_id: string | null;
  script_15: string;
  script_30: string;
  script_60: string;
  hook_variations: string[];
  cta_variations: string[];
  caption: string;
  shot_list: ShotItem[];
  broll_suggestions: string[];
  teleprompter_script: string;
  script_length: ScriptLength;
  status: 'draft' | 'final';
  created_at: string;
}

export interface ShotItem {
  time: string;
  description: string;
  type: 'main' | 'broll' | 'text';
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export const FOLDER_PRESETS: Omit<Folder, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'TikTok Shop', color: '#00F2EA' },
  { name: 'UGC', color: '#FF0050' },
  { name: 'Meta Ads', color: '#1877F2' },
  { name: 'Organic', color: '#34D399' },
  { name: 'Brand Deals', color: '#F59E0B' },
];

export const STATUS_LABELS: Record<ContentStatus, string> = {
  new: 'New',
  studying: 'Studying',
  ready_to_adapt: 'Ready to Adapt',
  adapted: 'Adapted',
  archived: 'Archived',
};

export const STATUS_COLORS: Record<ContentStatus, string> = {
  new: '#6B7280',
  studying: '#3B82F6',
  ready_to_adapt: '#F59E0B',
  adapted: '#10B981',
  archived: '#374151',
};
