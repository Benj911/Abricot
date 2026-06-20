"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Loader2, X, Calendar as CalendarIcon, ChevronDown, ChevronUp, MoreHorizontal, Search, Send, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Cookies from "js-cookie";

interface Project {
  id: string;
  name: string; 
  title?: string;
  description: string;
  owner?: any;
  members?: any[]; 
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author?: {
    name?: string;
    username?: string;
    email: string;
  };
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  dueDate?: string;
  assignees?: any[];
  comments?: Comment[];
}

interface IATask {
  title: string;
  description: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "CONTRIBUTOR";
}

interface UserSuggestion {
  id: string;
  name: string;
  email: string;
}

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Email de l'utilisateur courant pour la vérification des autorisations (RBAC)
  const [userEmail, setUserEmail] = useState("");

  // Détermine si l'utilisateur possède les droits d'administration sur le projet
// CORRECTION : Détermination des droits basée sur les rôles renvoyés par l'API
  const [currentUserRole, setCurrentUserRole] = useState<"OWNER" | "ADMIN" | "CONTRIBUTOR" | null>(null);
  
  // Pour la suppression stricte (exigée par le backend)
  const isTrueOwner = currentUserRole === "OWNER" || project?.owner?.email?.toLowerCase() === userEmail?.toLowerCase();
  
  // Pour la modification (exigée par les specs du jury)
  const isAdmin = currentUserRole === "ADMIN" || isTrueOwner;

  const [assignableUsers, setAssignableUsers] = useState<UserInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"liste" | "calendrier">("liste");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // --- États : Modale d'édition du projet ---
  const [showEditProjectModale, setShowEditProjectModale] = useState(false);
  const [editProjectTitle, setEditProjectTitle] = useState("");
  const [editProjectDescription, setEditProjectDescription] = useState("");
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  
  // Gestion dynamique des contributeurs lors de la modification
  const [editContributorInput, setEditContributorInput] = useState("");
  const [editSelectedContributors, setEditSelectedContributors] = useState<UserSuggestion[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // --- États : Modale de création manuelle de tâche ---
  const [showManualModale, setShowManualModale] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualDueDate, setManualDueDate] = useState("");
  const [manualStatus, setManualStatus] = useState("TODO"); 
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]); 
  const [isCreatingManual, setIsCreatingManual] = useState(false);

  // --- États : Modale de modification de tâche ---
  const [showEditModale, setShowEditModale] = useState(false);
  const [taskToEditId, setTaskToEditId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskStatus, setEditTaskStatus] = useState("TODO");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editSelectedCollaborators, setEditSelectedCollaborators] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // --- États : Interface utilisateur (Dropdowns, Commentaires) ---
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [isPostingComment, setIsPostingComment] = useState<string | null>(null);

  // --- États : Intégration IA (Génération de tâches via Mistral/LlamaIndex) ---
  const [showIAModale, setShowIAModale] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<IATask[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const getStatusLabel = (status: string) => {
    const s = status?.toUpperCase() || "TODO";
    if (s === "IN_PROGRESS" || s === "PROGRESS") return "En cours";
    if (s === "DONE") return "Terminée";
    return "À faire";
  };

  const getStatusClasses = (status: string) => {
    const s = status?.toUpperCase() || "TODO";
    const base = "h-[25px] rounded-[50px] flex items-center justify-center font-sans font-normal text-[14px] leading-none whitespace-nowrap px-2";
    
    // CORRECTION WAVE : Textes assombris
    if (s === "DONE") return `${base} w-[94px] bg-[#F1FFF7] text-[#15803D]`;
    if (s === "IN_PROGRESS" || s === "PROGRESS") return `${base} w-[90px] bg-[#FFF0D7] text-[#92400E]`;
    return `${base} w-[75px] bg-[#FFE0E0] text-[#B91C1C]`;
  };

  const getInitials = (name: string, email: string) => {
    const activeName = name || email || "";
    if (!activeName) return "?";
    if (activeName.includes("@")) return activeName.substring(0, 2).toUpperCase();
    const parts = activeName.trim().split(/\s+/);
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return activeName.substring(0, 2).toUpperCase();
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Aucune échéance";
    return new Date(isoString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  /**
   * Récupère les détails du projet et consolide la liste de l'équipe (Owner + Contributeurs).
   * L'équipe est dédupliquée côté client basée sur l'email pour éviter les doublons d'UI.
   */
  const fetchProjectDetailsAndMembers = async (cleanToken: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        const resJson = await response.json();
        const proj = resJson.data?.project || resJson.project || resJson.data || resJson;
        
        setProject({
          id: id as string,
          name: proj.name || proj.title || "Projet sans titre",
          description: proj.description || "",
          owner: proj.owner,
          members: proj.members || []
        });

        const teamList: UserInfo[] = [];
        
        if (proj.owner) {
          const oId = proj.owner.id || "owner-id";
          const oEmail = proj.owner.email || (typeof proj.owner === 'string' ? proj.owner : "");
          const oName = proj.owner.name || proj.owner.username || oEmail.split("@")[0] || "Propriétaire";
          teamList.push({ id: oId, name: oName, email: oEmail, role: "OWNER" });
          
          // CORRECTION : Si c'est moi le propriétaire, j'enregistre mon rôle
          if (oEmail.toLowerCase() === userEmail.toLowerCase()) {
            setCurrentUserRole("OWNER");
          }
        }

        const rawMembers = proj.members || proj.contributors || [];
        if (Array.isArray(rawMembers)) {
          rawMembers.forEach((m: any) => {
            const userData = m.user ? m.user : m;
            // On récupère le rôle renvoyé par l'API (s'il y en a un)
            const apiRole = m.role || "CONTRIBUTOR"; 
            
            if (userData) {
              const uId = userData.id || userData._id;
              const uEmail = userData.email || "";
              const uName = userData.name || userData.username || uEmail.split("@")[0] || "Collaborateur";
              
              // Enregistrement du rôle si c'est moi
              if (uEmail.toLowerCase() === userEmail.toLowerCase()) {
                setCurrentUserRole(apiRole);
              }

              // CORRECTION : On rajoute bien les contributeurs dans l'équipe pour l'affichage !
              if (uEmail && !teamList.some(t => t.email.toLowerCase() === uEmail.toLowerCase())) {
                teamList.push({ id: uId, name: uName, email: uEmail, role: "CONTRIBUTOR" });
              }
            }
          });
        }
        setAssignableUsers(teamList);
      }
    } catch (error) {
      console.error("Erreur chargement équipe:", error);
    }
  };

  const fetchTasks = async (cleanToken: string) => {
    try {
      const response = await fetch(`/api/projects/${id}/tasks`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" }
      });
      if (response.ok) {
        const resJson = await response.json();
        const tasksArray = resJson.data?.tasks || resJson.data || resJson || [];
        setTasks(Array.isArray(tasksArray) ? tasksArray : []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Chargement initial des données en parallèle (Profil, Projet, Tâches)
  useEffect(() => {
    const token = Cookies.get("abricot_token");
    if (!token || !id) {
      setIsLoading(false);
      return;
    }
    const cleanToken = decodeURIComponent(token).replace(/^"|"$/g, '');

    fetch("/api/auth/profile", { headers: { "Authorization": `Bearer ${cleanToken}` } })
      .then(r => r.json())
      .then(d => {
        const mail = d.data?.user?.email || d.user?.email || "";
        setUserEmail(mail);
      }).catch(e => console.error(e));

    Promise.all([
      fetchProjectDetailsAndMembers(cleanToken),
      fetchTasks(cleanToken)
    ]).finally(() => setIsLoading(false));
  }, [id]);

  const handleSearchEditUsers = async (text: string) => {
    setEditContributorInput(text);
    if (text.trim().length < 2) {
      setUserSuggestions([]);
      return;
    }
    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    setIsSearchingUsers(true);
    try {
      const res = await fetch(`/api/users/search?query=${encodeURIComponent(text)}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${cleanToken}` }
      });
      if (res.ok) {
        const json = await res.json();
        const arr = json.data?.users || json.users || json.data || [];
        if (Array.isArray(arr)) {
          setUserSuggestions(arr.filter(u => !editSelectedContributors.some(s => s.email === u.email)));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const openEditProjectModale = () => {
    setEditProjectTitle(project?.name || project?.title || "");
    setEditProjectDescription(project?.description || "");
    const currentContribs = assignableUsers
      .filter(u => u.role === "CONTRIBUTOR")
      .map(u => ({ id: u.id, name: u.name, email: u.email }));
    setEditSelectedContributors(currentContribs);
    setShowEditProjectModale(true);
  };

  /**
   * Sauvegarde les modifications du projet.
   * Procède à un delta (ajouts/suppressions) pour mettre à jour la liste des contributeurs via l'API.
   */
  const handleUpdateProject = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    setIsUpdatingProject(true);
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: editProjectTitle, description: editProjectDescription })
      });
      
      if (response.ok) {
        const originalContribs = assignableUsers.filter(u => u.role === "CONTRIBUTOR");
        const added = editSelectedContributors.filter(nc => !originalContribs.some(oc => oc.email === nc.email));
        const removed = originalContribs.filter(oc => !editSelectedContributors.some(nc => nc.email === oc.email));

        for (const u of added) {
          await fetch(`/api/projects/${id}/contributors`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email: u.email, role: "CONTRIBUTOR" })
          });
        }
        for (const u of removed) {
          await fetch(`/api/projects/${id}/contributors/${u.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${cleanToken}` }
          });
        }

        setShowEditProjectModale(false);
        fetchProjectDetailsAndMembers(cleanToken);
      }
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsUpdatingProject(false); 
    }
  };

  const handleCreateManualTask = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    setIsCreatingManual(true);
    try {
      const payload = {
        title: manualTitle,
        description: manualDescription,
        // On enlève "status" d'ici car le backend ne le lit pas à la création
        priority: calculatePriority(manualDueDate),                     
        projectId: id,                       
        dueDate: manualDueDate ? new Date(manualDueDate).toISOString() : null,
        userIds: selectedCollaborators,
        assigneeIds: selectedCollaborators,
        assignees: selectedCollaborators.map(userId => ({ userId }))
      };

      // 1. Création de la tâche (le backend va forcer TODO)
      const response = await fetch(`/api/projects/${id}/tasks`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const jsonResponse = await response.json();
        // Le backend renvoie la tâche créée dans jsonResponse.data.task (ou équivalent)
        const createdTaskId = jsonResponse.data?.task?.id || jsonResponse.task?.id || jsonResponse?.id;

        // 2. CORRECTION/RUSE : Si l'utilisateur voulait un autre statut que TODO, 
        // on lance immédiatement une mise à jour silencieuse pour forcer le statut.
        if (createdTaskId && manualStatus !== "TODO") {
          await fetch(`/api/projects/${id}/tasks/${createdTaskId}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: manualStatus })
          });
        }

        setShowManualModale(false);
        setManualTitle("");
        setManualDescription("");
        setManualDueDate("");
        setSelectedCollaborators([]);
        setManualStatus("TODO");
        fetchTasks(cleanToken);
      }
    } catch (e) { console.error(e); } finally { setIsCreatingManual(false); }
  };

  // Nouvelle fonction pour calculer la priorité automatiquement
  const calculatePriority = (dateString?: string | null) => {
    if (!dateString) return "LOW"; // Si pas de date, on met en priorité basse
    
    const today = new Date();
    const dueDate = new Date(dateString);
    
    // Calcul de la différence en jours
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return "HIGH";
    if (diffDays <= 30) return "MEDIUM";
    return "LOW";
  };

  const openEditTaskModale = (task: Task) => {
    setTaskToEditId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description);
    setEditTaskStatus(task.status?.toUpperCase() || "TODO");
    setEditTaskDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    const currentAssigneeIds = task.assignees?.map(a => a.user?.id || a.userId).filter(Boolean) || [];
    setEditSelectedCollaborators(currentAssigneeIds);
    setActiveDropdown(null);
    setShowEditModale(true);
  };

  const handleUpdateTask = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!taskToEditId || !editTaskTitle.trim()) return;

    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    setIsUpdating(true);
    try {
      const payload = { 
        title: editTaskTitle, 
        description: editTaskDescription, 
        status: editTaskStatus,
        priority: calculatePriority(editTaskDueDate), 
        dueDate: editTaskDueDate ? new Date(editTaskDueDate).toISOString() : null,
        userIds: editSelectedCollaborators,
        assigneeIds: editSelectedCollaborators,
        assignees: editSelectedCollaborators.map(userId => ({ userId }))
      };

      const response = await fetch(`/api/projects/${id}/tasks/${taskToEditId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowEditModale(false);
        fetchTasks(cleanToken);
      }
    } catch (e) { console.error(e); } finally { setIsUpdating(false); }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Voulez-vous supprimer cette tâche ?")) return;
    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    try {
      const response = await fetch(`/api/projects/${id}/tasks/${taskId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${cleanToken}` } });
      if (response.ok) fetchTasks(cleanToken);
    } catch (e) { console.error(e); }
  };

  const toggleComments = (taskId: string) => {
    setExpandedComments(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleAddComment = async (taskId: string) => {
    const content = newCommentContent[taskId];
    if (!content?.trim()) return;

    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    setIsPostingComment(taskId);
    try {
      const response = await fetch(`/api/projects/${id}/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        setNewCommentContent(prev => ({ ...prev, [taskId]: "" }));
        fetchTasks(cleanToken); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPostingComment(null);
    }
  };

  /**
   * Envoi du prompt à l'API locale Next.js qui agit comme interface avec Mistral (via LlamaIndex).
   * Récupère un tableau JSON de tâches pertinentes.
   */
  const handleSendPromptToIA = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isGenerating) return;

    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    setIsGenerating(true);
    try {
      const response = await fetch(`/local-api/projects/${id}/generate-tasks`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanToken}` 
        },
        body: JSON.stringify({ 
          userPrompt: userPrompt,
          projectTitle: project?.name || project?.title || "Projet",
          projectDescription: project?.description || ""
        })
      });

      const result = await response.json();
      if (result.data && Array.isArray(result.data)) {
        setGeneratedTasks((prev) => [...prev, ...result.data]);
        setUserPrompt(""); 
      }
    } catch (error) {
      console.error("Erreur de génération IA:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveSuggestedTask = (indexToRemove: number) => {
    setGeneratedTasks((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (editingIndex === indexToRemove) setEditingIndex(null);
  };

  const startEditingTask = (index: number, task: IATask) => {
    setEditingIndex(index);
    setEditTitle(task.title);
    setEditDescription(task.description);
  };

  const saveEditedTask = (indexToSave: number) => {
    setGeneratedTasks((prev) =>
      prev.map((task, idx) =>
        idx === indexToSave ? { ...task, title: editTitle, description: editDescription } : task
      )
    );
    setEditingIndex(null);
  };

  // Traite en parallèle la création de toutes les tâches validées par l'utilisateur
  const handleAcceptIATasks = async () => {
    const token = Cookies.get("abricot_token");
    if (!token) return;
    const cleanToken = decodeURIComponent(token).replace(/^"|"$/g, '');

    try {
      const promises = generatedTasks.map((task) =>
        fetch(`/api/projects/${id}/tasks`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ 
            title: task.title, 
            description: task.description, 
            status: "TODO", 
            priority: "LOW",
            projectId: id 
          })
        })
      );
      await Promise.all(promises);
      setShowIAModale(false);
      setGeneratedTasks([]);
      fetchTasks(cleanToken);
    } catch (error) {
      console.error(error);
    }
  };

  const sortedAndFilteredTasks = [...tasks]
    .filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status?.toUpperCase() === statusFilter.toUpperCase();
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  if (isLoading) return <div className="p-8 text-xs text-gray-500 flex justify-center items-center gap-2 min-h-[50vh]" role="status" aria-live="polite"><Loader2 className="w-4 h-4 animate-spin text-[#D3590B]" aria-hidden="true" /> Chargement du projet...</div>;
  
  // CORRECTION : Fonction de suppression de projet
  const handleDeleteProject = async () => {
    if (!confirm("Attention, cette action est irréversible. Voulez-vous vraiment supprimer ce projet ?")) return;
    
    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${cleanToken}` }
      });

      if (response.ok) {
        // Redirection vers le dashboard après suppression
        window.location.href = "/projects";
      } else {
        alert("Erreur lors de la suppression du projet. Vous n'avez peut-être pas les droits requis.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 max-w-[1215px] mx-auto pb-20">
      
      {/* HEADER PROJET */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <Link href="/projects" aria-label="Retour à la liste des projets" className="w-[57px] h-[57px] flex items-center justify-center bg-white border border-gray-200 rounded-[10px] text-gray-700 hover:border-[#D3590B] hover:text-[#D3590B] transition-colors shadow-sm shrink-0 cursor-pointer">
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-heading font-semibold text-[24px] text-gray-900">{project?.name || project?.title}</h1>
              {/* Seul le propriétaire peut modifier les informations et l'équipe du projet */}
              {/* CORRECTION : L'édition est autorisée pour les ADMINS */}
              {isAdmin && (
                <button onClick={openEditProjectModale} aria-label="Modifier les paramètres du projet" className="font-sans font-normal text-[14px] text-[#B24B0A] hover:text-orange-700 hover:underline transition-all cursor-pointer">
                  Modifier
                </button>
              )}
              {/* CORRECTION : La suppression est autorisée pour le propriétaire (Owner) */}
              {isTrueOwner && (
                <button onClick={handleDeleteProject} aria-label="Supprimer le projet" className="font-sans font-normal text-[14px] text-red-600 hover:text-red-800 hover:underline transition-all cursor-pointer border-l border-gray-300 pl-3">
                  Supprimer
                </button>
              )}
            </div>
            <p className="font-sans font-normal text-[16px] text-[#6B7280] max-w-2xl">{project?.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setShowManualModale(true)} aria-haspopup="dialog" className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-[181px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
            Créer une tâche
          </button>
          
          {/* CORRECTION WAVE : Contraste ajusté (#B24B0A) & (#C2510A) */}
          <button onClick={() => setShowIAModale(true)} aria-haspopup="dialog" className="bg-[#C2510A] text-white hover:bg-[#FFE8D9] hover:text-[#B24B0A] w-[121px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
            <Sparkles className="w-4 h-4" aria-hidden="true" /> IA
          </button>
        </div>
      </div>

      {/* BANDEAU CONTRIBUTEURS */}
      <div className="bg-[#F3F4F6] rounded-[10px] p-5 flex items-center justify-between shadow-sm">
        {/* CORRECTION WAVE : Contraste ajusté (#686F7D) */}
        <div className="font-heading font-semibold text-[18px] text-gray-900">
          Contributeurs <span className="font-sans font-normal text-[16px] text-[#686F7D] ml-2">{assignableUsers.length} personnes</span>
        </div>
        {/* CORRECTION WAVE : Contraste ajusté*/}
        <div className="flex items-center gap-4 flex-wrap">
          {assignableUsers.map(user => {
            const isMe = user.email?.toLowerCase() === userEmail?.toLowerCase();
            const bubbleStyle = isMe ? "bg-[#FFE8D9]" : "bg-[#E5E7EB]";
            const textBubble = isMe ? "text-[#B24B0A]" : "text-[#616875]";
            const isOwnerCheck = user.role === "OWNER";
            const roleOrName = isOwnerCheck ? "Propriétaire" : (user.name || user.email.split("@")[0]);

            return (
              <div key={user.id} className="flex items-center gap-2">
                <div aria-hidden="true" className={`h-7 w-7 rounded-full font-sans font-medium text-[10px] text-black flex items-center justify-center uppercase shadow-sm ${bubbleStyle}`}>
                  {getInitials(user.name, user.email)}
                </div>
                <span className={`px-4 h-[25px] flex items-center justify-center rounded-[50px] font-sans font-normal text-[14px] max-[600px]:hidden ${bubbleStyle} ${textBubble}`}>
                  {roleOrName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* EN-TÊTE DES TÂCHES */}
      <div className="bg-white border border-gray-100 rounded-[10px] p-6 shadow-sm mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-heading font-semibold text-[18px] text-gray-900">Tâches du projet ({tasks.length})</h2>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2" role="tablist" aria-label="Mode d'affichage des tâches">
              {/* CORRECTION WAVE : Contraste ajusté (#B24B0A) */}
              <button role="tab" aria-selected={viewMode === "liste"} onClick={() => setViewMode("liste")} className={`flex items-center justify-center gap-1.5 px-4 h-[45px] rounded-[8px] font-sans font-normal text-[14px] transition-colors border-none cursor-pointer ${viewMode === "liste" ? "bg-[#FFE8D9] text-[#B24B0A]" : "bg-white text-[#6B7280] hover:bg-gray-50"}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M15.1111 7.82222C14.5778 7.82222 14.2222 8.17778 14.2222 8.71111V13.6889C14.2222 13.9556 13.9556 14.2222 13.6889 14.2222H2.31111C2.04444 14.2222 1.77778 13.9556 1.77778 13.6889V2.31111C1.77778 2.04444 2.04444 1.77778 2.31111 1.77778H10.8444C11.3778 1.77778 11.7333 1.42222 11.7333 0.888889C11.7333 0.355556 11.3778 0 10.8444 0H2.31111C1.06667 0 0 1.06667 0 2.31111V13.6889C0 14.9333 1.06667 16 2.31111 16H13.6889C14.9333 16 16 14.9333 16 13.6889V8.71111C16 8.26667 15.6444 7.82222 15.1111 7.82222Z" fill="currentColor"/>
                  <path d="M6.84435 7.1111C6.48879 6.75555 5.95546 6.84443 5.5999 7.19999C5.33324 7.46666 5.33324 7.99999 5.5999 8.35555L7.55546 10.4C7.73324 10.5778 7.91101 10.6667 8.17768 10.6667C8.44435 10.6667 8.62212 10.5778 8.7999 10.4L14.8443 4.17777C15.1999 3.82221 15.1999 3.28888 14.8443 2.93332C14.4888 2.57777 13.9555 2.57777 13.5999 2.93332L8.17768 8.53332L6.84435 7.1111Z" fill="currentColor"/>
                </svg>
                Liste
              </button>
              {/* CORRECTION WAVE : Contraste ajusté (#B24B0A) */}
              <button role="tab" aria-selected={viewMode === "calendrier"} onClick={() => setViewMode("calendrier")} className={`flex items-center justify-center gap-1.5 px-4 h-[45px] rounded-[8px] font-sans font-normal text-[14px] transition-colors border-none cursor-pointer ${viewMode === "calendrier" ? "bg-[#FFE8D9] text-[#B24B0A]" : "bg-white text-[#6B7280] hover:bg-gray-50"}`}>
                <svg width="15" height="17" viewBox="0 0 15 17" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" aria-hidden="true">
                  <path d="M4.42285 0C4.10746 0 3.8457 0.261761 3.8457 0.577148V1.17871C1.39505 1.38897 0 2.96789 0 5.57715V12.1152C0 14.9229 1.61522 16.538 4.42285 16.5381H10.5771C13.3847 16.538 15 14.9229 15 12.1152V5.57715C15 2.96794 13.6049 1.38901 11.1543 1.17871V0.577148C11.1543 0.261782 10.8925 3.47543e-05 10.5771 0C10.2618 0 10 0.261761 10 0.577148V1.15332H5V0.577148C5 0.261793 4.7382 5.25452e-05 4.42285 0ZM13.8457 12.1152C13.8457 14.3152 12.777 15.3847 10.5771 15.3848H4.42285C2.22293 15.3847 1.15332 14.3152 1.15332 12.1152V6.60742H13.8457V12.1152ZM10.4844 11.4082C10.1998 11.2852 9.86186 11.3541 9.64648 11.5693C9.61572 11.6078 9.57679 11.6461 9.55371 11.6846C9.52294 11.7307 9.49976 11.7771 9.48438 11.8232C9.46134 11.8693 9.44616 11.9159 9.43848 11.9697C9.43082 12.0157 9.42288 12.0693 9.42285 12.1152C9.42285 12.3152 9.50802 12.516 9.64648 12.6621C9.7926 12.8003 9.99256 12.8848 10.1924 12.8848C10.2923 12.8848 10.3922 12.8616 10.4844 12.8232C10.5765 12.7848 10.6615 12.7312 10.7383 12.6621C10.8075 12.5852 10.8619 12.5081 10.9004 12.4082C10.9389 12.3159 10.9619 12.2152 10.9619 12.1152C10.9618 11.9153 10.8767 11.7154 10.7383 11.5693C10.6614 11.5001 10.5766 11.4466 10.4844 11.4082ZM10.0381 8.66895C9.99208 8.67665 9.94639 8.69283 9.90039 8.71582C9.85434 8.73117 9.80777 8.75352 9.76172 8.78418C9.72332 8.8149 9.68489 8.84623 9.64648 8.87695C9.61572 8.9154 9.57679 8.95374 9.55371 8.99219C9.52294 9.03834 9.49976 9.08471 9.48438 9.13086C9.46134 9.17696 9.44616 9.22343 9.43848 9.26953C9.43081 9.32318 9.42288 9.3692 9.42285 9.42285C9.42285 9.62285 9.50802 9.82357 9.64648 9.96973C9.7926 10.108 9.99256 10.1924 10.1924 10.1924C10.2923 10.1924 10.3922 10.1693 10.4844 10.1309C10.5765 10.0925 10.6614 10.0388 10.7383 9.96973C10.8075 9.89286 10.8619 9.80804 10.9004 9.71582C10.9389 9.62351 10.9619 9.52285 10.9619 9.42285C10.9618 9.22293 10.8767 9.02305 10.7383 8.87695C10.6614 8.80777 10.5766 8.75426 10.4844 8.71582C10.3459 8.65431 10.1919 8.63818 10.0381 8.66895ZM8.0459 8.87695C7.83052 8.66172 7.48485 8.59282 7.20801 8.71582C7.10806 8.75426 7.03098 8.80778 6.9541 8.87695C6.8157 9.02304 6.73055 9.22294 6.73047 9.42285C6.73047 9.4767 6.7384 9.5233 6.74609 9.57715C6.75379 9.62325 6.76894 9.66972 6.79199 9.71582C6.80733 9.76177 6.83074 9.80757 6.86133 9.85352C6.8921 9.89198 6.92333 9.93126 6.9541 9.96973C7.03091 10.0388 7.10815 10.0925 7.20801 10.1309C7.30023 10.1693 7.4001 10.1924 7.5 10.1924C7.69983 10.1924 7.89978 10.108 8.0459 9.96973C8.07667 9.93126 8.1079 9.89198 8.13867 9.85352C8.16927 9.80756 8.19266 9.76177 8.20801 9.71582C8.23106 9.66972 8.2462 9.62325 8.25391 9.57715C8.2616 9.5233 8.26953 9.4767 8.26953 9.42285C8.26949 9.32299 8.2464 9.22305 8.20801 9.13086C8.16955 9.03855 8.11513 8.95388 8.0459 8.87695ZM10 2.88477C10.0001 3.20009 10.2618 3.46191 10.5771 3.46191C10.8925 3.46188 11.1542 3.20007 11.1543 2.88477V2.33789C12.9266 2.51306 13.806 3.53533 13.8418 5.4541H1.15723C1.193 3.53528 2.07336 2.51303 3.8457 2.33789V2.88477C3.84578 3.20009 4.10751 3.46191 4.42285 3.46191C4.73815 3.46186 4.99992 3.20006 5 2.88477V2.30762H10V2.88477Z" fill="currentColor"/>
                </svg>
                Calendrier
              </button>
            </div>
            <div className="relative">
              <select id="statusFilter" aria-label="Filtrer par statut" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none bg-white border border-gray-200 text-[#6B7280] font-sans font-normal text-[14px] h-[63px] px-5 pr-10 rounded-[10px] outline-none cursor-pointer focus:border-[#D3590B]">
                <option value="all">Statut</option>
                <option value="TODO">À faire</option>
                <option value="IN_PROGRESS">En cours</option>
                <option value="DONE">Terminée</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            </div>
            <div className="relative w-full md:w-64">
              <input type="text" aria-label="Rechercher une tâche" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher une tâche" className="w-full bg-white border border-gray-200 text-gray-700 font-sans font-normal text-[14px] h-[63px] px-5 pl-4 pr-10 rounded-[10px] outline-none focus:border-[#D3590B] transition-colors" />
              <Search className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* LISTE DES TÂCHES */}
        {sortedAndFilteredTasks.length === 0 ? (
          <div className="text-center py-12 font-sans font-normal text-[14px] text-gray-400 border-t border-dashed border-gray-100" aria-live="polite">Aucune tâche trouvée.</div>
        ) : (
          <div className="space-y-4">
            {sortedAndFilteredTasks.map((task) => {
              const assignees = task.assignees || [];
              const isCommentsOpen = expandedComments[task.id];
              const taskComments = task.comments || [];

              return (
                <div key={task.id} className="border border-gray-100 rounded-[10px] bg-white shadow-xs hover:border-gray-200 transition-colors relative">
                  
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="font-heading font-semibold text-[18px] text-gray-900 line-clamp-1" title={task.title}>{task.title}</h3>
                        <span className={getStatusClasses(task.status)}>
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      
                      <div className="relative shrink-0">
                        <button 
                          onClick={() => setActiveDropdown(activeDropdown === task.id ? null : task.id)} 
                          aria-haspopup="menu"
                          aria-expanded={activeDropdown === task.id}
                          aria-label="Options de la tâche"
                          className="w-[57px] h-[57px] flex items-center justify-center border border-gray-200 rounded-[10px] text-gray-400 hover:border-[#D3590B] hover:text-[#D3590B] transition-colors cursor-pointer" 
                        >
                          <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
                        </button>
                        {activeDropdown === task.id && (
                          <div role="menu" className="absolute right-0 top-full mt-1 bg-white border border-gray-100 shadow-lg rounded-[10px] py-1 w-32 z-10 font-sans font-normal text-[14px]">
                            <button role="menuitem" onClick={() => openEditTaskModale(task)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2 cursor-pointer"><Edit3 className="w-3 h-3" aria-hidden="true" /> Modifier</button>
                            <button role="menuitem" onClick={() => handleDeleteTask(task.id)} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"><Trash2 className="w-3 h-3" aria-hidden="true" /> Supprimer</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="font-sans font-normal text-[14px] text-[#6B7280] leading-relaxed mb-4">{task.description || "Aucune description."}</p>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 font-sans font-normal text-[12px]">
                        <span className="text-[#6B7280]">Échéance :</span>
                        <span className="text-[#1F1F1F] flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-[#6B7280]" viewBox="0 0 15 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M4.42285 0C4.10746 0 3.8457 0.261761 3.8457 0.577148V1.17871C1.39505 1.38897 0 2.96789 0 5.57715V12.1152C0 14.9229 1.61522 16.538 4.42285 16.5381H10.5771C13.3847 16.538 15 14.9229 15 12.1152V5.57715C15 2.96794 13.6049 1.38901 11.1543 1.17871V0.577148C11.1543 0.261782 10.8925 3.47543e-05 10.5771 0C10.2618 0 10 0.261761 10 0.577148V1.15332H5V0.577148C5 0.261793 4.7382 5.25452e-05 4.42285 0ZM13.8457 12.1152C13.8457 14.3152 12.777 15.3847 10.5771 15.3848H4.42285C2.22293 15.3847 1.15332 14.3152 1.15332 12.1152V6.60742H13.8457V12.1152ZM10.4844 11.4082C10.1998 11.2852 9.86186 11.3541 9.64648 11.5693C9.61572 11.6078 9.57679 11.6461 9.55371 11.6846C9.52294 11.7307 9.49976 11.7771 9.48438 11.8232C9.46134 11.8693 9.44616 11.9159 9.43848 11.9697C9.43082 12.0157 9.42288 12.0693 9.42285 12.1152C9.42285 12.3152 9.50802 12.516 9.64648 12.6621C9.7926 12.8003 9.99256 12.8848 10.1924 12.8848C10.2923 12.8848 10.3922 12.8616 10.4844 12.8232C10.5765 12.7848 10.6615 12.7312 10.7383 12.6621C10.8075 12.5852 10.8619 12.5081 10.9004 12.4082C10.9389 12.3159 10.9619 12.2152 10.9619 12.1152C10.9618 11.9153 10.8767 11.7154 10.7383 11.5693C10.6614 11.5001 10.5766 11.4466 10.4844 11.4082ZM10.0381 8.66895C9.99208 8.67665 9.94639 8.69283 9.90039 8.71582C9.85434 8.73117 9.80777 8.75352 9.76172 8.78418C9.72332 8.8149 9.68489 8.84623 9.64648 8.87695C9.61572 8.9154 9.57679 8.95374 9.55371 8.99219C9.52294 9.03834 9.49976 9.08471 9.48438 9.13086C9.46134 9.17696 9.44616 9.22343 9.43848 9.26953C9.43081 9.32318 9.42288 9.3692 9.42285 9.42285C9.42285 9.62285 9.50802 9.82357 9.64648 9.96973C9.7926 10.108 9.99256 10.1924 10.1924 10.1924C10.2923 10.1924 10.3922 10.1693 10.4844 10.1309C10.5765 10.0925 10.6614 10.0388 10.7383 9.96973C10.8075 9.89286 10.8619 9.80804 10.9004 9.71582C10.9389 9.62351 10.9619 9.52285 10.9619 9.42285C10.9618 9.22293 10.8767 9.02305 10.7383 8.87695C10.6614 8.80777 10.5766 8.75426 10.4844 8.71582C10.3459 8.65431 10.1919 8.63818 10.0381 8.66895ZM8.0459 8.87695C7.83052 8.66172 7.48485 8.59282 7.20801 8.71582C7.10806 8.75426 7.03098 8.80778 6.9541 8.87695C6.8157 9.02304 6.73055 9.22294 6.73047 9.42285C6.73047 9.4767 6.7384 9.5233 6.74609 9.57715C6.75379 9.62325 6.76894 9.66972 6.79199 9.71582C6.80733 9.76177 6.83074 9.80757 6.86133 9.85352C6.8921 9.89198 6.92333 9.93126 6.9541 9.96973C7.03091 10.0388 7.10815 10.0925 7.20801 10.1309C7.30023 10.1693 7.4001 10.1924 7.5 10.1924C7.69983 10.1924 7.89978 10.108 8.0459 9.96973C8.07667 9.93126 8.1079 9.89198 8.13867 9.85352C8.16927 9.80756 8.19266 9.76177 8.20801 9.71582C8.23106 9.66972 8.2462 9.62325 8.25391 9.57715C8.2616 9.5233 8.26953 9.4767 8.26953 9.42285C8.26949 9.32299 8.2464 9.22305 8.20801 9.13086C8.16955 9.03855 8.11513 8.95388 8.0459 8.87695ZM10 2.88477C10.0001 3.20009 10.2618 3.46191 10.5771 3.46191C10.8925 3.46188 11.1542 3.20007 11.1543 2.88477V2.33789C12.9266 2.51306 13.806 3.53533 13.8418 5.4541H1.15723C1.193 3.53528 2.07336 2.51303 3.8457 2.33789V2.88477C3.84578 3.20009 4.10751 3.46191 4.42285 3.46191C4.73815 3.46186 4.99992 3.20006 5 2.88477V2.30762H10V2.88477Z" fill="currentColor"/>
                          </svg>
                          {formatDate(task.dueDate)}
                        </span>
                      </div>
                      
                      {/* CORRECTION WAVE : Contraste ajusté*/}
                      <div className="flex items-center gap-2 font-sans font-normal text-[12px] text-[#6B7280]">
                        <span className="text-[#6B7280]">Assigné à :</span>
                        <div className="flex items-center gap-4 flex-wrap">
                          {assignees.length === 0 ? <span className="text-gray-300 italic">Non assigné</span> : null}
                          {assignees.map((a, idx) => {
                            const u = a.user;
                            if (!u) return null;
                            const isMe = u.email?.toLowerCase() === userEmail?.toLowerCase();
                            const bgBubble = isMe ? "bg-[#FFE8D9]" : "bg-[#E5E7EB]";
                            const textBubble = isMe ? "text-[#B24B0A]" : "text-[#616875]"; 
                            
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <div aria-hidden="true" className={`h-7 w-7 rounded-full font-sans font-normal text-[10px] text-black flex items-center justify-center uppercase shadow-sm ${bgBubble}`}>
                                  {getInitials(u.name, u.email)}
                                </div>
                                <span className={`px-4 h-[25px] flex items-center justify-center rounded-[50px] font-sans font-normal text-[14px] truncate max-[600px]:hidden ${bgBubble} ${textBubble}`}>
                                  {u.name || u.email.split("@")[0]}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* COMMENTAIRES */}
                  <div className="border-t border-gray-100">
                    <button 
                      onClick={() => toggleComments(task.id)} 
                      aria-expanded={isCommentsOpen}
                      aria-controls={`commentaires de -${task.title}`}
                      className="w-full flex items-center justify-between px-5 py-3 font-sans font-normal text-[14px] text-[#6B7280] hover:bg-gray-50 rounded-b-[10px] transition-colors cursor-pointer"
                    >
                      <span>Commentaires ({taskComments.length})</span>
                      {isCommentsOpen ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                    </button>

                    {isCommentsOpen && (
                      <div id={`comments-${task.id}`} className="px-5 pb-5 pt-2 space-y-4 bg-gray-50/50 rounded-b-[10px]">
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                          {taskComments.length === 0 ? (
                            <p className="font-sans font-normal text-[14px] text-gray-400 italic">Aucun commentaire pour l'instant.</p>
                          ) : (
                            taskComments.map(comment => (
                              <div key={comment.id} className="bg-white p-4 rounded-[10px] border border-gray-100 shadow-xs space-y-2">
                                <p className="font-sans font-normal text-[14px] text-gray-700 leading-relaxed">{comment.content}</p>
                                <div className="font-sans font-normal text-[10px] text-gray-400 flex items-center gap-1">
                                  <div aria-hidden="true" className="h-4 w-4 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center uppercase border border-gray-200">
                                    {getInitials(comment.author?.name || "", comment.author?.email || "")}
                                  </div>
                                  <span>{comment.author?.name || comment.author?.username || comment.author?.email || "Utilisateur"} • {new Date(comment.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute:'2-digit' })}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <input 
                            type="text" 
                            aria-label="Écrire un commentaire"
                            value={newCommentContent[task.id] || ""}
                            onChange={(e) => setNewCommentContent(prev => ({...prev, [task.id]: e.target.value}))}
                            placeholder="Écrire un commentaire..." 
                            className="flex-1 bg-white border border-gray-200 font-sans font-normal text-[14px] px-4 py-2.5 rounded-lg outline-none focus:border-[#D3590B] transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(task.id)}
                          />
                          <button 
                            onClick={() => handleAddComment(task.id)}
                            disabled={!newCommentContent[task.id]?.trim() || isPostingComment === task.id}
                            aria-label="Envoyer le commentaire"
                            className="bg-[#121212] hover:bg-[#1F1F1F] disabled:bg-gray-300 text-white p-3 rounded-lg transition-colors cursor-pointer"
                          >
                            {isPostingComment === task.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALE MODIFIER LE PROJET */}
      {showEditProjectModale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
          <form onSubmit={handleUpdateProject} className="bg-white rounded-[10px] max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button type="button" aria-label="Fermer la fenêtre de modification" onClick={() => setShowEditProjectModale(false)} className="absolute top-5 right-5 p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
              <X className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            </button>
            <h3 id="edit-project-title" className="font-heading font-semibold text-[24px] text-gray-900">Modifier le projet</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="editProjectTitle" className="font-sans font-normal text-[14px] text-gray-800">Titre*</label>
                <input id="editProjectTitle" type="text" required value={editProjectTitle} onChange={(e) => setEditProjectTitle(e.target.value)} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none focus:border-[#D3590B]" />
              </div>
              <div className="space-y-1">
                <label htmlFor="editProjectDescription" className="font-sans font-normal text-[14px] text-gray-800">Description</label>
                <textarea id="editProjectDescription" rows={3} value={editProjectDescription} onChange={(e) => setEditProjectDescription(e.target.value)} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none focus:border-[#D3590B] resize-none" />
              </div>

              <div className="space-y-1.5 relative">
                <label htmlFor="editContributorInput" className="font-sans font-normal text-[14px] text-gray-800">Contributeurs</label>
                {editSelectedContributors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2" aria-live="polite">
                    {editSelectedContributors.map(c => (
                      <div key={c.email} className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-md pl-2 pr-1 py-0.5 text-[12px] text-orange-700">
                        <span>{c.name}</span>
                        <button type="button" aria-label={`Retirer ${c.name}`} onClick={() => setEditSelectedContributors(editSelectedContributors.filter(sc => sc.email !== c.email))} className="text-orange-500 hover:bg-orange-100 rounded-full p-0.5 cursor-pointer"><X className="w-3 h-3" aria-hidden="true" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input id="editContributorInput" autoComplete="off" role="combobox" aria-expanded={userSuggestions.length > 0} type="text" value={editContributorInput} onChange={(e) => handleSearchEditUsers(e.target.value)} placeholder="Rechercher par nom ou email..." className="w-full bg-white text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none focus:border-[#D3590B]" />
                  {isSearchingUsers && <Loader2 className="w-4 h-4 animate-spin text-[#D3590B] absolute right-3 top-2.5" aria-hidden="true" />}
                </div>
                
                {userSuggestions.length > 0 && (
                  <div role="listbox" className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto z-50 divide-y divide-gray-50">
                    {userSuggestions.map(u => (
                      <button role="option" aria-selected="false" key={u.id} type="button" onClick={() => { setEditSelectedContributors([...editSelectedContributors, u]); setEditContributorInput(""); setUserSuggestions([]); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-[14px] text-gray-700 flex flex-col cursor-pointer">
                        <span className="font-semibold">{u.name}</span>
                        <span className="text-[12px] text-gray-400">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" aria-label={isUpdatingProject ? "Enregistrement en cours" : "Enregistrer les modifications"} disabled={isUpdatingProject || !editProjectTitle.trim()} className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-full h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-70">
                {isUpdatingProject ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE CRÉER UNE TÂCHE MANUELLE */}
      {showManualModale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
          <form onSubmit={handleCreateManualTask} className="bg-white rounded-[10px] max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button type="button" aria-label="Fermer la fenêtre de création" onClick={() => setShowManualModale(false)} className="absolute top-5 right-5 p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"><X className="w-5 h-5 stroke-[1.5]" aria-hidden="true" /></button>
            <h3 id="create-task-title" className="font-heading font-semibold text-[24px] text-gray-900">Créer une tâche</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="manualTitle" className="font-sans font-normal text-[14px] text-gray-800">Titre*</label>
                <input id="manualTitle" type="text" required value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none focus:border-[#D3590B]" />
              </div>
              <div className="space-y-1">
                <label htmlFor="manualDescription" className="font-sans font-normal text-[14px] text-gray-800">Description*</label>
                <input id="manualDescription" type="text" required value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none focus:border-[#D3590B]" />
              </div>
              <div className="space-y-1 relative">
                <label htmlFor="manualDueDate" className="font-sans font-normal text-[14px] text-gray-800">Échéance*</label>
                <div className="relative flex items-center">
                  <input id="manualDueDate" type="date" required value={manualDueDate} onChange={(e) => setManualDueDate(e.target.value)} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none cursor-pointer focus:border-[#D3590B]" />
                  <CalendarIcon className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" aria-hidden="true" />
                </div>
              </div>
              <div className="space-y-1.5 relative">
                <label htmlFor="manualCollaborators" className="font-sans font-normal text-[14px] text-gray-800">Assigné à :</label>
                {selectedCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5" aria-live="polite">
                    {selectedCollaborators.map(id => {
                      const user = assignableUsers.find(u => u.id === id);
                      if (!user) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-gray-50 text-gray-700 border border-gray-200 text-[12px] px-2 py-1 rounded-md">
                          {user.name} <button type="button" aria-label={`Retirer ${user.name}`} onClick={() => setSelectedCollaborators(selectedCollaborators.filter(c => c !== id))} className="hover:bg-gray-200 rounded-full p-0.5 cursor-pointer"><X className="w-3 h-3" aria-hidden="true" /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="relative flex items-center">
                  <select id="manualCollaborators" value="" onChange={(e) => { const val = e.target.value; if (val && !selectedCollaborators.includes(val)) setSelectedCollaborators([...selectedCollaborators, val]); }} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none appearance-none cursor-pointer pr-10 focus:border-[#D3590B]">
                    <option value="" disabled>Choisir un collaborateur</option>
                    {assignableUsers.map((u) => <option key={u.id} value={u.id} disabled={selectedCollaborators.includes(u.id)}>{u.name} ({u.email})</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" aria-hidden="true" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-sans font-normal text-[14px] text-gray-800">Statut :</label>
                <div className="flex gap-2">
                  <button type="button" aria-pressed={manualStatus === "TODO"} onClick={() => setManualStatus("TODO")} className={`font-sans font-normal text-[14px] px-4 py-1.5 rounded-[50px] cursor-pointer ${manualStatus === "TODO" ? "bg-[#FFE0E0] text-[#EF4444]" : "bg-gray-50 text-gray-500"}`}>À faire</button>
                  <button type="button" aria-pressed={manualStatus === "IN_PROGRESS"} onClick={() => setManualStatus("IN_PROGRESS")} className={`font-sans font-normal text-[14px] px-4 py-1.5 rounded-[50px] cursor-pointer ${manualStatus === "IN_PROGRESS" ? "bg-[#FFF0D7] text-[#E08D00]" : "bg-gray-50 text-gray-500"}`}>En cours</button>
                  <button type="button" aria-pressed={manualStatus === "DONE"} onClick={() => setManualStatus("DONE")} className={`font-sans font-normal text-[14px] px-4 py-1.5 rounded-[50px] cursor-pointer ${manualStatus === "DONE" ? "bg-[#F1FFF7] text-[#27AE60]" : "bg-gray-50 text-gray-500"}`}>Terminée</button>
                </div>
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={isCreatingManual || !manualTitle.trim()} aria-label={isCreatingManual ? "Création en cours" : "Créer la tâche"} className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-full h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-70">
                {isCreatingManual ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : "Créer la tâche"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE MODIFIER TÂCHE */}
      {showEditModale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="edit-task-title">
          <form onSubmit={handleUpdateTask} className="bg-white rounded-[10px] max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button type="button" aria-label="Fermer la fenêtre de modification de tâche" onClick={() => { setShowEditModale(false); setTaskToEditId(null); }} className="absolute top-5 right-5 p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"><X className="w-5 h-5 stroke-[1.5]" aria-hidden="true" /></button>
            <h3 id="edit-task-title" className="font-heading font-semibold text-[24px] text-gray-900">Modifier la tâche</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="editTaskTitle" className="font-sans font-normal text-[14px] text-gray-800">Titre*</label>
                <input id="editTaskTitle" type="text" required value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none focus:border-[#D3590B]" />
              </div>
              <div className="space-y-1">
                <label htmlFor="editTaskDescription" className="font-sans font-normal text-[14px] text-gray-800">Description*</label>
                <input id="editTaskDescription" type="text" required value={editTaskDescription} onChange={(e) => setEditTaskDescription(e.target.value)} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none focus:border-[#D3590B]" />
              </div>
              <div className="space-y-1 relative">
                <label htmlFor="editTaskDueDate" className="font-sans font-normal text-[14px] text-gray-800">Échéance</label>
                <div className="relative flex items-center">
                  <input id="editTaskDueDate" type="date" value={editTaskDueDate} onChange={(e) => setEditTaskDueDate(e.target.value)} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none cursor-pointer focus:border-[#D3590B]" />
                  <CalendarIcon className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" aria-hidden="true" />
                </div>
              </div>
              <div className="space-y-1.5 relative">
                <label htmlFor="editTaskCollaborators" className="font-sans font-normal text-[14px] text-gray-800">Assigné à :</label>
                {editSelectedCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5" aria-live="polite">
                    {editSelectedCollaborators.map(id => {
                      const user = assignableUsers.find(u => u.id === id);
                      if (!user) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-gray-50 text-gray-700 border border-gray-200 text-[12px] px-2 py-1 rounded-md">
                          {user.name} <button type="button" aria-label={`Retirer ${user.name}`} onClick={() => setEditSelectedCollaborators(editSelectedCollaborators.filter(c => c !== id))} className="hover:bg-gray-200 rounded-full p-0.5 cursor-pointer"><X className="w-3 h-3" aria-hidden="true" /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="relative flex items-center">
                  <select id="editTaskCollaborators" value="" onChange={(e) => { const val = e.target.value; if (val && !editSelectedCollaborators.includes(val)) setEditSelectedCollaborators([...editSelectedCollaborators, val]); }} className="w-full bg-white font-sans font-normal text-[14px] border border-gray-200 px-3 py-2.5 rounded-[10px] outline-none appearance-none cursor-pointer pr-10 focus:border-[#D3590B]">
                    <option value="" disabled>Choisir un collaborateur</option>
                    {assignableUsers.map((u) => <option key={u.id} value={u.id} disabled={editSelectedCollaborators.includes(u.id)}>{u.name} ({u.email})</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" aria-hidden="true" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-sans font-normal text-[14px] text-gray-800">Statut :</label>
                <div className="flex gap-2">
                  <button type="button" aria-pressed={editTaskStatus === "TODO"} onClick={() => setEditTaskStatus("TODO")} className={`font-sans font-normal text-[14px] px-4 py-1.5 rounded-[50px] cursor-pointer ${editTaskStatus === "TODO" ? "bg-[#FFE0E0] text-[#EF4444]" : "bg-gray-50 text-gray-500"}`}>À faire</button>
                  <button type="button" aria-pressed={editTaskStatus === "IN_PROGRESS"} onClick={() => setEditTaskStatus("IN_PROGRESS")} className={`font-sans font-normal text-[14px] px-4 py-1.5 rounded-[50px] cursor-pointer ${editTaskStatus === "IN_PROGRESS" ? "bg-[#FFF0D7] text-[#E08D00]" : "bg-gray-50 text-gray-500"}`}>En cours</button>
                  <button type="button" aria-pressed={editTaskStatus === "DONE"} onClick={() => setEditTaskStatus("DONE")} className={`font-sans font-normal text-[14px] px-4 py-1.5 rounded-[50px] cursor-pointer ${editTaskStatus === "DONE" ? "bg-[#F1FFF7] text-[#27AE60]" : "bg-gray-50 text-gray-500"}`}>Terminée</button>
                </div>
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={isUpdating || !editTaskTitle.trim()} aria-label={isUpdating ? "Mise à jour en cours" : "Mettre à jour la tâche"} className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-full h-[50px] rounded-[10px] font-sans font-normal text-[16px] flex items-center justify-center transition-colors cursor-pointer shadow-sm disabled:opacity-70">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : "Mettre à jour"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE IA MISTRAL */}
      {showIAModale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="ia-modal-title">
          <div className="bg-white rounded-[10px] max-w-xl w-full min-h-[500px] flex flex-col justify-between p-6 shadow-2xl relative">
            <button onClick={() => { setShowIAModale(false); setGeneratedTasks([]); setEditingIndex(null); }} aria-label="Fermer l'assistant IA" className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center gap-2 text-[#D3590B] mt-2">
                <Sparkles className="w-5 h-5 fill-current" aria-hidden="true" />
                <h3 id="ia-modal-title" className="font-heading font-semibold text-[24px] text-gray-900">{generatedTasks.length > 0 ? "Vos tâches suggérées" : "Assistant Tâches IA"}</h3>
              </div>
              <div className="flex-1 overflow-y-auto pr-1 max-h-[340px] space-y-3" aria-live="polite">
                {generatedTasks.length > 0 ? (
                  generatedTasks.map((t, index) => (
                    <div key={index} className="p-5 bg-white border border-gray-100 rounded-[10px] space-y-3 shadow-sm relative">
                      {editingIndex === index ? (
                        <div className="space-y-2">
                          <input type="text" aria-label="Titre de la tâche suggérée" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full font-heading font-semibold text-[18px] border border-gray-200 rounded-[10px] px-3 py-2 text-gray-900 outline-none focus:border-[#D3590B]"/>
                          <textarea aria-label="Description de la tâche suggérée" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full font-sans font-normal text-[14px] border border-gray-200 rounded-[10px] px-3 py-2 text-gray-600 outline-none focus:border-[#D3590B] resize-none" rows={2}/>
                          <button type="button" onClick={() => saveEditedTask(index)} className="font-sans font-normal text-[12px] text-green-700 bg-green-100 px-3 py-1.5 rounded-md cursor-pointer">Enregistrer</button>
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-heading font-semibold text-[18px] text-gray-900">{t.title}</h4>
                          <p className="font-sans font-normal text-[14px] text-[#6B7280] mt-1 leading-relaxed">{t.description}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 font-sans font-normal text-[12px] text-[#6B7280] border-t border-gray-50 pt-3 mt-3">
                        <button type="button" onClick={() => handleRemoveSuggestedTask(index)} className="hover:text-red-500 transition-colors cursor-pointer">Supprimer</button>
                        <span>|</span>
                        {editingIndex !== index && <button type="button" onClick={() => startEditingTask(index, t)} className="hover:text-[#D3590B] transition-colors cursor-pointer">Modifier</button>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center font-sans font-normal text-[14px] text-gray-400 border border-dashed border-gray-200 rounded-[10px] p-8 bg-gray-50/50 text-center">
                    Entrez une description globale ci-dessous pour que l'IA génère les tâches de votre projet.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100 bg-white">
              {generatedTasks.length > 0 && (
                <div className="flex justify-center">
                  <button onClick={handleAcceptIATasks} className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-full h-[50px] rounded-[10px] font-sans font-normal text-[16px] shadow-sm transition-colors cursor-pointer">
                    Ajouter les tâches au projet
                  </button>
                </div>
              )}
              <form onSubmit={handleSendPromptToIA} className="relative flex items-center">
                <input 
                  type="text" 
                  aria-label="Décrivez votre besoin pour la génération IA"
                  value={userPrompt} 
                  onChange={(e) => setUserPrompt(e.target.value)} 
                  placeholder="Ex: Créer une landing page vitrine..." 
                  disabled={isGenerating} 
                  className="w-full bg-gray-50 border border-gray-200 font-sans font-normal text-[14px] text-gray-700 pl-4 pr-14 py-3.5 rounded-full outline-none focus:border-[#D3590B] transition-colors"
                />
                <button type="submit" aria-label="Générer avec l'IA" disabled={!userPrompt.trim() || isGenerating} className="absolute right-2 p-2.5 bg-[#D3590B] hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-full transition-colors cursor-pointer">
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}