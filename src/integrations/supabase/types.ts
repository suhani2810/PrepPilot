export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      candidate_profiles: {
        Row: {
          created_at: string;
          id: string;
          parsed: Json;
          resume_path: string | null;
          resume_text: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parsed?: Json;
          resume_path?: string | null;
          resume_text?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          parsed?: Json;
          resume_path?: string | null;
          resume_text?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      evaluations: {
        Row: {
          clarity: number | null;
          communication: number | null;
          created_at: string;
          id: string;
          ideal_answer: string | null;
          interview_id: string;
          interview_message_id: string;
          missing_concepts: Json | null;
          overall_score: number | null;
          problem_solving: number | null;
          recommended_follow_up: string | null;
          relevance: number | null;
          strengths: Json | null;
          technical_accuracy: number | null;
          weaknesses: Json | null;
        };
        Insert: {
          clarity?: number | null;
          communication?: number | null;
          created_at?: string;
          id?: string;
          ideal_answer?: string | null;
          interview_id: string;
          interview_message_id: string;
          missing_concepts?: Json | null;
          overall_score?: number | null;
          problem_solving?: number | null;
          recommended_follow_up?: string | null;
          relevance?: number | null;
          strengths?: Json | null;
          technical_accuracy?: number | null;
          weaknesses?: Json | null;
        };
        Update: {
          clarity?: number | null;
          communication?: number | null;
          created_at?: string;
          id?: string;
          ideal_answer?: string | null;
          interview_id?: string;
          interview_message_id?: string;
          missing_concepts?: Json | null;
          overall_score?: number | null;
          problem_solving?: number | null;
          recommended_follow_up?: string | null;
          relevance?: number | null;
          strengths?: Json | null;
          technical_accuracy?: number | null;
          weaknesses?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "evaluations_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluations_interview_message_id_fkey";
            columns: ["interview_message_id"];
            isOneToOne: false;
            referencedRelation: "interview_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_messages: {
        Row: {
          content: string;
          created_at: string;
          difficulty: number | null;
          id: string;
          interview_id: string;
          order_index: number;
          role: string;
          topic: string | null;
        };
        Insert: {
          content: string;
          created_at?: string;
          difficulty?: number | null;
          id?: string;
          interview_id: string;
          order_index: number;
          role: string;
          topic?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string;
          difficulty?: number | null;
          id?: string;
          interview_id?: string;
          order_index?: number;
          role?: string;
          topic?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "interview_messages_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      interviews: {
        Row: {
          candidate_profile_id: string | null;
          completed_at: string | null;
          context: Json;
          created_at: string;
          duration_minutes: number | null;
          experience_level: string | null;
          final_report: Json | null;
          id: string;
          interview_types: string[];
          job_description: string | null;
          overall_score: number | null;
          plan: Json;
          readiness_score: number | null;
          role: string;
          started_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          candidate_profile_id?: string | null;
          completed_at?: string | null;
          context?: Json;
          created_at?: string;
          duration_minutes?: number | null;
          experience_level?: string | null;
          final_report?: Json | null;
          id?: string;
          interview_types?: string[];
          job_description?: string | null;
          overall_score?: number | null;
          plan?: Json;
          readiness_score?: number | null;
          role: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          candidate_profile_id?: string | null;
          completed_at?: string | null;
          context?: Json;
          created_at?: string;
          duration_minutes?: number | null;
          experience_level?: string | null;
          final_report?: Json | null;
          id?: string;
          interview_types?: string[];
          job_description?: string | null;
          overall_score?: number | null;
          plan?: Json;
          readiness_score?: number | null;
          role?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_profile_id_fkey";
            columns: ["candidate_profile_id"];
            isOneToOne: false;
            referencedRelation: "candidate_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_roadmaps: {
        Row: {
          content: Json;
          created_at: string;
          id: string;
          interview_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          id?: string;
          interview_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          id?: string;
          interview_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_roadmaps_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: true;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          readiness_score: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          readiness_score?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          readiness_score?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
