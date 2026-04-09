import { assertSupabaseConfigured, supabase } from "../lib/supabase";

export type ProfileInput = {
  client_id: string;
  name: string;
  age: number;
  gender: string;
  job: string;
};

export async function upsertProfile(input: ProfileInput): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.from("profiles").upsert(
    {
      client_id: input.client_id,
      name: input.name,
      age: input.age,
      gender: input.gender,
      job: input.job,
    },
    { onConflict: "client_id" }
  );

  if (error) throw new Error(error.message);
}

export async function getProfile(clientId: string): Promise<ProfileInput | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from("profiles")
    .select("client_id,name,age,gender,job")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    client_id: data.client_id as string,
    name: (data.name ?? "") as string,
    age: (data.age ?? 0) as number,
    gender: (data.gender ?? "") as string,
    job: (data.job ?? "") as string,
  };
}

