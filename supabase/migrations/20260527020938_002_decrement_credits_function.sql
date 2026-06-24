/*
  # Add decrement_credits RPC function

  1. New Functions
    - `decrement_credits` - Decrements ai_generations_remaining for a user by 1
      - Takes user_id as parameter
      - Returns void
      - Security: Only decrements the specified user's credits

  2. Security
    - Function uses SECURITY DEFINER so it can be called from edge functions
    - Only affects the user specified in the parameter
*/

CREATE OR REPLACE FUNCTION public.decrement_credits(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET ai_generations_remaining = GREATEST(ai_generations_remaining - 1, 0)
  WHERE id = user_id;
END;
$$;
