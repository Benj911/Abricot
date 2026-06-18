import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware global de Next.js (S'exécute à la volée avant le traitement de chaque requête correspondante).
 * Gère le contrôle d'accès (Gatekeeping) en fonction de la présence du token de session.
 */
export function middleware(request: NextRequest) {
  // Extraction du token d'authentification depuis les cookies de la requête entrante
  const token = request.cookies.get("abricot_token")?.value;
  const { pathname } = request.nextUrl;

  // 1. Redirection de confort : Un utilisateur déjà authentifié est redirigé vers son espace s'il tente d'aller sur /login
  if (token && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 2. Protection des routes privées : Définition du périmètre nécessitant une session active
  const isPrivatePage = pathname.startsWith("/dashboard") || pathname.startsWith("/projects") || pathname.startsWith("/profile");
  
  // Si la page est privée et qu'aucun token n'est trouvé, on rejette l'accès et on force la connexion
  if (!token && isPrivatePage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Par défaut, la requête continue son cycle de vie normal si aucune règle de blocage n'est déclenchée
  return NextResponse.next();
}

/**
 * Configuration du matcher pour optimiser les performances du serveur.
 * Le middleware ne s'exécutera que sur ces chemins spécifiques, évitant ainsi de
 * surcharger le serveur lors du chargement des assets statiques (images, CSS, JS, etc.).
 */
export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/profile/:path*", "/login"],
};