/** Brand voice stored in `brands.voice_profile` (jsonb). */
export interface VoiceProfile {
  niche?: string;
  tone?: string;
  audience?: string;
  pillars?: string[];
  hashtags?: string[];
  avoid?: string;
}
