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
      league: {
        Row: {
          current_week: number
          id: string
          name: string
          schedule: Json
          scoring: Json
          slug: string
          updated_at: string
        }
        Insert: {
          current_week?: number
          id?: string
          name?: string
          schedule?: Json
          scoring?: Json
          slug?: string
          updated_at?: string
        }
        Update: {
          current_week?: number
          id?: string
          name?: string
          schedule?: Json
          scoring?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
        }
        Relationships: []
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
          id: string
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
          id?: string
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
          id?: string
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
