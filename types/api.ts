export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface CreatorProfile {
  id: string;
  handle: string;
  platform?: string;
  niche?: string[] | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  email?: string | null;
  follower_count?: number | null;
  video_count?: number | null;
  ingest_status?: string | null;
  onboarding_completed_at?: string | null;
  tiktok_open_id?: string | null; // set when a TikTok account is linked
  // Onboarding fields
  gender?: string | null;
  age_range?: string | null;
  region?: string | null;
  primary_niche?: string | null;
  experience_level?: string | null;
  post_frequency?: string | null;
  creation_goal?: string | null;
  audience_gender?: string | null;
  biggest_challenge?: string | null;
  whatsapp?: string | null;
  // Contact-channel consent opt-ins
  whatsapp_optin?: boolean | null;
  sms_optin?: boolean | null;
  push_optin?: boolean | null;
  email_optin?: boolean | null;
  // Credits
  ai_generations_remaining?: number | null;
  // Plan / subscription (set by the IAP webhook on the backend)
  plan?: string | null;          // 'free' | 'creator' | 'pro' | 'studio'
  plan_status?: string | null;   // 'active' | 'canceled' | 'expired' | ...
  plan_platform?: string | null; // 'ios' | 'android'
  plan_renews_at?: string | null;
  plan_started_at?: string | null;
  // Brain fields
  top_hook_types?: string[] | null;
  vocabulary_sample?: string[] | null;
  avg_cadence_wpm?: number | null;
  energy_level?: number | null;
  authenticity_score?: number | null;
  top_performing_formats?: string[] | null;
  total_videos_ingested?: number | null;
  total_gmv?: number | null;
  video_style_profile?: VideoStyleProfile | null;
}

export interface VideoStyleProfile {
  dominant_format?: string | null;
  format_distribution?: Record<string, number> | null;
  on_camera_pct?: number | null;
  voiceover_pct?: number | null;
  faceless_pct?: number | null;
  avg_speaker_count?: number | null;
  typical_speaker_roles?: string[] | null;
  dominant_content_tone?: string | null;
  tone_distribution?: Record<string, number> | null;
  dominant_energy?: string | null;
  dominant_shot_style?: string | null;
  shot_style_distribution?: Record<string, number> | null;
  avg_viral_potential?: number | null;
  avg_creative_score?: number | null;
  typical_target_audience?: string | null;
  production_notes?: string[] | null;
  style_summary?: string | null;
}

export type OnboardingPatch = {
  display_name?: string;
  gender?: string;
  age_range?: string;
  region?: string;
  primary_niche?: string;
  experience_level?: string;
  post_frequency?: string;
  creation_goal?: string;
  audience_gender?: string;
  biggest_challenge?: string;
  whatsapp?: string;
  // Contact-channel consent opt-ins (default off; user actively consents)
  whatsapp_optin?: boolean;
  sms_optin?: boolean;
  push_optin?: boolean;
  email_optin?: boolean;
  complete?: boolean;
};

export interface SpeechTemplate {
  avg_wpm: number | null;
  pace_band: 'slow' | 'conversational' | 'fast' | 'rapid' | null;
  tone: string | null;
  opening_style: string | null;
  sentence_structure: string | null;
  signature_phrases: string[];
  filler_words: string[];
  voice_prompt: string | null;
  sample_count: number;
}

export interface PacingTemplate {
  avg_video_length_sec: number | null;
  avg_scene_count: number | null;
  avg_scene_duration_sec: number | null;
  cuts_per_30s: number | null;
  avg_hook_duration_sec: number | null;
  typical_cta_position: string | null;
  scene_type_sequence: string[];
  sample_count: number;
}

export interface ProductInsights {
  best_categories: { category: string; total_gmv: number; product_count: number }[];
  top_products: { name: string; category: string | null; gmv: number }[];
  recommended_categories: string[];
  summary: string | null;
  product_count: number;
}

export interface CreatorMeData {
  profile: CreatorProfile;
  counts: {
    products: number;
    videos: number;
  };
  speech_template: SpeechTemplate | null;
  pacing_template: PacingTemplate | null;
  product_insights: ProductInsights | null;
  latest_run?: RunData | null;
}

export interface RunData {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  phase?: string | null;
  progress: number;
  message?: string | null;
  stats?: Record<string, unknown> | null;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface AnalyzeResponse {
  runId: string;
  status: string;
  handle: string;
}

export interface Video {
  id: string;
  video_id?: string;
  source_url?: string;
  title?: string | null;
  view_count?: number | null;
  selection_reason?: string | null;
  analysis_status?: string | null;
}

export interface Product {
  id: string;
  name: string;
  category?: string | null;
  est_gmv?: number | null;
  real_gmv?: number | null;
  rank?: number | null;
}

export type RewriteType = 'full_rewrite' | 'hook_only' | 'body' | 'cta' | 'shorter' | 'longer';

export interface RewriteResult {
  rewritten: string;
  script_id: string;
}

export interface SavedScript {
  id: string;
  rewrite_type: RewriteType;
  original_content: string;
  rewritten: string;
  product_context?: string;
  created_at: string;
}

export interface IngestStatus {
  status: 'pending' | 'running' | 'complete' | 'failed';
  progress: number;
  phase: string;
  videos_ingested: number;
}

export interface VoiceProfile {
  energy_level: number;
  authenticity_score: number;
  speaking_pace_wpm: number;
  hook_styles: string[];
  video_formats: string[];
  total_gmv?: number;
}

// ── Product Search ──────────────────────────────────────────────────────────

export interface ProductSearchResult {
  id?: string;
  external_id: string;
  region: string;
  title: string;
  category?: string | null;
  price?: number | null;
  commission_rate?: number | null;
  day7_gmv?: number | null;
  total_units_sold?: number | null;
  cover_url?: string | null;
  product_url?: string | null;
}

export type ProductSearchSort = 'trending' | 'top_gmv' | 'commission' | 'popular';

export interface ProductSearchResponse {
  products: ProductSearchResult[];
  total: number;
  hasMore: boolean;
  page: number;
  sort: ProductSearchSort;
  query?: string | null;
  cached: boolean;
}

// ── Product Brain ───────────────────────────────────────────────────────────

export interface ProductBrainIntel {
  description?: string | null;
  benefits?: string[];
  key_features?: string[];
  pain_points?: string[];
  target_audience?: string | null;
  selling_angles?: string[];
  objections?: string[];
  emotional_hooks?: string[];
  demographics?: string | null;
  use_cases?: string[];
}

export interface ProductBrain {
  id: string;
  external_id: string;
  region: string;
  status: 'pending' | 'ingesting' | 'ready' | 'failed';
  title?: string | null;
  category?: string | null;
  price?: number | null;
  commission_rate?: number | null;
  day7_gmv?: number | null;
  total_units_sold?: number | null;
  cover_url?: string | null;
  product_url?: string | null;
  intel?: ProductBrainIntel | null;
  error_message?: string | null;
  version?: number | null;
  model_used?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductBrainIngestBody {
  external_id: string;
  region?: string;
  product_url?: string;
  searchProduct?: ProductSearchResult;
  force?: boolean;
}

// ── Viral Rewrite ───────────────────────────────────────────────────────────

export type ViralRewriteProductSource = 'video' | 'shop' | 'url' | 'manual' | 'brain';

export interface ViralRewriteProductInput {
  source: ViralRewriteProductSource;
  product_id?: string;
  url?: string;
  manual?: { name: string; [key: string]: string };
  brain_external_id?: string;
  brain_id?: string;
  brain_region?: string;
  search_product?: ProductSearchResult;
}

export interface ViralRewriteBody {
  viral_video_url: string;
  product: ViralRewriteProductInput;
}

export interface TranscriptSegment {
  text: string;
  startSec: number;
  endSec: number;
  speaker?: string | null;
}

export interface VideoAnalysis {
  transcript: {
    fullText: string;
    language?: string | null;
    wordCount?: number | null;
    durationSec?: number | null;
    segments?: TranscriptSegment[];
  };
}

export interface RewriteOption {
  // Current API fields (snake_case inside each option)
  label?: string | null;
  hook?: string | null;
  hook_analysis?: {
    why_its_better?: string | null;
    psychology?: string | null;
    vs_original?: string | null;
  } | null;
  body?: string[] | null;
  dialogue?: { speaker: string; line: string }[] | null;
  cta?: string | null;
  full_script?: string | null;
  why_this_works?: string | null;
  estimated_length?: string | null;
  // Legacy fields kept for history items stored before the API change
  id?: string;
  script?: string | null;
  title?: string | null;
  angle?: string | null;
}

export interface ViralRewriteResult {
  id?: string;
  options: RewriteOption[];
  hookVariants?: string[];
  stealThisLine?: string | null;
  analysis?: VideoAnalysis | null;
  product?: {
    name?: string | null;
    category?: string | null;
    brain?: ProductBrain | null;
    source?: string | null;
  } | null;
  created_at?: string | null;
}

// ── Product Script ──────────────────────────────────────────────────────────

export type VideoStyle = 'talking_head' | 'skit' | 'faceless';
export type ContentTone = 'educational' | 'funny' | 'serious';

export interface HookAnalysis {
  why_it_works: string;
  psychology: string;
}

export interface DialogueLine {
  speaker: string;
  line: string;
}

export interface ProductScriptOption {
  label: string;
  hook: string;
  hook_analysis: HookAnalysis;
  body: string[];
  dialogue: DialogueLine[];
  shot_list: string[];
  cta: string;
  full_script: string;
  why_this_works: string;
  estimated_length: string;
}

export interface VoiceUsed {
  tone: string;
  sentence_style: string;
  sample_voice: string;
}

export interface ProductScriptResult {
  product: {
    id: string | null;
    name: string;
    category: string | null;
    brain: ProductBrain | null;
    usedFallback: boolean;
  };
  videoStyle: VideoStyle;
  contentTone: ContentTone;
  direction: string | null;
  voiceUsed: VoiceUsed;
  genderUsed: string;
  options: ProductScriptOption[];
}

export interface ProductScriptBody {
  product: {
    brain_external_id?: string;
    brain_id?: string;
    search_product?: ProductSearchResult;
    region?: string;
  };
  video_style: VideoStyle;
  content_tone: ContentTone;
  direction?: string;
}

// ── Viral Topic Recreation ──────────────────────────────────────────────────

export interface WhyOriginalWorks {
  summary: string;
  reasons: string[];
  formula: string;
}

export interface ViralTopicAnalysis {
  transcript?: {
    fullText?: string | null;
    language?: string | null;
    wordCount?: number | null;
    durationSec?: number | null;
  } | null;
  hookText?: string | null;
  hookType?: string | null;
  structure?: string | null;
  videoFormat?: { format: string; summary: string } | null;
  keyClaims?: string[] | null;
  niche?: string | null;
}

export interface ViralTopicOption {
  label: string;
  hook: string;
  hook_analysis: { why_it_works: string; psychology: string };
  body: string[];
  dialogue: DialogueLine[];
  shot_list: string[];
  cta: string;
  full_script: string;
  why_this_works: string;
  estimated_length: string;
}

export interface ViralTopicResult {
  authorizedVideoId?: string | null;
  topic: string;
  direction: string | null;
  whyOriginalWorks: WhyOriginalWorks;
  analysis: ViralTopicAnalysis | null;
  voiceUsed: VoiceUsed | null;
  genderUsed: string;
  options: ViralTopicOption[];
}

export interface ViralTopicBody {
  viral_video_url: string;
  topic: string;
  direction?: string;
}

// ── Saved Script (GET /creators/scripts) ────────────────────────────────────

export interface SavedScriptItem {
  id: string;
  option_label?: string | null;
  hook?: string | null;
  body?: string[] | null;
  cta?: string | null;
  full_script?: string | null;
  origin?: string | null;
  product_name?: string | null;
  created_at: string;
  script_data?: Record<string, unknown> | null;
}

export interface SavedScriptsResponse {
  scripts: SavedScriptItem[];
  count: number;
}

// ── Organic Script ──────────────────────────────────────────────────────────

export interface OrganicScriptOption {
  label: string;
  hook: string;
  hook_analysis: {
    why_it_works: string;
    psychology: string;
  };
  body: string[];
  dialogue: DialogueLine[];
  shot_list: string[];
  cta: string;
  full_script: string;
  why_this_works: string;
  estimated_length: string;
}

export interface OrganicScriptBody {
  video_style: VideoStyle;
  content_tone: ContentTone;
  topic: string;
  direction?: string;
}

export interface OrganicScriptResult {
  topic: string;
  videoStyle: VideoStyle;
  contentTone: ContentTone;
  direction: string | null;
  voiceUsed: VoiceUsed | null;
  genderUsed: string;
  options: OrganicScriptOption[];
}

// ── Product Engine ──────────────────────────────────────────────────────────

export interface ProductEngineLearn {
  one_liner: string;
  explainer: string;
  talking_points: { point: string; why_it_lands: string }[];
  key_things_to_know: string[];
  who_its_for: string;
  faqs: { q: string; a: string }[];
  quick_pitch: string;
}

export interface ProductEngineProduct {
  external_id: string;
  title: string;
  brand?: string | null;
  category?: string | null;
  shop_name?: string | null;
  product_url?: string | null;
  cover?: string | null;
  price?: number | null;
  commission_rate?: number | null;
  day7_units_sold?: number | null;
  day7_gmv?: number | null;
  total_units_sold?: number | null;
}

export interface ProductEngineResult {
  product: ProductEngineProduct;
  learn: ProductEngineLearn;
  intel?: ProductBrainIntel | null;
  brainId?: string | null;
  brainStatus?: string | null;
  modelUsed?: string | null;
}

export interface SavedProductItem {
  id: string;
  creator_id: string;
  external_id: string;
  title: string;
  image_url?: string | null;
  price?: number | null;
  commission_rate?: number | null;
  shop_name?: string | null;
  category?: string | null;
  product_url?: string | null;
  product_brain_id?: string | null;
  learn: ProductEngineLearn;
  intel?: ProductBrainIntel | null;
  folder_id?: string | null;
  created_at: string;
}

export interface ProductFolder {
  id: string;
  creator_id: string;
  name: string;
  color: string;
  created_at: string;
}

// ── Shop Dashboard (GET /creators/me/shop-dashboard) ─────────────────────────

export interface ShopDashboard {
  connected: boolean;
  connect_url?: string;
  tier: 'authorized' | 'estimated' | 'none';
  handle?: string;
  display_name?: string;
  avatar_url?: string;
  currency?: string;
  summary?: {
    gmv_30d: number;
    gmv_trend: { date: string; gmv: number }[];
    commission_earned_30d: number;
    commission_pending: number;
    orders_30d: number;
    units_30d: number;
  };
  collaborations?: {
    id: string;
    brand_name: string;
    brand_logo?: string;
    status: string;
    gmv: number;
    commission: number;
    product_count: number;
    video_count: number;
  }[];
  products?: {
    product_id: string;
    name: string;
    image?: string;
    revenue: number;
    commission_earned: number;
    commission_rate: number;
    units: number;
    video_count: number;
    revenue_per_video: number;
  }[];
  insights?: {
    id: string;
    title: string;
    body: string;
    product_id?: string;
    cta: 'generate_scripts';
  }[];
  data_freshness?: string;
}

// ── Rewrite History ─────────────────────────────────────────────────────────

export interface RewriteHistoryItem {
  id: string;
  viral_video_url?: string | null;
  options: RewriteOption[];
  hookVariants?: string[] | null;
  stealThisLine?: string | null;
  analysis?: VideoAnalysis | null;
  product?: {
    name?: string | null;
    category?: string | null;
    source?: string | null;
    cover_url?: string | null;
  } | null;
  created_at: string;
}
