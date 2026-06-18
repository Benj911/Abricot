import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Configuration du Proxy inversé (Reverse Proxy).
   * Redirige toutes les requêtes frontend commençant par `/api/` vers le backend Express (Port 8000).
   * Cela permet de contourner les restrictions CORS du navigateur en environnement de développement local.
   */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/:path*', 
      },
    ];
  },

  /**
   * Déclaration vide pour forcer l'intégration silencieuse de Turbopack 
   * et éviter les avertissements de compilation dans la console Next.js.
   */
  turbopack: {},

  /**
   * Surcharge de la configuration Webpack.
   * Résout les conflits liés à l'importation accidentelle de paquets Node.js natifs 
   * (comme fs, crypto, path) dans le bundle côté client (souvent requis par les SDKs d'IA).
   */
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    // Si la compilation cible le navigateur (client-side), on désactive les modules Node.js stricts
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        os: false,
        stream: false,
      };
    }
    return config;
  },
};

export default nextConfig;