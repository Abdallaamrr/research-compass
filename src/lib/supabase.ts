import { createClient } from "@supabase/supabase-js";

export const getEnv = (key: string): string => {
  if (typeof window === "undefined") {
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key];
    }
  }
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return "";
};

let supabaseUrl = getEnv("VITE_SUPABASE_URL");
let supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

// Synchronous filesystem loader on server side to guarantee keys are loaded during SSR
if (typeof window === "undefined") {
  try {
    const fsLib = "fs";
    const pathLib = "path";
    const fs = await import(/* @vite-ignore */ fsLib);
    const path = await import(/* @vite-ignore */ pathLib);
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim() || line.trim().startsWith("#")) continue;
        const parts = line.split("=");
        const k = parts[0].trim();
        const v = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        if (k) {
          process.env[k] = v;
          if (k === "VITE_SUPABASE_URL") supabaseUrl = v;
          if (k === "VITE_SUPABASE_ANON_KEY") supabaseAnonKey = v;
        }
      }
    }
  } catch (e) {
    console.warn("Could not manually load .env file on server:", e);
  }
}

// Verify both keys exist and the URL is a valid format to prevent createClient from throwing.
export const hasSupabaseKeys = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("https://") &&
  !supabaseUrl.includes("your-project-id")
);

if (typeof window === "undefined") {
  console.log("🔥 Live Supabase URL:", supabaseUrl);
}

if (!hasSupabaseKeys) {
  console.warn(
    "Supabase credentials are missing, placeholder, or invalid. App is running in offline mode with mock seed data."
  );
}

export const supabase = hasSupabaseKeys
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

export async function uploadFileToStorage(file: File | Blob, originalName: string, bucketName: string = "documents"): Promise<string> {
  if (!hasSupabaseKeys) {
    // If offline, convert to base64 data URL so it survives page reload/refresh
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  try {
    // Automatically create/verify bucket exists (fails cleanly if exists)
    await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    }).catch(() => {});

    const fileExt = originalName.split(".").pop() || "bin";
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Supabase storage upload error, falling back to Base64 Data URL:", err);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
}
