
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fvbmckogcizaxdnlsrto.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2Ym1ja29nY2l6YXhkbmxzcnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzMDUzODcsImV4cCI6MjA1ODg4MTM4N30.-t69uwAO88KufYBYi24v1eolbHw6ks7cR2IqX1lISW4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Updated type definitions to match the database schema
export type Profile = {
  id: string;
  username: string;  // Using username as per DB schema
  email: string | null;
  avatar_url: string | null;
  rating: number;
  created_at: string;
  updated_at?: string;
};

export type Battle = {
  id: string;
  creator_id: string;
  defender_id: string | null;
  problem_id: number;
  programming_language: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';  // Updated to match the database schema
  duration: number;
  battle_type: 'Rated' | 'Casual';
  status: 'open' | 'in_progress' | 'completed';
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type Submission = {
  id: string;
  battle_id: string;
  user_id: string;
  code: string;
  language: string;
  status: 'pending' | 'correct' | 'incorrect' | 'evaluated';
  submitted_at: string;
  score: number;  // Required field based on the error
  feedback: string | null;
  evaluated_at: string | null;
};

// Adding a Solution type that was used in BattleArena.tsx but wasn't defined
export type Solution = {
  id: string;
  battle_id: string;
  user_id: string;
  code: string;
  submitted_at: string;
};
