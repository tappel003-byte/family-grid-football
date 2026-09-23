import { supabase } from "@/integrations/supabase/client";

export type TradeBlockRow = {
  id: string;
  team_slot: number;
  user_id: string;
  player_id: string;
  created_at: string;
};

export async function listMyWatchlist(): Promise<string[]> {
  const { data, error } = await supabase.from("player_watchlist").select("player_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.player_id);
}

export async function setWatched(playerId: string, watched: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Sign in to use your watchlist.");
  const { data: league } = await supabase.from("league").select("id").eq("slug", "main").single();
  if (!league) throw new Error("The league is not ready yet.");
  const action = watched
    ? supabase.from("player_watchlist").upsert({ user_id: user.id, league_id: league.id, player_id: playerId })
    : supabase.from("player_watchlist").delete().eq("user_id", user.id).eq("league_id", league.id).eq("player_id", playerId);
  const { error } = await action;
  if (error) throw new Error(error.message);
}

export async function listTradeBlock(): Promise<TradeBlockRow[]> {
  const { data, error } = await supabase
    .from("trade_block")
    .select("id, team_slot, user_id, player_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TradeBlockRow[];
}

export async function setTradeBlockPlayer(input: {
  leagueId: string;
  teamSlot: number;
  playerId: string;
  listed: boolean;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Sign in to update your trade block.");
  const action = input.listed
    ? supabase.from("trade_block").upsert({
        league_id: input.leagueId,
        team_slot: input.teamSlot,
        user_id: user.id,
        player_id: input.playerId,
      })
    : supabase.from("trade_block").delete().eq("league_id", input.leagueId).eq("player_id", input.playerId).eq("user_id", user.id);
  const { error } = await action;
  if (error) throw new Error(error.message);
}