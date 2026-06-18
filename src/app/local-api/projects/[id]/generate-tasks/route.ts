import { NextResponse } from "next/server";
import { Document, VectorStoreIndex, Settings } from "llamaindex";
import { MistralAI, MistralAIEmbedding } from "@llamaindex/mistral";

/**
 * Route POST : Génération de tâches assistée par IA (Pipeline RAG)
 * Utilise LlamaIndex pour indexer les tâches existantes du projet, 
 * chercher les plus pertinentes, et injecter ce contexte dans le prompt Mistral.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { userPrompt, projectTitle, projectDescription } = body;

    // Vérification de l'environnement d'exécution IA
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      console.error("Clé API Mistral manquante dans le fichier .env");
      return NextResponse.json({ success: false, error: "Configuration IA manquante" }, { status: 500 });
    }

    // Configuration globale du singleton LlamaIndex.TS
    // Surcharge des paramètres par défaut (OpenAI) pour forcer l'utilisation de Mistral
    // tant pour la complétion (LLM) que pour la vectorisation (Embedding).
    Settings.llm = new MistralAI({
      apiKey: apiKey,
      model: "mistral-small-latest",
    });
    Settings.embedModel = new MistralAIEmbedding({
      apiKey: apiKey,
    });

    // Extraction manuelle du token d'authentification depuis la requête entrante
    // Nécessaire car nous sommes dans un contexte Server-Side
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/abricot_token=([^;]+)/);
    const rawToken = tokenMatch ? tokenMatch[1] : "";
    const cleanToken = rawToken ? decodeURIComponent(rawToken).replace(/^"|"$/g, '') : "";

    // Proxy vers le backend Express pour récupérer l'état actuel du projet (Ground Truth)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let existingTasks: any[] = [];
    
    try {
      const tasksResponse = await fetch(`${backendUrl}/projects/${id}/tasks`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${cleanToken}`,
          "Content-Type": "application/json"
        }
      });

      if (tasksResponse.ok) {
        const json = await tasksResponse.json();
        // Normalisation de la structure de réponse du backend
        existingTasks = json.data?.tasks || json.data || json || [];
        if (!Array.isArray(existingTasks)) existingTasks = [];
      }
    } catch (fetchError) {
      console.error("Impossible de récupérer les tâches depuis Express:", fetchError);
      // Fallback silencieux : on continue la génération sans contexte métier (Zero-shot)
    }

    // Phase 1 (RAG) : Ingestion et création des objets Document LlamaIndex
    const documents = existingTasks.length > 0 
      ? existingTasks.map(task => new Document({ 
          text: `Titre: ${task.title}. Description: ${task.description || "Aucune"}. Statut: ${task.status}` 
        }))
      : [new Document({ text: "Il n'y a actuellement aucune tâche dans ce projet." })];

    // Phase 2 (RAG) : Indexation vectorielle en mémoire et recherche par similarité sémantique
    const index = await VectorStoreIndex.fromDocuments(documents);
    const retriever = index.asRetriever({ similarityTopK: 3 }); // Top-3 pour limiter la taille du contexte
    const relevantNodes = await retriever.retrieve(userPrompt);
    
    // Concaténation des extraits pertinents pour le prompt
    const contextStr = relevantNodes.map((node) => (node.node as any).text).join("\n\n");

    // Phase 3 (Prompt Engineering) : Construction du System Prompt avec contexte injecté
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
2. Tu dois renvoyer UNIQUEMENT un tableau JSON valide contenant des objets. Chaque objet doit avoir un 'title' (court et clair) et une 'description' (détaillant l'action à réaliser).
3. N'ajoute aucun texte avant ou après le JSON. N'utilise pas de formatage Markdown comme \`\`\`json. Renvoie juste le tableau brut.

Exemple attendu :
[
  { "title": "Créer la maquette", "description": "Concevoir les écrans principaux sur Figma" },
  { "title": "Développer l'API", "description": "Créer les routes POST et GET pour les utilisateurs" }
]`;

    // Phase 4 : Appel au LLM Mistral via le wrapper LlamaIndex
    const response = await Settings.llm.complete({ prompt: systemPrompt });
    let aiMessage = response.text;

    // Phase 5 : Nettoyage et résilience de parsing
    // Suppression des éventuels marqueurs markdown que le LLM pourrait forcer malgré les instructions
    aiMessage = aiMessage.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let generatedTasks = [];
    try {
      generatedTasks = JSON.parse(aiMessage);
      // Tolérance structurelle si l'IA wrappe le tableau dans un objet
      if (!Array.isArray(generatedTasks) && generatedTasks.tasks) {
        generatedTasks = generatedTasks.tasks;
      }
      if (!Array.isArray(generatedTasks) && generatedTasks.data) {
        generatedTasks = generatedTasks.data;
      }
    } catch (parseError) {
      console.error("Erreur de parsing du JSON renvoyé par Mistral:", aiMessage);
      return NextResponse.json({ success: false, error: "L'IA a renvoyé un format invalide." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: generatedTasks }, { status: 200 });

  } catch (error: any) {
    console.error("Erreur critique Route Assistant IA LlamaIndex:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}