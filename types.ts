export type Role = 'user' | 'moderator' | 'admin'
export interface Profile {
  id: string; username: string; display_name: string | null; avatar_url: string | null
  bio: string | null; favorite_anime: string | null; watchlist_public: boolean
  last_active_at: string; role: Role; status: 'active' | 'suspended' | 'banned'
  suspended_until: string | null; is_premium: boolean; created_at: string
}
export type MiniProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_premium' | 'role'>
export interface Community { id: string; slug: string; name: string; description: string | null; rules: string | null; created_by: string | null; member_count: number }
export interface Post {
  id: string; author_id: string; community_id: string | null; anime_id: number | null; anime_title: string | null
  body: string; image_url: string | null; is_spoiler: boolean; spoiler_ref: string | null; is_hidden: boolean
  like_count: number; comment_count: number; created_at: string; edited_at: string | null
  author?: MiniProfile; community?: Pick<Community, 'slug' | 'name'> | null
}
export interface Comment { id: string; post_id: string; parent_id: string | null; author_id: string; body: string; is_spoiler: boolean; is_hidden: boolean; created_at: string; author?: MiniProfile }
export interface Room { id: string; slug: string; name: string; description: string | null; is_private: boolean; is_global: boolean }
export interface Message {
  id: string; room_id: string | null; conversation_id: string | null; sender_id: string; body: string; reply_to: string | null
  is_spoiler: boolean; spoiler_ref: string | null; is_hidden: boolean; created_at: string; edited_at: string | null; deleted_at: string | null
  sender?: MiniProfile; pending?: boolean; failed?: boolean
}
export interface Conversation { id: string; is_group: boolean; title: string | null; last_message_at: string; dm_key: string | null }
export interface Notification { id: string; user_id: string; actor_id: string | null; type: string; post_id: string | null; message: string | null; is_read: boolean; created_at: string; actor?: MiniProfile }
export interface AnimeMedia {
  id: number; title: { romaji: string | null; english: string | null; native: string | null }; synonyms: string[]
  coverImage: { large: string | null; extraLarge?: string | null }; description: string | null; genres: string[]
  episodes: number | null; status: string | null; season?: string | null; seasonYear?: number | null; averageScore?: number | null; siteUrl?: string | null
}
export const PROFILE_COLS = 'id,username,display_name,avatar_url,is_premium,role'
