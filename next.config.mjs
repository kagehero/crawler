/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * 開発サーバーへ「別オリジン」（別 IP / ドメイン）からブラウザで開くとき、
   * HMR 等の dev 用リソースを許可する。必要に応じて追記。
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
   */
  allowedDevOrigins: [
    "103.179.45.105",
    // "example.com",
  ],
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/venv/**",
        "**/.venv/**",
        "**/crawler/**",
        "**/node_modules/**",
      ],
    };
    return config;
  },
};

export default nextConfig;
