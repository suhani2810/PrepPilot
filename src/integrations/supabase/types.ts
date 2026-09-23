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
      candidate_profiles: {
        Row: {
          created_at: string
          id: string
          parsed: Json
          resume_path: string | null
          resume_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parsed?: Json
          resume_path?: string | null
          resume_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parsed?: Json
          resume_path?: string | null
          resume_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coding_problems: {
        Row: {
          constraints: string[]
          created_at: string
          difficulty: string
          examples: Json
          explanation: string
          hidden_tests: Json
          id: string
          review_status: string
          slug: string
          starter_code: Json
          statement: string
          title: string
          topics: string[]
        }
        Insert: {
          constraints?: string[]
          created_at?: string
          difficulty: string
          examples?: Json
          explanation?: string
          hidden_tests?: Json
          id?: string
          review_status?: string
          slug: string
          starter_code?: Json
          statement: string
          title: string
          topics?: string[]
        }
        Update: {
          constraints?: string[]
          created_at?: string
          difficulty?: string
          examples?: Json
          explanation?: string
          hidden_tests?: Json
          id?: string
          review_status?: string
          slug?: string
          starter_code?: Json
          statement?: string
          title?: string
          topics?: string[]
        }
        Relationships: []
      }
      coding_submissions: {
        Row: {
          created_at: string
          id: string
          language: string
          memory_kb: number | null
          passed_tests: number
          problem_id: string
          result: Json
          runtime_ms: number | null
          score: number
          source_code: string
          status: string
          total_tests: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language: string
          memory_kb?: number | null
          passed_tests?: number
          problem_id: string
          result?: Json
          runtime_ms?: number | null
          score?: number
          source_code: string
          status: string
          total_tests?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          memory_kb?: number | null
          passed_tests?: number
          problem_id?: string
          result?: Json
          runtime_ms?: number | null
          score?: number
          source_code?: string
          status?: string
          total_tests?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_submissions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "coding_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      document_concepts: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          document_id: string
          id: string
          name: string
          prerequisites: Json
          related_coding_topics: Json
          source_page: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          difficulty?: string
          document_id: string
          id?: string
          name: string
          prerequisites?: Json
          related_coding_topics?: Json
          source_page?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          document_id?: string
          id?: string
          name?: string
          prerequisites?: Json
          related_coding_topics?: Json
          source_page?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_concepts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          analysis: Json
          content_hash: string | null
          created_at: string
          document_type: string
          extracted_text: string | null
          file_size: number
          file_type: string
          filename: string
          id: string
          page_count: number | null
          processing_error: string | null
          processing_status: string
          storage_path: string
          subject: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          analysis?: Json
          content_hash?: string | null
          created_at?: string
          document_type?: string
          extracted_text?: string | null
          file_size: number
          file_type?: string
          filename: string
          id?: string
          page_count?: number | null
          processing_error?: string | null
          processing_status?: string
          storage_path: string
          subject?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          analysis?: Json
          content_hash?: string | null
          created_at?: string
          document_type?: string
          extracted_text?: string | null
          file_size?: number
          file_type?: string
          filename?: string
          id?: string
          page_count?: number | null
          processing_error?: string | null
          processing_status?: string
          storage_path?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          clarity: number | null
          communication: number | null
          created_at: string
          id: string
          ideal_answer: string | null
          interview_id: string
          interview_message_id: string
          missing_concepts: Json | null
          overall_score: number | null
          problem_solving: number | null
          recommended_follow_up: string | null
          relevance: number | null
          strengths: Json | null
          technical_accuracy: number | null
          weaknesses: Json | null
        }
        Insert: {
          clarity?: number | null
          communication?: number | null
          created_at?: string
          id?: string
          ideal_answer?: string | null
          interview_id: string
          interview_message_id: string
          missing_concepts?: Json | null
          overall_score?: number | null
          problem_solving?: number | null
          recommended_follow_up?: string | null
          relevance?: number | null
          strengths?: Json | null
          technical_accuracy?: number | null
          weaknesses?: Json | null
        }
        Update: {
          clarity?: number | null
          communication?: number | null
          created_at?: string
          id?: string
          ideal_answer?: string | null
          interview_id?: string
          interview_message_id?: string
          missing_concepts?: Json | null
          overall_score?: number | null
          problem_solving?: number | null
          recommended_follow_up?: string | null
          relevance?: number | null
          strengths?: Json | null
          technical_accuracy?: number | null
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_interview_message_id_fkey"
            columns: ["interview_message_id"]
            isOneToOne: false
            referencedRelation: "interview_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          rating: string
          reason: string | null
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: string
          reason?: string | null
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: string
          reason?: string | null
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_messages: {
        Row: {
          content: string
          created_at: string
          difficulty: number | null
          id: string
          interview_id: string
          order_index: number
          role: string
          topic: string | null
        }
        Insert: {
          content: string
          created_at?: string
          difficulty?: number | null
          id?: string
          interview_id: string
          order_index: number
          role: string
          topic?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          difficulty?: number | null
          id?: string
          interview_id?: string
          order_index?: number
          role?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_messages_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          candidate_profile_id: string | null
          completed_at: string | null
          context: Json
          created_at: string
          duration_minutes: number | null
          experience_level: string | null
          final_report: Json | null
          id: string
          interview_types: string[]
          job_description: string | null
          overall_score: number | null
          plan: Json
          readiness_score: number | null
          role: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          candidate_profile_id?: string | null
          completed_at?: string | null
          context?: Json
          created_at?: string
          duration_minutes?: number | null
          experience_level?: string | null
          final_report?: Json | null
          id?: string
          interview_types?: string[]
          job_description?: string | null
          overall_score?: number | null
          plan?: Json
          readiness_score?: number | null
          role: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          candidate_profile_id?: string | null
          completed_at?: string | null
          context?: Json
          created_at?: string
          duration_minutes?: number | null
          experience_level?: string | null
          final_report?: Json | null
          id?: string
          interview_types?: string[]
          job_description?: string | null
          overall_score?: number | null
          plan?: Json
          readiness_score?: number | null
          role?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          analysis: Json
          company: string | null
          created_at: string
          id: string
          raw_text: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          company?: string | null
          created_at?: string
          id?: string
          raw_text: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          company?: string | null
          created_at?: string
          id?: string
          raw_text?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_roadmaps: {
        Row: {
          content: Json
          created_at: string
          id: string
          interview_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          interview_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          interview_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_roadmaps_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: true
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attempts: {
        Row: {
          answer_text: string
          created_at: string
          dimension_scores: Json
          feedback: Json
          id: string
          question_id: string
          score: number
          session_id: string
          user_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          dimension_scores?: Json
          feedback?: Json
          id?: string
          question_id: string
          score: number
          session_id: string
          user_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          dimension_scores?: Json
          feedback?: Json
          id?: string
          question_id?: string
          score?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "technical_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          completed_at: string | null
          id: string
          score: number | null
          session_type: string
          source_id: string | null
          source_type: string
          started_at: string
          status: string
          user_id: string
          weak_areas: Json
        }
        Insert: {
          completed_at?: string | null
          id?: string
          score?: number | null
          session_type?: string
          source_id?: string | null
          source_type: string
          started_at?: string
          status?: string
          user_id: string
          weak_areas?: Json
        }
        Update: {
          completed_at?: string | null
          id?: string
          score?: number | null
          session_type?: string
          source_id?: string | null
          source_type?: string
          started_at?: string
          status?: string
          user_id?: string
          weak_areas?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          readiness_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          readiness_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          readiness_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      request_rate_limits: {
        Row: {
          action: string
          request_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          action: string
          request_count?: number
          user_id: string
          window_started_at: string
        }
        Update: {
          action?: string
          request_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      technical_questions: {
        Row: {
          created_at: string
          difficulty: number
          document_id: string | null
          evaluation_criteria: Json
          expected_answer: string
          id: string
          job_description_id: string | null
          question_text: string
          source_reference: Json
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: number
          document_id?: string | null
          evaluation_criteria?: Json
          expected_answer?: string
          id?: string
          job_description_id?: string | null
          question_text: string
          source_reference?: Json
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          document_id?: string | null
          evaluation_criteria?: Json
          expected_answer?: string
          id?: string
          job_description_id?: string | null
          question_text?: string
          source_reference?: Json
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_questions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_questions_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          event_name: string
          id: number
          properties: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: never
          properties?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: never
          properties?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit: {
        Args: { p_action: string; p_user_id: string }
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
    Enums: {},
  },
} as const
