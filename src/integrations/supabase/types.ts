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
      chat_messages: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      league: {
        Row: {
          current_week: number
          id: string
          name: string
          rules: Json
          schedule: Json
          scoring: Json
          slug: string
          updated_at: string
        }
        Insert: {
          current_week?: number
          id?: string
          name?: string
          rules?: Json
          schedule?: Json
          scoring?: Json
          slug?: string
          updated_at?: string
        }
        Update: {
          current_week?: number
          id?: string
          name?: string
          rules?: Json
          schedule?: Json
          scoring?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_watchlist: {
        Row: {
          created_at: string
          id: string
          league_id: string
          player_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          player_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          player_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_watchlist_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "league"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          time_zone: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id: string
          time_zone?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          time_zone?: string
        }
        Relationships: []
      }
      score_overrides: {
        Row: {
          id: string
          league_id: string
          note: string
          points: number
          team_slot: number
          updated_at: string
          updated_by: string | null
          week: number
        }
        Insert: {
          id?: string
          league_id: string
          note?: string
          points?: number
          team_slot: number
          updated_at?: string
          updated_by?: string | null
          week: number
        }
        Update: {
          id?: string
          league_id?: string
          note?: string
          points?: number
          team_slot?: number
          updated_at?: string
          updated_by?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_overrides_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "league"
            referencedColumns: ["id"]
          },
        ]
      }
      season_history: {
        Row: {
          champion: string
          champion_owner: string
          id: string
          notes: string
          regular_season_best: string
          runner_up: string
          runner_up_owner: string
          season: number
          standings: Json
          updated_at: string
        }
        Insert: {
          champion?: string
          champion_owner?: string
          id?: string
          notes?: string
          regular_season_best?: string
          runner_up?: string
          runner_up_owner?: string
          season: number
          standings?: Json
          updated_at?: string
        }
        Update: {
          champion?: string
          champion_owner?: string
          id?: string
          notes?: string
          regular_season_best?: string
          runner_up?: string
          runner_up_owner?: string
          season?: number
          standings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          bench: Json
          color: string
          division: string
          id: string
          ir: Json
          league_id: string
          name: string
          owner: string
          slot: number
          starters: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bench?: Json
          color?: string
          division?: string
          id?: string
          ir?: Json
          league_id: string
          name?: string
          owner?: string
          slot: number
          starters?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bench?: Json
          color?: string
          division?: string
          id?: string
          ir?: Json
          league_id?: string
          name?: string
          owner?: string
          slot?: number
          starters?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "league"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_block: {
        Row: {
          created_at: string
          id: string
          league_id: string
          player_id: string
          team_slot: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          player_id: string
          team_slot: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          player_id?: string
          team_slot?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_block_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "league"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          from_player_ids: string[]
          from_player_names: string[]
          from_slot: number
          from_team_name: string
          id: string
          league_id: string
          note: string
          proposer_id: string | null
          proposer_name: string
          resolved_at: string | null
          resolver_id: string | null
          resolver_name: string
          status: string
          to_player_ids: string[]
          to_player_names: string[]
          to_slot: number
          to_team_name: string
          week: number
        }
        Insert: {
          created_at?: string
          from_player_ids?: string[]
          from_player_names?: string[]
          from_slot: number
          from_team_name?: string
          id?: string
          league_id: string
          note?: string
          proposer_id?: string | null
          proposer_name?: string
          resolved_at?: string | null
          resolver_id?: string | null
          resolver_name?: string
          status?: string
          to_player_ids?: string[]
          to_player_names?: string[]
          to_slot: number
          to_team_name?: string
          week?: number
        }
        Update: {
          created_at?: string
          from_player_ids?: string[]
          from_player_names?: string[]
          from_slot?: number
          from_team_name?: string
          id?: string
          league_id?: string
          note?: string
          proposer_id?: string | null
          proposer_name?: string
          resolved_at?: string | null
          resolver_id?: string | null
          resolver_name?: string
          status?: string
          to_player_ids?: string[]
          to_player_names?: string[]
          to_slot?: number
          to_team_name?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "trades_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "league"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          actor_id: string | null
          actor_name: string
          added_player_id: string | null
          added_player_name: string
          created_at: string
          dropped_player_id: string | null
          dropped_player_name: string
          id: string
          kind: string
          league_id: string
          team_name: string
          team_slot: number
          week: number
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string
          added_player_id?: string | null
          added_player_name?: string
          created_at?: string
          dropped_player_id?: string | null
          dropped_player_name?: string
          id?: string
          kind?: string
          league_id: string
          team_name?: string
          team_slot: number
          week?: number
        }
        Update: {
          actor_id?: string | null
          actor_name?: string
          added_player_id?: string | null
          added_player_name?: string
          created_at?: string
          dropped_player_id?: string | null
          dropped_player_name?: string
          id?: string
          kind?: string
          league_id?: string
          team_name?: string
          team_slot?: number
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "league"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waiver_claims: {
        Row: {
          actor_id: string | null
          actor_name: string
          created_at: string
          drop_player_id: string | null
          drop_player_name: string
          id: string
          league_id: string
          player_id: string
          player_name: string
          player_pos: string
          player_team: string
          resolved_at: string | null
          status: string
          team_name: string
          team_slot: number
          week: number
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          drop_player_id?: string | null
          drop_player_name?: string
          id?: string
          league_id: string
          player_id: string
          player_name?: string
          player_pos?: string
          player_team?: string
          resolved_at?: string | null
          status?: string
          team_name?: string
          team_slot: number
          week?: number
        }
        Update: {
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          drop_player_id?: string | null
          drop_player_name?: string
          id?: string
          league_id?: string
          player_id?: string
          player_name?: string
          player_pos?: string
          player_team?: string
          resolved_at?: string | null
          status?: string
          team_name?: string
          team_slot?: number
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "waiver_claims_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "league"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_run_token: {
        Row: {
          id: number
          token: string
        }
        Insert: {
          id?: number
          token?: string
        }
        Update: {
          id?: number
          token?: string
        }
        Relationships: []
      }
      weekly_results: {
        Row: {
          created_at: string
          id: string
          league_id: string
          points: number
          team_slot: number
          updated_at: string
          week: number
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          points?: number
          team_slot: number
          updated_at?: string
          week: number
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          points?: number
          team_slot?: number
          updated_at?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_results_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "league"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_league_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "commissioner" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["commissioner", "member"],
    },
  },
} as const
