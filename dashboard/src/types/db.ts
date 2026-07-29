// Database types (mirrors supabase/schema.sql)
// Hand-written; regenerate via `supabase gen types typescript` once
// the Supabase project is provisioned and the schema is applied.

export interface Database {
  public: {
    Tables: {
      scores: {
        Row: {
          user_id: string;
          date: string;
          score: number | null;
          hrv: number | null;
          rhr: number | null;
          sleep_hours: number | null;
          vo2max: number | null;
          body_battery: number | null;
          weight_kg: number | null;
          mood: number | null;
          cycle_day: number | null;
          cycle_phase: "menstrual" | "follicular" | "ovulation" | "luteal" | null;
          notes: string | null;
          // Body composition from the Garmin scale (migration 0004 added
          // these columns). Nullable on days without a scale reading.
          body_fat_percent: number | null;
          muscle_mass_kg: number | null;
          body_water_percent: number | null;
          // Weekly grip strength test (migration 0008). NULL on non-test days.
          grip_kg: number | null;
          grip_r_kg: number | null;
          grip_l_kg: number | null;
          // Garmin sleep score 0–100 (migration 0011). NULL on days without a reading.
          sleep_score: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["scores"]["Row"]> & { date: string };
        Update: Partial<Database["public"]["Tables"]["scores"]["Row"]>;
        Relationships: [];
      };
      weight_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          time_of_day: string | null;
          weight_kg: number;
          context:
            | "fasted"
            | "before_breakfast"
            | "after_breakfast"
            | "post_run"
            | "evening"
            | "other"
            | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["weight_logs"]["Row"]> & {
          date: string;
          weight_kg: number;
        };
        Update: Partial<Database["public"]["Tables"]["weight_logs"]["Row"]>;
        Relationships: [];
      };
      check_ins: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          content_md: string;
          coach_read: string | null;
          micro_actions: unknown | null;
          closer: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["check_ins"]["Row"]> & {
          date: string;
          content_md: string;
        };
        Update: Partial<Database["public"]["Tables"]["check_ins"]["Row"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: number;
          user_id: string;
          date: string;
          type: string | null;
          name: string | null;
          distance_km: number | null;
          duration_s: number | null;
          avg_pace_s_per_km: number | null;
          avg_hr: number | null;
          max_hr: number | null;
          avg_power: number | null;
          elevation_m: number | null;
          perceived_effort: number | null;
          feel: "great" | "good" | "ok" | "flat" | "bad" | null;
          notes: string | null;
          raw: unknown | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activities"]["Row"]> & {
          id: number;
          date: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Row"]>;
        Relationships: [];
      };
      meals: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          slot: "breakfast" | "lunch" | "dinner" | "snack" | null;
          photo_path: string | null;
          foods: string[] | null;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          calories: number | null;
          vision_notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meals"]["Row"]> & { date: string };
        Update: Partial<Database["public"]["Tables"]["meals"]["Row"]>;
        Relationships: [];
      };
      body_photos: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          kind: "build_weekly" | "hyrox";
          build_week: number | null;
          storage_path: string;
          caption: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["body_photos"]["Row"]> & {
          date: string;
          kind: "build_weekly" | "hyrox";
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["body_photos"]["Row"]>;
        Relationships: [];
      };
      actions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          kind:
            | "block_recovery"
            | "block_training"
            | "draft_email"
            | "add_meal_reminder"
            | "flag_medical"
            | null;
          title: string;
          description: string | null;
          status: "pending" | "confirmed" | "skipped" | "done" | "expired";
          proposed_by: "coach" | "nutri" | "doc" | "mind";
          payload: unknown | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["actions"]["Row"]> & {
          date: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["actions"]["Row"]>;
        Relationships: [];
      };
      medical: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          visit_date: string | null;
          next_due: string | null;
          summary: string | null;
          full_md: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["medical"]["Row"]> & { topic: string };
        Update: Partial<Database["public"]["Tables"]["medical"]["Row"]>;
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          title: string;
          tags: string[] | null;
          ingredients: unknown | null;
          steps: string[] | null;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          prep_time_min: number | null;
          cook_time_min: number | null;
          source_md_path: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["recipes"]["Row"]> & {
          slug: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipes"]["Row"]>;
        Relationships: [];
      };
      marathons: {
        Row: {
          id: string;
          user_id: string;
          race_date: string;
          race_name: string;
          finish_time_s: number;
          avg_pace_s_per_km: number | null;
          weather: string | null;
          weekly_volume_km: number | null;
          longest_run_km: number | null;
          notes: string | null;
          wall_km: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["marathons"]["Row"]> & {
          race_date: string;
          race_name: string;
          finish_time_s: number;
        };
        Update: Partial<Database["public"]["Tables"]["marathons"]["Row"]>;
        Relationships: [];
      };
      tune_up_races: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          distance_km: number;
          label: string | null;
          status: "planned" | "done" | "cancelled" | "tbd";
          finish_time_s: number | null;
          notes: string | null;
          link: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["tune_up_races"]["Row"]> & {
          date: string;
          distance_km: number;
        };
        Update: Partial<Database["public"]["Tables"]["tune_up_races"]["Row"]>;
        Relationships: [];
      };
      cycles: {
        Row: {
          id: string;
          user_id: string;
          lmp_date: string;
          cycle_length_days: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cycles"]["Row"]> & { lmp_date: string };
        Update: Partial<Database["public"]["Tables"]["cycles"]["Row"]>;
        Relationships: [];
      };
      config: {
        Row: {
          user_id: string;
          cycle_tracking: boolean;
          vision_macros: boolean;
          race_date: string;
          race_name: string;
          sessions_goal: number;
          sessions_start: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["config"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["config"]["Row"]>;
        Relationships: [];
      };
    };
  };
}
