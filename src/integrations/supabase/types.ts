export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      favorites: {
        Row: {
          added_at: string
          id: string
          media_type: string
          poster_path: string | null
          title: string
          tmdb_id: number
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          media_type: string
          poster_path?: string | null
          title: string
          tmdb_id: number
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          media_type?: string
          poster_path?: string | null
          title?: string
          tmdb_id?: number
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      media_cache: {
        Row: {
          backdrop_path: string | null
          genre_ids: number[]
          media_type: string
          poster_path: string | null
          release_date: string | null
          title: string | null
          tmdb_id: number
          updated_at: string
          vote_average: number | null
        }
        Insert: {
          backdrop_path?: string | null
          genre_ids?: number[]
          media_type: string
          poster_path?: string | null
          release_date?: string | null
          title?: string | null
          tmdb_id: number
          updated_at?: string
          vote_average?: number | null
        }
        Update: {
          backdrop_path?: string | null
          genre_ids?: number[]
          media_type?: string
          poster_path?: string | null
          release_date?: string | null
          title?: string | null
          tmdb_id?: number
          updated_at?: string
          vote_average?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      user_list_items: {
        Row: {
          added_at: string
          id: string
          list_id: string
          media_type: string
          poster_path: string | null
          title: string
          tmdb_id: number
        }
        Insert: {
          added_at?: string
          id?: string
          list_id: string
          media_type: string
          poster_path?: string | null
          title: string
          tmdb_id: number
        }
        Update: {
          added_at?: string
          id?: string
          list_id?: string
          media_type?: string
          poster_path?: string | null
          title?: string
          tmdb_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "user_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watched_episodes: {
        Row: {
          episode_name: string | null
          episode_number: number
          id: string
          runtime_minutes: number | null
          season_number: number
          tmdb_id: number
          user_id: string
          watched_at: string
        }
        Insert: {
          episode_name?: string | null
          episode_number: number
          id?: string
          runtime_minutes?: number | null
          season_number: number
          tmdb_id: number
          user_id: string
          watched_at?: string
        }
        Update: {
          episode_name?: string | null
          episode_number?: number
          id?: string
          runtime_minutes?: number | null
          season_number?: number
          tmdb_id?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      watched_movies: {
        Row: {
          id: string
          runtime_minutes: number | null
          title: string | null
          tmdb_id: number
          user_id: string
          watched_at: string
        }
        Insert: {
          id?: string
          runtime_minutes?: number | null
          title?: string | null
          tmdb_id: number
          user_id: string
          watched_at?: string
        }
        Update: {
          id?: string
          runtime_minutes?: number | null
          title?: string | null
          tmdb_id?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_at: string
          backdrop_path: string | null
          first_air_date: string | null
          id: string
          media_type: string
          poster_path: string | null
          series_name: string
          tmdb_id: number
          user_id: string
          vote_average: number | null
        }
        Insert: {
          added_at?: string
          backdrop_path?: string | null
          first_air_date?: string | null
          id?: string
          media_type?: string
          poster_path?: string | null
          series_name: string
          tmdb_id: number
          user_id: string
          vote_average?: number | null
        }
        Update: {
          added_at?: string
          backdrop_path?: string | null
          first_air_date?: string | null
          id?: string
          media_type?: string
          poster_path?: string | null
          series_name?: string
          tmdb_id?: number
          user_id?: string
          vote_average?: number | null
        }
        Relationships: []
      }
      youtube_watched: {
        Row: {
          channel_id: string | null
          channel_title: string | null
          id: string
          kind: string
          thumbnail_url: string | null
          title: string
          user_id: string
          watched_at: string
          yt_id: string
        }
        Insert: {
          channel_id?: string | null
          channel_title?: string | null
          id?: string
          kind: string
          thumbnail_url?: string | null
          title: string
          user_id: string
          watched_at?: string
          yt_id: string
        }
        Update: {
          channel_id?: string | null
          channel_title?: string | null
          id?: string
          kind?: string
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          watched_at?: string
          yt_id?: string
        }
        Relationships: []
      }
      youtube_watchlist: {
        Row: {
          added_at: string
          channel_id: string | null
          channel_title: string | null
          id: string
          kind: string
          thumbnail_url: string | null
          title: string
          user_id: string
          yt_id: string
        }
        Insert: {
          added_at?: string
          channel_id?: string | null
          channel_title?: string | null
          id?: string
          kind: string
          thumbnail_url?: string | null
          title: string
          user_id: string
          yt_id: string
        }
        Update: {
          added_at?: string
          channel_id?: string | null
          channel_title?: string | null
          id?: string
          kind?: string
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          yt_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_follower: {
        Args: { _follower: string; _following: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
