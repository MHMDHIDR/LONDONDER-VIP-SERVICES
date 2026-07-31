import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// You will need to replace this with the generated public VAPID key
const VAPID_PUBLIC_KEY = "REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY";

export function useNotifications(isAdmin: boolean) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Register service worker if not already registered
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service Worker registration failed:", err);
      });

      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(!!subscription);
  };

  const subscribe = async () => {
    if (!isAdmin) {
      toast.error("Only admins can receive push notifications");
      return;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        throw new Error("Notification permission denied");
      }

      const registration = await navigator.serviceWorker.ready;
      
      if (VAPID_PUBLIC_KEY === "REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY") {
        toast.error("VAPID Public Key is not configured. Please set it in useNotifications.ts");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { data: userResponse } = await supabase.auth.getUser();
      if (!userResponse.user) throw new Error("Not logged in");

      const subData = JSON.parse(JSON.stringify(subscription));

      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: userResponse.user.id,
        is_admin: true,
        endpoint: subData.endpoint,
        p256dh: subData.keys.p256dh,
        auth: subData.keys.auth,
        user_agent: navigator.userAgent,
      }, { onConflict: "is_admin, endpoint" });

      if (error) {
        throw error;
      }

      setIsSubscribed(true);
      toast.success("Successfully subscribed to notifications");
    } catch (error: any) {
      console.error("Error subscribing to push notifications:", error);
      toast.error(error.message || "Failed to subscribe to notifications");
    }
  };

  const unsubscribe = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        const { data: userResponse } = await supabase.auth.getUser();
        if (userResponse.user) {
           await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userResponse.user.id)
            .eq("endpoint", subscription.endpoint);
        }
      }
      
      setIsSubscribed(false);
      toast.success("Unsubscribed from notifications");
    } catch (error: any) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to unsubscribe");
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    unsubscribe,
  };
}

// Utility to convert Base64 URL-safe string to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
