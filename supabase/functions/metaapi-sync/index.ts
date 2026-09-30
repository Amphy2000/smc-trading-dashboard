import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const META_API_URL = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const META_API_BASE = "https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai";

interface MetaApiAccount {
  accountId: string;
  login: string;
  server: string;
  platform: string;
}

interface MetaApiDeal {
  symbol: string;
  type: string;
  entryType: string;
  volume: number;
  price: number;
  profit: number;
  time: string;
  positionId: string;
  commission: number;
  swap: number;
}

function getPipSize(symbol: string): number {
  const isJpy = symbol.includes("JPY");
  if (isJpy) return 0.01;
  return 0.0001;
}

function getSessionFromTime(date: Date): string {
  const hourUTC = date.getUTCHours();
  if (hourUTC >= 12 && hourUTC < 17) return "overlap";
  if (hourUTC >= 7 && hourUTC < 12) return "london";
  if (hourUTC >= 13 && hourUTC < 22) return "new_york";
  if (hourUTC >= 0 && hourUTC < 7) return "asia";
  return "off_hours";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    let body: { action?: string; login?: string; password?: string; server?: string; platform?: string; userToken?: string } = {};
    try { body = await req.json(); } catch { /* request has no JSON body */ }
    const action = body.action || url.searchParams.get("action") || "sync";

    const userToken = body.userToken || req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (!userToken) {
      return new Response(
        JSON.stringify({ error: "Missing auth token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid auth token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = user.id;

    // Load MetaApi token from app_secrets table (RLS blocks all non-service-role access)
    const { data: secretRow } = await supabase
      .from("app_secrets")
      .select("value")
      .eq("key", "metaapi_token")
      .maybeSingle();
    const metaApiToken = secretRow?.value || null;

    // ─── ACTION: CONNECT ───
    // Creates a MetaApi account connection for the user's broker
    if (action === "connect") {
      if (!metaApiToken) {
        return new Response(
          JSON.stringify({ error: "Broker sync is not yet activated. The app owner needs to add a MetaApi token first." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { login, password, server, platform = "mt5" } = body;

      if (!login || !password || !server) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: login, password, server" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Create account on MetaApi.
      // Try the entered name plus MetaApi's suggested alternatives until one works.
      const serverCandidates = [String(server)];
      const spacedMatch = String(server).match(/^(.+?)(\d+)$/);
      if (spacedMatch) {
        const spaced = `${spacedMatch[1]} ${spacedMatch[2]}`;
        if (!serverCandidates.includes(spaced)) serverCandidates.push(spaced);
      }

      const createAccount = (srv: string) => fetch(
        `${META_API_URL}/users/current/accounts`,
        {
          method: "POST",
          headers: {
            "auth-token": metaApiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            login: String(login),
            password: String(password),
            server: srv,
            platform,
            name: `TraderDNA-${userId.substring(0, 8)}`,
            magic: 0,
          }),
        },
      );

      let createRes: Response | null = null;
      let createErrText = "";
      let usedServer = String(server);

      for (const srv of serverCandidates) {
        createRes = await createAccount(srv);
        if (createRes.ok) {
          usedServer = srv;
          break;
        }

        createErrText = await createRes.text();
        try {
          const errJson = JSON.parse(createErrText);
          const errMsg: string = errJson.message || "";
          const suggestMatch = errMsg.match(/Suggested server names:\s*(.+)/i);
          if (suggestMatch) {
            const suggestions = suggestMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
            for (const suggestion of suggestions) {
              if (!serverCandidates.includes(suggestion)) serverCandidates.push(suggestion);
            }
          }
        } catch { /* not JSON */ }
      }

      if (!createRes || !createRes.ok) {
        let errMessage = "Failed to connect to broker";
        try {
          const errJson = JSON.parse(createErrText);
          errMessage = errJson.message || errJson.error || errMessage;
        } catch {
          if (createErrText.includes("already")) errMessage = "This account is already connected";
          else if (createErrText.includes("credentials")) errMessage = "Invalid login or password — check your MT5 details";
          else if (createErrText.includes("server")) errMessage = "Broker server not found — check the server name";
          else errMessage = createErrText.substring(0, 200);
        }
        return new Response(
          JSON.stringify({ error: errMessage }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const created = await createRes.json();
      const accountId = created.accountId || created.id;

      // Deploy the account (starts the API server + terminal connection)
      await fetch(`${META_API_URL}/users/current/accounts/${accountId}/deploy`, {
        method: "POST",
        headers: { "auth-token": metaApiToken },
      });

      // Save connection to database
      const { data: connection, error: insertError } = await supabase
        .from("broker_connections")
        .insert({
          user_id: userId,
          metaapi_account_id: accountId,
          login: String(login),
          server: usedServer,
          platform,
          status: "deploying",
          broker_name: usedServer.split("-")[0] || usedServer,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Connected to broker but failed to save. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          connectionId: connection.id,
          metaapiAccountId: accountId,
          status: "deploying",
          message: "Connected! Your broker account is being deployed. Trades will sync automatically in 1-2 minutes.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ACTION: STATUS ───
    // Check connection status and account info
    if (action === "status") {
      const { data: connections } = await supabase
        .from("broker_connections")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!connections || connections.length === 0) {
        return new Response(
          JSON.stringify({ connected: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const conn = connections[0];

      // Check MetaApi account status
      if (metaApiToken && conn.metaapi_account_id) {
        try {
          const accountRes = await fetch(
            `${META_API_URL}/users/current/accounts/${conn.metaapi_account_id}`,
            { headers: { "auth-token": metaApiToken } },
          );
          if (accountRes.ok) {
            const accountInfo = await accountRes.json();
            const deployState = accountInfo.state || "unknown";
            const connectionStatus = accountInfo.connectionStatus || "unknown";

            let dbStatus = conn.status;
            if (deployState === "DEPLOYED" && connectionStatus === "CONNECTED") {
              dbStatus = "active";
            } else if (deployState === "DEPLOYING") {
              dbStatus = "deploying";
            } else if (connectionStatus === "DISCONNECTED") {
              dbStatus = "disconnected";
            } else if (deployState === "DEPLOYED") {
              dbStatus = "connected";
            }

            if (dbStatus !== conn.status) {
              await supabase
                .from("broker_connections")
                .update({ status: dbStatus, updated_at: new Date().toISOString() })
                .eq("id", conn.id);
            }

            // Get account info (balance, currency, leverage)
            if (dbStatus === "active" && accountInfo.account) {
              await supabase
                .from("broker_connections")
                .update({
                  account_currency: accountInfo.account.currency,
                  account_leverage: `1:${accountInfo.account.leverage}`,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conn.id);
            }

            return new Response(
              JSON.stringify({
                connected: true,
                connectionId: conn.id,
                status: dbStatus,
                login: conn.login,
                server: conn.server,
                broker_name: conn.broker_name,
                last_sync_at: conn.last_sync_at,
                last_error: conn.last_error,
                deployState,
                connectionStatus,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        } catch {
          // Fall through to return stored status
        }
      }

      return new Response(
        JSON.stringify({
          connected: true,
          connectionId: conn.id,
          status: conn.status,
          login: conn.login,
          server: conn.server,
          broker_name: conn.broker_name,
          last_sync_at: conn.last_sync_at,
          last_error: conn.last_error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ACTION: SYNC ───
    // Pull historical trades from MetaApi and insert into our trades table
    if (action === "sync") {
      if (!metaApiToken) {
        return new Response(
          JSON.stringify({ error: "Broker sync is not yet activated." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: connections } = await supabase
        .from("broker_connections")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!connections || connections.length === 0) {
        return new Response(
          JSON.stringify({ error: "No broker connection found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const conn = connections[0];

      if (!conn.metaapi_account_id) {
        return new Response(
          JSON.stringify({ error: "Connection not fully set up yet" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Update status to syncing
      await supabase
        .from("broker_connections")
        .update({ status: "syncing", updated_at: new Date().toISOString() })
        .eq("id", conn.id);

      // Pull historical trades from MetaStats API
      // Format: GET /users/current/accounts/:accountId/historical-trades/:startTime/:endTime
      const endTime = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0].replace(/-/g, "");

      const tradesRes = await fetch(
        `${META_API_BASE}/users/current/accounts/${conn.metaapi_account_id}/historical-trades/${startTime}/${endTime}`,
        { headers: { "auth-token": metaApiToken } },
      );

      if (!tradesRes.ok) {
        const errText = await tradesRes.text();
        let errMsg = "Failed to fetch trades";
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.message || errMsg;
        } catch {
          if (errText.includes("not deployed") || errText.includes("DEPLOYING")) {
            errMsg = "Your broker account is still connecting. Please wait 1-2 minutes and try again.";
          } else if (errText.includes("DISCONNECTED")) {
            errMsg = "Your broker connection dropped. Try reconnecting.";
          }
        }

        await supabase
          .from("broker_connections")
          .update({ status: "error", last_error: errMsg, updated_at: new Date().toISOString() })
          .eq("id", conn.id);

        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const tradesData = await tradesRes.json();
      const deals: MetaApiDeal[] = tradesData.historicalTrades || tradesData.trades || [];

      if (deals.length === 0) {
        await supabase
          .from("broker_connections")
          .update({
            status: "active",
            last_sync_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        return new Response(
          JSON.stringify({ success: true, imported: 0, message: "No trades found yet. Trades will appear once you start trading." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Group deals by positionId to pair entry/exit
      const positions = new Map<string, { entryDeal?: MetaApiDeal; exitDeal?: MetaApiDeal }>();

      for (const deal of deals) {
        const posId = String(deal.positionId);
        if (!positions.has(posId)) positions.set(posId, {});

        const pos = positions.get(posId)!;
        if (deal.entryType === "DEAL_ENTRY_IN") {
          pos.entryDeal = deal;
        } else if (deal.entryType === "DEAL_ENTRY_OUT" || deal.entryType === "DEAL_ENTRY_INOUT") {
          pos.exitDeal = deal;
        }
      }

      // Get existing trades for deduplication
      const { data: existingTrades } = await supabase
        .from("trades")
        .select("opened_at, pair, direction")
        .eq("user_id", userId);

      const existingKeys = new Set(
        (existingTrades || []).map((t) => `${t.opened_at}-${t.pair}-${t.direction}`),
      );

      let imported = 0;
      let skipped = 0;

      for (const [, pos] of positions) {
        if (!pos.entryDeal) continue;

        const entry = pos.entryDeal;
        const exit = pos.exitDeal;

        const openDate = new Date(entry.time);
        const key = `${openDate.toISOString()}-${entry.symbol}-${entry.type.includes("SELL") ? "SELL" : "BUY"}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        const direction = entry.type.includes("SELL") ? "SELL" : "BUY";
        const pipSize = getPipSize(entry.symbol);
        const openPrice = entry.price;
        const closePrice = exit ? exit.price : null;
        const totalProfit = (entry.profit || 0) + (exit?.profit || 0) + (entry.commission || 0) + (exit?.commission || 0) + (entry.swap || 0) + (exit?.swap || 0);

        let pipsResult: number | null = null;
        if (closePrice !== null) {
          pipsResult = direction === "BUY"
            ? (closePrice - openPrice) / pipSize
            : (openPrice - closePrice) / pipSize;
        }

        const { error: insertError } = await supabase.from("trades").insert({
          user_id: userId,
          pair: entry.symbol,
          direction,
          status: closePrice !== null ? "closed" : "open",
          entry_price: openPrice,
          exit_price: closePrice,
          stop_loss: null,
          take_profit: null,
          lot_size: entry.volume,
          pips_result: pipsResult,
          profit_loss: totalProfit,
          notes: "Auto-synced from broker via MetaApi",
          opened_at: openDate.toISOString(),
          closed_at: exit ? new Date(exit.time).toISOString() : null,
          session: getSessionFromTime(openDate),
          confidence_level: null,
          mental_state: null,
          confluences: null,
          setup_type: null,
          planned_rr: null,
          day_of_week: openDate.getDay(),
          tagged: false,
        });

        if (!insertError) imported++;
      }

      // Log sync
      await supabase.from("mt5_sync_queue").insert({
        user_id: userId,
        raw_content: `MetaApi sync: ${deals.length} deals, ${imported} imported`,
        source: "metaapi",
        status: "processed",
        trades_parsed: deals.length,
        trades_imported: imported,
      });

      // Update connection status
      await supabase
        .from("broker_connections")
        .update({
          status: "active",
          last_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);

      return new Response(
        JSON.stringify({
          success: true,
          received: deals.length,
          imported,
          skipped,
          message: `${imported} new trades synced from your broker`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ACTION: DISCONNECT ───
    if (action === "disconnect") {
      const { data: connections } = await supabase
        .from("broker_connections")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (connections && connections.length > 0 && metaApiToken) {
        const conn = connections[0];
        if (conn.metaapi_account_id) {
          await fetch(`${META_API_URL}/users/current/accounts/${conn.metaapi_account_id}/undeploy`, {
            method: "POST",
            headers: { "auth-token": metaApiToken },
          });
          await fetch(`${META_API_URL}/users/current/accounts/${conn.metaapi_account_id}`, {
            method: "DELETE",
            headers: { "auth-token": metaApiToken },
          });
        }
        await supabase
          .from("broker_connections")
          .update({ status: "disconnected", updated_at: new Date().toISOString() })
          .eq("id", conn.id);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Broker disconnected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed. Please check your details and try again.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
