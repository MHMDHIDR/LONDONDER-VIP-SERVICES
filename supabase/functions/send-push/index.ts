import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import webPush from "npm:web-push@3.6.7";

serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record || !record.message) {
      return new Response("Invalid payload", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const publicVapidKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateVapidKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!publicVapidKey || !privateVapidKey) {
      throw new Error("Missing VAPID keys");
    }

    webPush.setVapidDetails(
      "mailto:admin@example.com",
      publicVapidKey,
      privateVapidKey
    );

    // Fetch all admin subscriptions since notifications where user_id IS NULL are for admins
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("is_admin", true);

    if (error) {
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response("No admin subscriptions found", { status: 200 });
    }

    const payload = JSON.stringify({
      title: record.title || "Notification",
      message: record.message,
      link: record.link || "/",
    });

    const sendPromises = subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      return webPush.sendNotification(pushSubscription, payload).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Delete invalid subscriptions
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push notification error:", err);
        }
      });
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
