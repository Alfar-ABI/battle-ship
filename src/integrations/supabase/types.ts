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
      game_sessions: {
        Row: {
          created_at: string
          current_turn: string
          ended_at: string | null
          fleet_config: Json | null
          game_mode: string
          grid_size: number
          guest_nickname: string | null
          guest_player_id: string | null
          guest_ready: boolean
          guest_ships: Json | null
          guest_shots: Json
          guest_time_left: number | null
          host_nickname: string
          host_player_id: string
          host_ready: boolean
          host_ships: Json | null
          host_shots: Json
          host_time_left: number | null
          id: string
          started_at: string | null
          status: string
          turn_started_at: string | null
          winner: string | null
        }
        Insert: {
          created_at?: string
          current_turn?: string
          ended_at?: string | null
          fleet_config?: Json | null
          game_mode?: string
          grid_size?: number
          guest_nickname?: string | null
          guest_player_id?: string | null
          guest_ready?: boolean
          guest_ships?: Json | null
          guest_shots?: Json
          guest_time_left?: number | null
          host_nickname?: string
          host_player_id: string
          host_ready?: boolean
          host_ships?: Json | null
          host_shots?: Json
          host_time_left?: number | null
          id?: string
          started_at?: string | null
          status?: string
          turn_started_at?: string | null
          winner?: string | null
        }
        Update: {
          created_at?: string
          current_turn?: string
          ended_at?: string | null
          fleet_config?: Json | null
          game_mode?: string
          grid_size?: number
          guest_nickname?: string | null
          guest_player_id?: string | null
          guest_ready?: boolean
          guest_ships?: Json | null
          guest_shots?: Json
          guest_time_left?: number | null
          host_nickname?: string
          host_player_id?: string
          host_ready?: boolean
          host_ships?: Json | null
          host_shots?: Json
          host_time_left?: number | null
          id?: string
          started_at?: string | null
          status?: string
          turn_started_at?: string | null
          winner?: string | null
        }
        Relationships: []
      }
      mp_rooms: {
        Row: {
          id: string
          created_at: string
          host_player_id: string
          status: string
          game_mode: string
          grid_size: number
          fleet_config: Json | null
          max_players: number
          players: Json
          ships: Json
          shots: Json
          time_left: Json
          turn_started_at: string | null
          current_turn: string | null
          winner: string | null
          started_at: string | null
          ended_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          host_player_id: string
          status?: string
          game_mode?: string
          grid_size?: number
          fleet_config?: Json | null
          max_players?: number
          players?: Json
          ships?: Json
          shots?: Json
          time_left?: Json
          turn_started_at?: string | null
          current_turn?: string | null
          winner?: string | null
          started_at?: string | null
          ended_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          host_player_id?: string
          status?: string
          game_mode?: string
          grid_size?: number
          fleet_config?: Json | null
          max_players?: number
          players?: Json
          ships?: Json
          shots?: Json
          time_left?: Json
          turn_started_at?: string | null
          current_turn?: string | null
          winner?: string | null
          started_at?: string | null
          ended_at?: string | null
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          player_id: string
          nickname: string
          wins: number
          losses: number
          games: number
          score: number
          updated_at: string
        }
        Insert: {
          player_id: string
          nickname: string
          wins?: number
          losses?: number
          games?: number
          score?: number
          updated_at?: string
        }
        Update: {
          player_id?: string
          nickname?: string
          wins?: number
          losses?: number
          games?: number
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          difficulty: string
          duration_seconds: number
          id: string
          result: string
          ships_destroyed: number
          shots_fired: number
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          duration_seconds?: number
          id?: string
          result: string
          ships_destroyed?: number
          shots_fired?: number
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          duration_seconds?: number
          id?: string
          result?: string
          ships_destroyed?: number
          shots_fired?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
