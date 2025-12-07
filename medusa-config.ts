import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const isDev = process.env.NODE_ENV === "development";

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,

    cookieOptions: {
      secure: !isDev,
      sameSite: isDev ? "lax" : "none",
    },

    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },

    workerMode: process.env.MEDUSA_WORKER_MODE as
      | "shared"
      | "worker"
      | "server",

    redisUrl: isDev ? undefined : process.env.REDIS_URL,
  },

  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },

  // ✅ Redis modules only enabled in production, disabled in local dev
  modules: isDev
    ? []
    : [
        {
          resolve: "@medusajs/medusa/caching",
          options: {
            providers: [
              {
                resolve: "@medusajs/caching-redis",
                id: "caching-redis",
                is_default: true,
                options: {
                  redisUrl: process.env.CACHE_REDIS_URL,
                },
              },
            ],
          },
        },
        {
          resolve: "@medusajs/medusa/event-bus-redis",
          options: {
            redisUrl: process.env.REDIS_URL,
          },
        },
        {
          resolve: "@medusajs/medusa/workflow-engine-redis",
          options: {
            redis: {
              url: process.env.REDIS_URL,
            },
          },
        },
        {
          resolve: "@medusajs/medusa/locking",
          options: {
            providers: [
              {
                resolve: "@medusajs/medusa/locking-redis",
                id: "locking-redis",
                is_default: true,
                options: {
                  redisUrl: process.env.LOCKING_REDIS_URL,
                },
              },
            ],
          },
        },
        {
          resolve: "@medusajs/file-s3",
          options: {
            s3_url: process.env.S3_URL,
            bucket: process.env.S3_BUCKET,
            region: process.env.S3_REGION, // Supabase gives "ap-south-1"
            access_key_id: process.env.S3_ACCESS_KEY,
            secret_access_key: process.env.S3_SECRET_KEY,
            force_path_style: true, // REQUIRED for Supabase
          },
        },
      ],
});
