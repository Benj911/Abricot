import { NextResponse } from "next/server";
import { Document, VectorStoreIndex, Settings } from "llamaindex";
import { MistralAI, MistralAIEmbedding } from "@llamaindex/mistral";

/**

 * Route POST : Génération de tâches assistée par IA (Pipeline RAG)

 * Utilise LlamaIndex pour indexer les tâches existantes du projet,

 * chercher les plus pertinentes, et injecter ce contexte dans le prompt Mistral.

 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userPrompt, projectTitle, projectDescription } = body;
    const urlObj = new URL(req.url);
    const parts = urlObj.pathname.split('/');
    const idIndex = parts.indexOf('projects') + 1;
    const id = parts[idIndex];

    if (!id) {
      return NextResponse.json({ success: false, error: "ID du projet introuvable." }, { status: 400 });
    }

     // Vérification de l'environnement d'exécution IA
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      console.error("Clé API Mistral manquante");
      return NextResponse.json({ success: false, error: "Configuration IA manquante" }, { status: 500 });
    }

     // Configuration globale du singleton LlamaIndex.TS
    Settings.llm = new MistralAI({ apiKey: apiKey, model: "mistral-small-latest" });
    Settings.embedModel = new MistralAIEmbedding({ apiKey: apiKey });

    let cleanToken = "";
    const authHeader = req.headers.get("authorization");
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      cleanToken = authHeader.substring(7);
    } else {
      // Fallback sur le cookie au cas où
      const cookieHeader = req.headers.get("cookie") || "";
      const tokenMatch = cookieHeader.match(/abricot_token=([^;]+)/);
      cleanToken = tokenMatch ? decodeURIComponent(tokenMatch[1]).replace(/^"|"$/g, '') : "";
    }

      // CORRECTION : Bloquer l'exécution immédiatement si le token est absent.
    if (!cleanToken) {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }

      // Proxy vers le backend Express pour récupérer l'état actuel du projet (Ground Truth)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let existingTasks: any[] = [];
    
    try {
      const tasksResponse = await fetch(`${backendUrl}/projects/${id}/tasks`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${cleanToken}`,
          "Content-Type": "application/json"
        },
        cache: "no-store" 
      });

      // CORRECTION : Sécuriser strictement la route IA.
      // Si le backend renvoie non-OK (ex: 403 Forbidden ou 401 Unauthorized),
      // on bloque immédiatement la génération IA pour ne pas contourner la sécurité.
      
      if (!tasksResponse.ok) {
        console.error(`Erreur Backend (Statut ${tasksResponse.status}) pour le projet ID: ${id}`);
        return NextResponse.json(
          { success: false, error: "Accès refusé ou projet inexistant." },
          { status: tasksResponse.status === 401 ? 401 : 403 }
        );
      }

      const json = await tasksResponse.json();
      existingTasks = json.data?.tasks || json.data || json || [];
      if (!Array.isArray(existingTasks)) existingTasks = [];
      
    } catch (fetchError) {
      console.error("Impossible de récupérer les tâches depuis Express:", fetchError);
      return NextResponse.json({ success: false, error: "Erreur de communication avec le serveur." }, { status: 500 });
    }

    // Phase 1 (RAG) : Ingestion et création des objets Document LlamaIndex
    const documents = existingTasks.length > 0 
      ? existingTasks.map(task => new Document({ 
          text: `Titre: ${task.title}. Description: ${task.description || "Aucune"}. Statut: ${task.status}` 
        }))
      : [new Document({ text: "Il n'y a actuellement aucune tâche dans ce projet." })];

    // Phase 2 (RAG) : Indexation vectorielle en mémoire et recherche par similarité sémantique
    const index = await VectorStoreIndex.fromDocuments(documents);
    const retriever = index.asRetriever({ similarityTopK: 3 }); 
    const relevantNodes = await retriever.retrieve(userPrompt);
    
    const contextStr = relevantNodes.map((node) => (node.node as any).text).join("\n\n");

    // Phase 3 (Prompt Engineering) : Construction du System Prompt avec contexte injecté
    // CORRECTION : Ajout de la consigne exigeant formellement les 3 clés.
    const systemPrompt = `Tu es un assistant chef de projet expert.
Ton rôle est de générer une liste de tâches pertinentes basées sur la demande de l'utilisateur, en tenant compte du contexte du projet.

CONTEXTE DU PROJET :
Titre: ${projectTitle || "Projet générique"}
Description: ${projectDescription || "Aucune description fournie"}

TÂCHES DÉJÀ EXISTANTES (Fournies par la recherche RAG, pour éviter les doublons) :
---
${contextStr}
---

DEMANDE DE L'UTILISATEUR :
"${userPrompt}"

CONSIGNE STRICTE :
1. Tu dois générer 3 TÂCHES MAXIMUM. Pas plus.
2. Tu dois renvoyer UNIQUEMENT un tableau JSON valide contenant des objets. 
3. Chaque objet DOIT OBLIGATOIREMENT contenir 3 clés : un 'title' (court et clair), une 'description' (détaillant l'action) et un 'status' (valeur "TODO" par défaut, ou "IN_PROGRESS" si pertinent).
4. N'ajoute aucun texte avant ou après le JSON. N'utilise pas de formatage Markdown comme \`\`\`json. Renvoie juste le tableau brut.

Exemple attendu :
[
  { "title": "Créer la maquette", "description": "Concevoir les écrans principaux sur Figma", "status": "TODO" },
  { "title": "Développer l'API", "description": "Créer les routes POST et GET pour les utilisateurs", "status": "TODO" }
]`;

    // Phase 4 : Appel au LLM Mistral via le wrapper LlamaIndex
    const response = await Settings.llm.complete({ prompt: systemPrompt });
    let aiMessage = response.text;

    // Phase 5 : Nettoyage et résilience de parsing
    aiMessage = aiMessage.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let generatedTasks = [];
    try {
      generatedTasks = JSON.parse(aiMessage);
      if (!Array.isArray(generatedTasks) && generatedTasks.tasks) {
        generatedTasks = generatedTasks.tasks;
      }
      if (!Array.isArray(generatedTasks) && generatedTasks.data) {
        generatedTasks = generatedTasks.data;
      }
      if (!Array.isArray(generatedTasks)) {
        generatedTasks = [];
      }
    } catch (parseError) {
      console.error("Erreur de parsing du JSON renvoyé par Mistral:", aiMessage);
      return NextResponse.json({ success: false, error: "L'IA a renvoyé un format invalide." }, { status: 500 });
    }

    // CORRECTION : Validation stricte SANS valeur par défaut (Fail Fast)
    // On vérifie que TOUTES les tâches renvoyées ont bien les 3 champs obligatoires remplis.
    const hasInvalidTasks = generatedTasks.some((t: any) => 
      !t || 
      typeof t.title !== "string" || t.title.trim() === "" ||
      typeof t.description !== "string" || t.description.trim() === "" ||
      typeof t.status !== "string" || t.status.trim() === ""
    );

    // Si l'IA a oublié un seul champ ou n'a rien généré, on déclenche une erreur
    if (hasInvalidTasks || generatedTasks.length === 0) {
      return NextResponse.json(
        { success: false, error: "L'IA n'a pas respecté le format demandé (titre, description ou statut manquant). Veuillez recommencer." }, 
        { status: 400 }
      );
    }

    // CORRECTION : Si tout est parfait, on nettoie les doublons et on coupe à 3 tâches maximum
    const validatedTasks = generatedTasks
      .filter((value: any, index: number, self: any[]) => 
        index === self.findIndex((t) => t.title.toLowerCase().trim() === value.title.toLowerCase().trim())
      )
      .slice(0, 3)
      .map((t: any) => ({
        title: t.title.trim(),
        description: t.description.trim(),
        status: t.status.trim()
      }));

    return NextResponse.json({ success: true, data: validatedTasks }, { status: 200 });

  } catch (error: any) {
    console.error("Erreur critique Route Assistant IA LlamaIndex:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}