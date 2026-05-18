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
      camp_sessions: {
        Row: {
          age_max: number | null
          age_min: number | null
          available_spots: number | null
          capacity: number | null
          created_at: string
          description: string | null
          end_date: string
          id: string
          image_url: string | null
          is_published: boolean
          location: string | null
          postal_code: string | null
          price_cents: number | null
          registration_deadline: string | null
          registration_url: string | null
          source_url: string | null
          start_date: string
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          available_spots?: number | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          location?: string | null
          postal_code?: string | null
          price_cents?: number | null
          registration_deadline?: string | null
          registration_url?: string | null
          source_url?: string | null
          start_date: string
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          available_spots?: number | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          location?: string | null
          postal_code?: string | null
          price_cents?: number | null
          registration_deadline?: string | null
          registration_url?: string | null
          source_url?: string | null
          start_date?: string
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          created_by: string | null
          grade: string | null
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      kids: {
        Row: {
          class_id: string | null
          created_at: string
          full_name: string
          grade: string | null
          id: string
          notes: string | null
          parent_id: string
          school_id: string | null
          share_with_class: boolean
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          full_name: string
          grade?: string | null
          id?: string
          notes?: string | null
          parent_id: string
          school_id?: string | null
          share_with_class?: boolean
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          full_name?: string
          grade?: string | null
          id?: string
          notes?: string | null
          parent_id?: string
          school_id?: string | null
          share_with_class?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_vacations: {
        Row: {
          created_at: string
          end_date: string
          id: string
          kind: string
          label: string | null
          parent_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          kind?: string
          label?: string | null
          parent_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          kind?: string
          label?: string | null
          parent_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_location: string | null
          business_name: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_location?: string | null
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_location?: string | null
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          created_at: string
          id: string
          kid_id: string
          parent_id: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kid_id: string
          parent_id: string
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kid_id?: string
          parent_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "camp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      share_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          id: string
          invitee_email: string
          inviter_id: string
          kid_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          id?: string
          invitee_email: string
          inviter_id: string
          kid_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          id?: string
          invitee_email?: string
          inviter_id?: string
          kid_id?: string
          token?: string
        }
        Relationships: []
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
      app_role: "vendor" | "parent" | "admin"
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
    Enums: {
      app_role: ["vendor", "parent", "admin"],
    },
  },
} as const
