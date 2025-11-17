import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials for this environment.
// In a real-world application, these should be securely managed as environment variables.
const supabaseUrl = 'https://wtaphkdrierzcplktijz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0YXBoa2RyaWVyemNwbGt0aWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMTkxNjMsImV4cCI6MjA3ODg5NTE2M30.Vb25r63xvCvZmsHSKL4KsHotd3uP1T5Gq5dOsKE-Pbs';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase credentials not set.");
    // Throw an error to prevent the app from running without a valid Supabase configuration.
    throw new Error("Supabase URL and Anon Key must be provided.");
}

// Initialize and export the Supabase client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);