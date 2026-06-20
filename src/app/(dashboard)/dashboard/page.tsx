"use client";

import { useEffect, useState } from "react";
import { Search, LayoutGrid, List, X, Loader2 } from "lucide-react";
import Link from "next/link";
import Cookies from "js-cookie";

interface AssignedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  dueDate?: string;
  projectId: string; 
  project?: {
    id: string;
    name?: string;
    title?: string;
  };
  comments?: any[];
}

interface UserSuggestion {
  id: string;
  name: string;
  email: string;
}

export default function DashboardPage() {
  const [userName, setUserName] = useState("Utilisateur");
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"liste" | "kanban" | "projets">("liste");

  // États pour la modale de création de projet et la recherche de contributeurs
  const [showProjectModale, setShowProjectModale] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [contributorInput, setContributorInput] = useState("");
  const [selectedContributors, setSelectedContributors] = useState<UserSuggestion[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  /**
   * Initialisation des données du tableau de bord.
   * Exécute les requêtes de profil et de tâches en parallèle pour optimiser le temps de chargement.
   */
  const fetchData = async () => {
    const token = Cookies.get("abricot_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    const cleanToken = decodeURIComponent(token).replace(/^"|"$/g, '');
    const headers = { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" };

    try {
      const [profileRes, tasksRes] = await Promise.all([
        fetch("/api/auth/profile", { method: "GET", headers }),
        fetch("/api/dashboard/assigned-tasks", { method: "GET", headers })
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const nameToDisplay = profileData.data?.user?.name || profileData.user?.name;
        if (nameToDisplay) setUserName(nameToDisplay);
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        const tasksArray = tasksData.data?.tasks || tasksData.data || tasksData || [];
        setAssignedTasks(Array.isArray(tasksArray) ? tasksArray : []);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données du dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /**
   * Recherche dynamique des utilisateurs pour l'ajout de contributeurs.
   * Filtre côté client les utilisateurs déjà sélectionnés.
   */
  const handleSearchUsers = async (text: string) => {
    setContributorInput(text);
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
          setUserSuggestions(arr.filter(u => !selectedContributors.some(s => s.email === u.email)));
        }
      }
    } catch (e) {
      console.error("Erreur de recherche utilisateur:", e);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleCreateProject: React.SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!projectTitle.trim()) return;

    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    setIsCreatingProject(true);
    try {
      const response = await fetch(`/api/projects`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${cleanToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectTitle,
          description: projectDescription,
          contributors: selectedContributors.map(c => c.email) 
        })
      });

      if (response.ok) {
        setShowProjectModale(false);
        setProjectTitle("");
        setProjectDescription("");
        setSelectedContributors([]);
        fetchData();
      }
    } catch (error) {
      console.error("Erreur de création de projet:", error);
    } finally {
      setIsCreatingProject(false);
    }
  };

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

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "Aucune échéance";
    return new Date(isoString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  const sortedAndFilteredTasks = [...assignedTasks]
    .filter(task =>
      (task.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  // CORRECTION : Filtre les tâches pour le Kanban (uniquement les tâches du mois en cours)
  const getTasksByColumn = (col: "TODO" | "IN_PROGRESS" | "DONE") => {
    return sortedAndFilteredTasks.filter(t => {
      // 1. Vérification du statut
      const s = t.status?.toUpperCase() || "TODO";
      const matchesStatus = 
        (col === "TODO" && s === "TODO") ||
        (col === "IN_PROGRESS" && (s === "IN_PROGRESS" || s === "PROGRESS")) ||
        (col === "DONE" && s === "DONE");

      if (!matchesStatus) return false;

      // 2. Vérification de la date (uniquement pour le mois en cours)
      if (!t.dueDate) return false; // S'il n'y a pas de date, on ne l'affiche pas dans le Kanban du mois
      
      const today = new Date();
      const taskDate = new Date(t.dueDate);
      
      const isThisMonth = 
        taskDate.getMonth() === today.getMonth() && 
        taskDate.getFullYear() === today.getFullYear();

      return isThisMonth;
    });
  };

  /**
   * Agrège les tâches pour générer une vue consolidée par projet,
   * incluant le décompte des tâches et l'échéance la plus proche.
   */
  const extractUniqueProjects = () => {
    const projectMap = new Map<string, { id: string, name: string, taskCount: number, nextDeadline: string | null }>();
    
    sortedAndFilteredTasks.forEach(task => {
      const projId = task.projectId || task.project?.id;
      if (!projId) return;

      if (!projectMap.has(projId)) {
        projectMap.set(projId, {
          id: projId,
          name: task.project?.name || task.project?.title || "Projet sans nom",
          taskCount: 1,
          nextDeadline: task.dueDate || null
        });
      } else {
        const existing = projectMap.get(projId)!;
        existing.taskCount += 1;
        if (task.dueDate) {
          if (!existing.nextDeadline || new Date(task.dueDate) < new Date(existing.nextDeadline)) {
            existing.nextDeadline = task.dueDate;
          }
        }
      }
    });

    return Array.from(projectMap.values()).sort((a, b) => {
      if (!a.nextDeadline) return 1;
      if (!b.nextDeadline) return -1;
      return new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime();
    });
  };

  const projectList = extractUniqueProjects();

  if (isLoading) return <div className="p-8 text-xs text-text-muted flex justify-center" aria-live="polite" aria-busy="true"><Loader2 className="w-5 h-5 animate-spin text-abricot" aria-hidden="true" /></div>;

  return (
    <div className="space-y-6 w-full mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-semibold text-[24px] text-gray-900">Tableau de bord</h1>
          <p className="font-sans font-normal text-[18px] text-black mt-1">Bonjour {userName}, voici un aperçu de vos projets et tâches.</p>
        </div>
        <button 
          onClick={() => setShowProjectModale(true)} 
          className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-[181px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          + Créer un projet
        </button>
      </div>

      {/* TOGGLE VUES - Navigation accessible par onglets */}
      <div className="flex items-center gap-4" role="tablist" aria-label="Sélection de la vue du tableau de bord">
        {/* CORRECTION WAVE : Contraste ajusté (#B24B0A) */}
        <button 
          role="tab"
          aria-selected={activeTab === "liste"}
          onClick={() => setActiveTab("liste")} 
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-sans font-normal text-[14px] transition-colors cursor-pointer ${
            activeTab === "liste" ? "bg-[#FFE8D9] text-[#B24B0A]" : "bg-white border border-gray-200 text-[#B24B0A] hover:bg-orange-50"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M15.1111 7.82222C14.5778 7.82222 14.2222 8.17778 14.2222 8.71111V13.6889C14.2222 13.9556 13.9556 14.2222 13.6889 14.2222H2.31111C2.04444 14.2222 1.77778 13.9556 1.77778 13.6889V2.31111C1.77778 2.04444 2.04444 1.77778 2.31111 1.77778H10.8444C11.3778 1.77778 11.7333 1.42222 11.7333 0.888889C11.7333 0.355556 11.3778 0 10.8444 0H2.31111C1.06667 0 0 1.06667 0 2.31111V13.6889C0 14.9333 1.06667 16 2.31111 16H13.6889C14.9333 16 16 14.9333 16 13.6889V8.71111C16 8.26667 15.6444 7.82222 15.1111 7.82222Z" fill="currentColor"/>
            <path d="M6.84435 7.11113C6.48879 6.75558 5.95546 6.84447 5.5999 7.20002C5.33324 7.46669 5.33324 8.00002 5.5999 8.35558L7.55546 10.4C7.73324 10.5778 7.91101 10.6667 8.17768 10.6667C8.44435 10.6667 8.62212 10.5778 8.7999 10.4L14.8443 4.1778C15.1999 3.82224 15.1999 3.28891 14.8443 2.93335C14.4888 2.5778 13.9555 2.5778 13.5999 2.93335L8.17768 8.53335L6.84435 7.11113Z" fill="currentColor"/>
          </svg>
          Liste
        </button>
        {/* CORRECTION WAVE : Contraste ajusté (#B24B0A) */}
        <button 
          role="tab"
          aria-selected={activeTab === "kanban"}
          onClick={() => setActiveTab("kanban")} 
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-sans font-normal text-[14px] transition-colors cursor-pointer ${
            activeTab === "kanban" ? "bg-[#FFE8D9] text-[#B24B0A]" : "bg-white border border-gray-200 text-[#B24B0A] hover:bg-orange-50"
          }`}
        >
          <svg width="15" height="17" viewBox="0 0 15 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4.42285 0C4.10746 0 3.8457 0.261761 3.8457 0.577148V1.17871C1.39505 1.38897 0 2.96789 0 5.57715V12.1152C0 14.9229 1.61522 16.538 4.42285 16.5381H10.5771C13.3847 16.538 15 14.9229 15 12.1152V5.57715C15 2.96794 13.6049 1.38901 11.1543 1.17871V0.577148C11.1543 0.261782 10.8925 3.47543e-05 10.5771 0C10.2618 0 10 0.261761 10 0.577148V1.15332H5V0.577148C5 0.261793 4.7382 5.25452e-05 4.42285 0ZM13.8457 12.1152C13.8457 14.3152 12.777 15.3847 10.5771 15.3848H4.42285C2.22293 15.3847 1.15332 14.3152 1.15332 12.1152V6.60742H13.8457V12.1152ZM10.4844 11.4082C10.1998 11.2852 9.86186 11.3541 9.64648 11.5693C9.61572 11.6078 9.57679 11.6461 9.55371 11.6846C9.52294 11.7307 9.49976 11.7771 9.48438 11.8232C9.46134 11.8693 9.44616 11.9159 9.43848 11.9697C9.43082 12.0157 9.42288 12.0693 9.42285 12.1152C9.42285 12.3152 9.50802 12.516 9.64648 12.6621C9.7926 12.8003 9.99256 12.8848 10.1924 12.8848C10.2923 12.8848 10.3922 12.8616 10.4844 12.8232C10.5765 12.7848 10.6615 12.7312 10.7383 12.6621C10.8075 12.5852 10.8619 12.5081 10.9004 12.4082C10.9389 12.3159 10.9619 12.2152 10.9619 12.1152C10.9618 11.9153 10.8767 11.7154 10.7383 11.5693C10.6614 11.5001 10.5766 11.4466 10.4844 11.4082ZM10.0381 8.66895C9.99208 8.67665 9.94639 8.69283 9.90039 8.71582C9.85434 8.73117 9.80777 8.75352 9.76172 8.78418C9.72332 8.8149 9.68489 8.84623 9.64648 8.87695C9.61572 8.9154 9.57679 8.95374 9.55371 8.99219C9.52294 9.03834 9.49976 9.08471 9.48438 9.13086C9.46134 9.17696 9.44616 9.22343 9.43848 9.26953C9.43081 9.32318 9.42288 9.3692 9.42285 9.42285C9.42285 9.62285 9.50802 9.82357 9.64648 9.96973C9.7926 10.108 9.99256 10.1924 10.1924 10.1924C10.2923 10.1924 10.3922 10.1693 10.4844 10.1309C10.5765 10.0925 10.6614 10.0388 10.7383 9.96973C10.8075 9.89286 10.8619 9.80804 10.9004 9.71582C10.9389 9.62351 10.9619 9.52285 10.9619 9.42285C10.9618 9.22293 10.8767 9.02305 10.7383 8.87695C10.6614 8.80777 10.5766 8.75426 10.4844 8.71582C10.3459 8.65431 10.1919 8.63818 10.0381 8.66895ZM8.0459 8.87695C7.83052 8.66172 7.48485 8.59282 7.20801 8.71582C7.10806 8.75426 7.03098 8.80778 6.9541 8.87695C6.8157 9.02304 6.73055 9.22294 6.73047 9.42285C6.73047 9.4767 6.7384 9.5233 6.74609 9.57715C6.75379 9.62325 6.76894 9.66972 6.79199 9.71582C6.80733 9.76177 6.83074 9.80757 6.86133 9.85352C6.8921 9.89198 6.92333 9.93126 6.9541 9.96973C7.03091 10.0388 7.10815 10.0925 7.20801 10.1309C7.30023 10.1693 7.4001 10.1924 7.5 10.1924C7.69983 10.1924 7.89978 10.108 8.0459 9.96973C8.07667 9.93126 8.1079 9.89198 8.13867 9.85352C8.16927 9.80756 8.19266 9.76177 8.20801 9.71582C8.23106 9.66972 8.2462 9.62325 8.25391 9.57715C8.2616 9.5233 8.26953 9.4767 8.26953 9.42285C8.26949 9.32299 8.2464 9.22305 8.20801 9.13086C8.16955 9.03855 8.11513 8.95388 8.0459 8.87695ZM10 2.88477C10.0001 3.20009 10.2618 3.46191 10.5771 3.46191C10.8925 3.46188 11.1542 3.20007 11.1543 2.88477V2.33789C12.9266 2.51306 13.806 3.53533 13.8418 5.4541H1.15723C1.193 3.53528 2.07336 2.51303 3.8457 2.33789V2.88477C3.84578 3.20009 4.10751 3.46191 4.42285 3.46191C4.73815 3.46186 4.99992 3.20006 5 2.88477V2.30762H10V2.88477Z" fill="currentColor"/>
          </svg>
          Kanban
        </button>
        {/* CORRECTION WAVE : Contraste ajusté (#B24B0A) */}
        <button 
          role="tab"
          aria-selected={activeTab === "projets"}
          onClick={() => setActiveTab("projets")} 
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-sans font-normal text-[14px] transition-colors cursor-pointer ${
            activeTab === "projets" ? "bg-[#FFE8D9] text-[#B24B0A]" : "bg-white border border-gray-200 text-[#B24B0A] hover:bg-orange-50"
          }`}
        >
          <svg width="29" height="23" viewBox="0 0 29 23" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" aria-hidden="true">
            <path d="M26.5791 9.08691C27.4428 9.08698 28.2214 9.51204 28.6621 10.2227C29.0726 10.8866 29.1117 11.6992 28.7646 12.3965L24.3672 21.209C23.9765 21.9918 23.1766 22.4873 22.3018 22.4873H1.83984C0.970986 22.4873 0.240875 21.9031 0.0488281 21.1221L5.13672 10.4561C5.52599 9.62428 6.3926 9.08699 7.3457 9.08691H26.5791ZM8.66699 0C9.25766 6.22332e-05 9.81079 0.279265 10.1455 0.748047L12.0352 3.39062C12.0391 3.3935 12.05 3.39843 12.0654 3.39844H22.626C23.616 3.39852 24.4219 4.17503 24.4219 5.12988V7.44629H6.31055C5.35695 7.44629 4.48933 7.9845 4.10059 8.81641L0 17.4141V1.73145C2.66478e-05 0.776583 0.805427 6.71615e-05 1.7959 0H8.66699Z" fill="currentColor"/>
          </svg>
          Projets
        </button>
      </div>

      {/* CONTENEUR PRINCIPAL */}
      {activeTab === "liste" ? (
        
        /* === VUE LISTE === */
        <div className="bg-white border border-gray-100 rounded-[10px] p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-heading font-semibold text-[18px] text-gray-900">Mes tâches assignées</h2>
              <p className="font-sans font-normal text-[16px] text-[#6B7280] mt-0.5">Par ordre de priorité</p>
            </div>
            <div className="relative w-full md:w-64">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Rechercher une tâche" 
                aria-label="Rechercher une tâche par titre ou description"
                className="w-full bg-white border border-gray-200 text-gray-700 text-[14px] px-4 py-2.5 pl-3 pr-8 rounded-lg outline-none focus:border-orange-300 transition-colors" 
              />
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-4" aria-live="polite">
            {sortedAndFilteredTasks.length === 0 ? (
              <div className="text-center py-8 font-sans font-normal text-[14px] text-gray-400 border border-dashed border-gray-100 rounded-[10px]">Aucune tâche assignée trouvée.</div>
            ) : (
              sortedAndFilteredTasks.map((task) => (
                <div key={task.id} className="border border-gray-100 rounded-[10px] p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:border-gray-200 transition-colors bg-white shadow-sm">
                  
                  <div className="space-y-3 flex-1 overflow-hidden">
                    <div>
                      <h3 className="font-heading font-semibold text-[18px] text-gray-900 line-clamp-1" title={task.title}>{task.title}</h3>
                      <p className="font-sans font-normal text-[14px] text-[#6B7280] mt-1 line-clamp-2 h-[42px] leading-[21px]">{task.description || "Aucune description."}</p>
                    </div>
                    
                    <div className="flex items-center gap-2.5 font-sans font-normal text-[12px] text-[#6B7280] pt-1 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 truncate max-w-[120px]" title={task.project?.name || task.project?.title || "Projet inconnu"}>
                        <svg className="shrink-0" width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M16.4971 5.64062C17.0331 5.64062 17.5164 5.90382 17.79 6.34473C18.0449 6.75685 18.069 7.26147 17.8535 7.69434L15.125 13.1641C14.8825 13.6499 14.3858 13.957 13.8428 13.957H1.1416C0.602432 13.9569 0.149455 13.595 0.0302734 13.1104L3.18848 6.49023C3.43007 5.97383 3.96788 5.64063 4.55957 5.64062H16.4971ZM5.37891 0C5.74544 0 6.08907 0.173054 6.29688 0.463867L7.46973 2.10449C7.4722 2.10628 7.47964 2.10938 7.48926 2.10938H14.0439C14.6582 2.10956 15.158 2.59114 15.1582 3.18359V4.62207H3.91699C3.3251 4.62207 2.78621 4.95532 2.54492 5.47168L0 10.8086V1.07422C0.000182135 0.481809 0.499768 0.000251775 1.11426 0H5.37891Z" fill="currentColor"/>
                        </svg>
                        <span className="truncate">{task.project?.name || task.project?.title || "Projet inconnu"}</span>
                      </span>
                      <span className="text-gray-300 shrink-0">|</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <svg className="shrink-0" width="15" height="17" viewBox="0 0 15 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M4.42285 0C4.10746 0 3.8457 0.261761 3.8457 0.577148V1.17871C1.39505 1.38897 0 2.96789 0 5.57715V12.1152C0 14.9229 1.61522 16.538 4.42285 16.5381H10.5771C13.3847 16.538 15 14.9229 15 12.1152V5.57715C15 2.96794 13.6049 1.38901 11.1543 1.17871V0.577148C11.1543 0.261782 10.8925 3.47543e-05 10.5771 0C10.2618 0 10 0.261761 10 0.577148V1.15332H5V0.577148C5 0.261793 4.7382 5.25452e-05 4.42285 0ZM13.8457 12.1152C13.8457 14.3152 12.777 15.3847 10.5771 15.3848H4.42285C2.22293 15.3847 1.15332 14.3152 1.15332 12.1152V6.60742H13.8457V12.1152ZM10.4844 11.4082C10.1998 11.2852 9.86186 11.3541 9.64648 11.5693C9.61572 11.6078 9.57679 11.6461 9.55371 11.6846C9.52294 11.7307 9.49976 11.7771 9.48438 11.8232C9.46134 11.8693 9.44616 11.9159 9.43848 11.9697C9.43082 12.0157 9.42288 12.0693 9.42285 12.1152C9.42285 12.3152 9.50802 12.516 9.64648 12.6621C9.7926 12.8003 9.99256 12.8848 10.1924 12.8848C10.2923 12.8848 10.3922 12.8616 10.4844 12.8232C10.5765 12.7848 10.6615 12.7312 10.7383 12.6621C10.8075 12.5852 10.8619 12.5081 10.9004 12.4082C10.9389 12.3159 10.9619 12.2152 10.9619 12.1152C10.9618 11.9153 10.8767 11.7154 10.7383 11.5693C10.6614 11.5001 10.5766 11.4466 10.4844 11.4082ZM10.0381 8.66895C9.99208 8.67665 9.94639 8.69283 9.90039 8.71582C9.85434 8.73117 9.80777 8.75352 9.76172 8.78418C9.72332 8.8149 9.68489 8.84623 9.64648 8.87695C9.61572 8.9154 9.57679 8.95374 9.55371 8.99219C9.52294 9.03834 9.49976 9.08471 9.48438 9.13086C9.46134 9.17696 9.44616 9.22343 9.43848 9.26953C9.43081 9.32318 9.42288 9.3692 9.42285 9.42285C9.42285 9.62285 9.50802 9.82357 9.64648 9.96973C9.7926 10.108 9.99256 10.1924 10.1924 10.1924C10.2923 10.1924 10.3922 10.1693 10.4844 10.1309C10.5765 10.0925 10.6614 10.0388 10.7383 9.96973C10.8075 9.89286 10.8619 9.80804 10.9004 9.71582C10.9389 9.62351 10.9619 9.52285 10.9619 9.42285C10.9618 9.22293 10.8767 9.02305 10.7383 8.87695C10.6614 8.80777 10.5766 8.75426 10.4844 8.71582C10.3459 8.65431 10.1919 8.63818 10.0381 8.66895ZM8.0459 8.87695C7.83052 8.66172 7.48485 8.59282 7.20801 8.71582C7.10806 8.75426 7.03098 8.80778 6.9541 8.87695C6.8157 9.02304 6.73055 9.22294 6.73047 9.42285C6.73047 9.4767 6.7384 9.5233 6.74609 9.57715C6.75379 9.62325 6.76894 9.66972 6.79199 9.71582C6.80733 9.76177 6.83074 9.80757 6.86133 9.85352C6.8921 9.89198 6.92333 9.93126 6.9541 9.96973C7.03091 10.0388 7.10815 10.0925 7.20801 10.1309C7.30023 10.1693 7.4001 10.1924 7.5 10.1924C7.69983 10.1924 7.89978 10.108 8.0459 9.96973C8.07667 9.93126 8.1079 9.89198 8.13867 9.85352C8.16927 9.80756 8.19266 9.76177 8.20801 9.71582C8.23106 9.66972 8.2462 9.62325 8.25391 9.57715C8.2616 9.5233 8.26953 9.4767 8.26953 9.42285C8.26949 9.32299 8.2464 9.22305 8.20801 9.13086C8.16955 9.03855 8.11513 8.95388 8.0459 8.87695ZM10 2.88477C10.0001 3.20009 10.2618 3.46191 10.5771 3.46191C10.8925 3.46188 11.1542 3.20007 11.1543 2.88477V2.33789C12.9266 2.51306 13.806 3.53533 13.8418 5.4541H1.15723C1.193 3.53528 2.07336 2.51303 3.8457 2.33789V2.88477C3.84578 3.20009 4.10751 3.46191 4.42285 3.46191C4.73815 3.46186 4.99992 3.20006 5 2.88477V2.30762H10V2.88477Z" fill="currentColor"/>
                        </svg>
                        {formatDate(task.dueDate)}
                      </span>
                      <span className="text-gray-300 shrink-0">|</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <svg className="shrink-0" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M12.0311 0H2.97479C1.33353 0 0.00293083 1.3359 0 2.98009V9.97376C0.00293083 11.6179 1.33353 12.9538 2.97479 12.9538H5.44255L7.06037 14.8006C7.27432 15.0443 7.64361 15.0678 7.88687 14.8535C7.90445 14.8359 7.92204 14.8212 7.93962 14.8006L9.55744 12.9538H12.0252C13.6694 12.9538 15 11.6179 15 9.97376V2.98009C15.0029 1.33297 13.6723 0 12.0311 0ZM11.1723 9.90329H3.83353C3.51114 9.90329 3.24736 9.63905 3.24736 9.31608C3.24736 8.99312 3.51114 8.72887 3.83353 8.72887H11.1723C11.4947 8.72887 11.7585 8.99312 11.7585 9.31608C11.7585 9.63905 11.4947 9.90329 11.1723 9.90329ZM11.1723 7.02597H3.83353C3.51114 7.02597 3.24736 6.76172 3.24736 6.43876C3.24736 6.11579 3.51114 5.85155 3.83353 5.85155H11.1723C11.4947 5.85155 11.7585 6.11579 11.7585 6.43876C11.7585 6.76172 11.4947 7.02597 11.1723 7.02597ZM11.1723 4.14864H3.83353C3.51114 4.14864 3.24736 3.88439 3.24736 3.56143C3.24736 3.23846 3.51114 2.97422 3.83353 2.97422H11.1723C11.4947 2.97422 11.7585 3.23846 11.7585 3.56143C11.7585 3.88439 11.4947 4.14864 11.1723 4.14864Z" fill="currentColor"/>
                        </svg>
                        {task.comments?.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between gap-4 min-w-[121px] sm:self-stretch shrink-0">
                    <span className={getStatusClasses(task.status)}>
                      {getStatusLabel(task.status)}
                    </span>
                    <Link 
                      href={`/projects/${task.projectId || task.project?.id || ""}`} 
                      className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-[121px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors flex items-center justify-center shadow-sm cursor-pointer"
                    >
                      Voir
                    </Link>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

      ) : activeTab === "kanban" ? (

        /* === VUE KANBAN === */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {[
            { id: "TODO", title: "À faire" },
            { id: "IN_PROGRESS", title: "En cours" },
            { id: "DONE", title: "Terminées" }
          ].map((col) => {
            const currentTasks = getTasksByColumn(col.id as any);
            return (
              <div key={col.id} className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-sm flex flex-col gap-5 min-h-[300px]">
                
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-[18px] text-gray-900">{col.title}</h3>
                  <span className="bg-gray-100 text-gray-500 font-sans font-normal text-[12px] px-2.5 py-0.5 rounded-full">{currentTasks.length}</span>
                </div>

                <div className="space-y-4 flex-1">
                  {currentTasks.length === 0 ? (
                    <div className="text-center py-8 font-sans font-normal text-[14px] text-gray-400 italic border border-dashed border-gray-100 rounded-[10px]">Aucune tâche</div>
                  ) : (
                    currentTasks.map(t => (
                      <div key={t.id} className="bg-white border border-gray-100 rounded-[10px] p-5 shadow-xs space-y-4 hover:border-gray-200 transition-all flex flex-col justify-between">
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-heading font-semibold text-[18px] text-gray-900 leading-tight line-clamp-1 flex-1" title={t.title}>{t.title}</h4>
                            <span className={`${getStatusClasses(t.status)} shrink-0 mt-0.5`}>
                              {getStatusLabel(t.status)}
                            </span>
                          </div>
                          <p className="font-sans font-normal text-[14px] text-[#6B7280] leading-relaxed line-clamp-2 h-[42px]">{t.description || "Aucune description."}</p>
                        </div>
                        
                        <div className="flex items-center gap-2 font-sans font-normal text-[12px] text-[#6B7280] pt-2 border-t border-gray-50 mt-1 whitespace-nowrap overflow-hidden">
                          <span className="flex items-center gap-1.5 truncate max-w-[100px]" title={t.project?.name || t.project?.title || "Projet"}>
                            <svg className="shrink-0" width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M16.4971 5.64062C17.0331 5.64062 17.5164 5.90382 17.79 6.34473C18.0449 6.75685 18.069 7.26147 17.8535 7.69434L15.125 13.1641C14.8825 13.6499 14.3858 13.957 13.8428 13.957H1.1416C0.602432 13.9569 0.149455 13.595 0.0302734 13.1104L3.18848 6.49023C3.43007 5.97383 3.96788 5.64063 4.55957 5.64062H16.4971ZM5.37891 0C5.74544 0 6.08907 0.173054 6.29688 0.463867L7.46973 2.10449C7.4722 2.10628 7.47964 2.10938 7.48926 2.10938H14.0439C14.6582 2.10956 15.158 2.59114 15.1582 3.18359V4.62207H3.91699C3.3251 4.62207 2.78621 4.95532 2.54492 5.47168L0 10.8086V1.07422C0.000182135 0.481809 0.499768 0.000251775 1.11426 0H5.37891Z" fill="currentColor"/>
                            </svg>
                            <span className="truncate">{t.project?.name || t.project?.title || "Projet"}</span>
                          </span>
                          <span className="text-gray-200 shrink-0">|</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <svg className="shrink-0" width="15" height="17" viewBox="0 0 15 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M4.42285 0C4.10746 0 3.8457 0.261761 3.8457 0.577148V1.17871C1.39505 1.38897 0 2.96789 0 5.57715V12.1152C0 14.9229 1.61522 16.538 4.42285 16.5381H10.5771C13.3847 16.538 15 14.9229 15 12.1152V5.57715C15 2.96794 13.6049 1.38901 11.1543 1.17871V0.577148C11.1543 0.261782 10.8925 3.47543e-05 10.5771 0C10.2618 0 10 0.261761 10 0.577148V1.15332H5V0.577148C5 0.261793 4.7382 5.25452e-05 4.42285 0ZM13.8457 12.1152C13.8457 14.3152 12.777 15.3847 10.5771 15.3848H4.42285C2.22293 15.3847 1.15332 14.3152 1.15332 12.1152V6.60742H13.8457V12.1152ZM10.4844 11.4082C10.1998 11.2852 9.86186 11.3541 9.64648 11.5693C9.61572 11.6078 9.57679 11.6461 9.55371 11.6846C9.52294 11.7307 9.49976 11.7771 9.48438 11.8232C9.46134 11.8693 9.44616 11.9159 9.43848 11.9697C9.43082 12.0157 9.42288 12.0693 9.42285 12.1152C9.42285 12.3152 9.50802 12.516 9.64648 12.6621C9.7926 12.8003 9.99256 12.8848 10.1924 12.8848C10.2923 12.8848 10.3922 12.8616 10.4844 12.8232C10.5765 12.7848 10.6615 12.7312 10.7383 12.6621C10.8075 12.5852 10.8619 12.5081 10.9004 12.4082C10.9389 12.3159 10.9619 12.2152 10.9619 12.1152C10.9618 11.9153 10.8767 11.7154 10.7383 11.5693C10.6614 11.5001 10.5766 11.4466 10.4844 11.4082ZM10.0381 8.66895C9.99208 8.67665 9.94639 8.69283 9.90039 8.71582C9.85434 8.73117 9.80777 8.75352 9.76172 8.78418C9.72332 8.8149 9.68489 8.84623 9.64648 8.87695C9.61572 8.9154 9.57679 8.95374 9.55371 8.99219C9.52294 9.03834 9.49976 9.08471 9.48438 9.13086C9.46134 9.17696 9.44616 9.22343 9.43848 9.26953C9.43081 9.32318 9.42288 9.3692 9.42285 9.42285C9.42285 9.62285 9.50802 9.82357 9.64648 9.96973C9.7926 10.108 9.99256 10.1924 10.1924 10.1924C10.2923 10.1924 10.3922 10.1693 10.4844 10.1309C10.5765 10.0925 10.6614 10.0388 10.7383 9.96973C10.8075 9.89286 10.8619 9.80804 10.9004 9.71582C10.9389 9.62351 10.9619 9.52285 10.9619 9.42285C10.9618 9.22293 10.8767 9.02305 10.7383 8.87695C10.6614 8.80777 10.5766 8.75426 10.4844 8.71582C10.3459 8.65431 10.1919 8.63818 10.0381 8.66895ZM8.0459 8.87695C7.83052 8.66172 7.48485 8.59282 7.20801 8.71582C7.10806 8.75426 7.03098 8.80778 6.9541 8.87695C6.8157 9.02304 6.73055 9.22294 6.73047 9.42285C6.73047 9.4767 6.7384 9.5233 6.74609 9.57715C6.75379 9.62325 6.76894 9.66972 6.79199 9.71582C6.80733 9.76177 6.83074 9.80757 6.86133 9.85352C6.8921 9.89198 6.92333 9.93126 6.9541 9.96973C7.03091 10.0388 7.10815 10.0925 7.20801 10.1309C7.30023 10.1693 7.4001 10.1924 7.5 10.1924C7.69983 10.1924 7.89978 10.108 8.0459 9.96973C8.07667 9.93126 8.1079 9.89198 8.13867 9.85352C8.16927 9.80756 8.19266 9.76177 8.20801 9.71582C8.23106 9.66972 8.2462 9.62325 8.25391 9.57715C8.2616 9.5233 8.26953 9.4767 8.26953 9.42285C8.26949 9.32299 8.2464 9.22305 8.20801 9.13086C8.16955 9.03855 8.11513 8.95388 8.0459 8.87695ZM10 2.88477C10.0001 3.20009 10.2618 3.46191 10.5771 3.46191C10.8925 3.46188 11.1542 3.20007 11.1543 2.88477V2.33789C12.9266 2.51306 13.806 3.53533 13.8418 5.4541H1.15723C1.193 3.53528 2.07336 2.51303 3.8457 2.33789V2.88477C3.84578 3.20009 4.10751 3.46191 4.42285 3.46191C4.73815 3.46186 4.99992 3.20006 5 2.88477V2.30762H10V2.88477Z" fill="currentColor"/>
                            </svg>
                            {formatDate(t.dueDate)}
                          </span>
                          <span className="text-gray-200 shrink-0">|</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <svg className="shrink-0" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M12.0311 0H2.97479C1.33353 0 0.00293083 1.3359 0 2.98009V9.97376C0.00293083 11.6179 1.33353 12.9538 2.97479 12.9538H5.44255L7.06037 14.8006C7.27432 15.0443 7.64361 15.0678 7.88687 14.8535C7.90445 14.8359 7.92204 14.8212 7.93962 14.8006L9.55744 12.9538H12.0252C13.6694 12.9538 15 11.6179 15 9.97376V2.98009C15.0029 1.33297 13.6723 0 12.0311 0ZM11.1723 9.90329H3.83353C3.51114 9.90329 3.24736 9.63905 3.24736 9.31608C3.24736 8.99312 3.51114 8.72887 3.83353 8.72887H11.1723C11.4947 8.72887 11.7585 8.99312 11.7585 9.31608C11.7585 9.63905 11.4947 9.90329 11.1723 9.90329ZM11.1723 7.02597H3.83353C3.51114 7.02597 3.24736 6.76172 3.24736 6.43876C3.24736 6.11579 3.51114 5.85155 3.83353 5.85155H11.1723C11.4947 5.85155 11.7585 6.11579 11.7585 6.43876C11.7585 6.76172 11.4947 7.02597 11.1723 7.02597ZM11.1723 4.14864H3.83353C3.51114 4.14864 3.24736 3.88439 3.24736 3.56143C3.24736 3.23846 3.51114 2.97422 3.83353 2.97422H11.1723C11.4947 2.97422 11.7585 3.23846 11.7585 3.56143C11.7585 3.88439 11.4947 4.14864 11.1723 4.14864Z" fill="currentColor"/>
                            </svg>
                            {t.comments?.length || 0}
                          </span>
                        </div>

                        <div className="flex justify-start pt-2">
                          <Link 
                            href={`/projects/${t.projectId || t.project?.id || ""}`} 
                            className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-[121px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors flex items-center justify-center shadow-sm cursor-pointer"
                          >
                            Voir
                          </Link>
                        </div>

                      </div>
                    ))
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* === VUE PROJETS === */
        <div className="bg-white border border-gray-100 rounded-[10px] p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-heading font-semibold text-[18px] text-gray-900">Projets avec tâches assignées</h2>
              <p className="font-sans font-normal text-[16px] text-[#6B7280] mt-0.5">Triés par ordre d'urgence</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectList.length === 0 ? (
              <div className="col-span-full text-center py-8 font-sans font-normal text-[14px] text-gray-400 border border-dashed border-gray-100 rounded-[10px]">
                Aucun projet avec des tâches assignées.
              </div>
            ) : (
              projectList.map((proj) => (
                <div key={proj.id} className="border border-gray-100 rounded-[10px] p-5 flex flex-col justify-between hover:border-[#D3590B] transition-colors bg-white shadow-sm group">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-lg bg-[#FFE8D9] text-[#D3590B] flex items-center justify-center shrink-0">
                        <svg className="shrink-0" width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M16.4971 5.64062C17.0331 5.64062 17.5164 5.90382 17.79 6.34473C18.0449 6.75685 18.069 7.26147 17.8535 7.69434L15.125 13.1641C14.8825 13.6499 14.3858 13.957 13.8428 13.957H1.1416C0.602432 13.9569 0.149455 13.595 0.0302734 13.1104L3.18848 6.49023C3.43007 5.97383 3.96788 5.64063 4.55957 5.64062H16.4971ZM5.37891 0C5.74544 0 6.08907 0.173054 6.29688 0.463867L7.46973 2.10449C7.4722 2.10628 7.47964 2.10938 7.48926 2.10938H14.0439C14.6582 2.10956 15.158 2.59114 15.1582 3.18359V4.62207H3.91699C3.3251 4.62207 2.78621 4.95532 2.54492 5.47168L0 10.8086V1.07422C0.000182135 0.481809 0.499768 0.000251775 1.11426 0H5.37891Z" fill="currentColor"/>
                        </svg>
                      </div>
                      <span className="bg-gray-50 border border-gray-100 text-gray-600 font-sans font-medium text-[12px] px-2.5 py-1 rounded-full">
                        {proj.taskCount} tâche{proj.taskCount > 1 ? "s" : ""}
                      </span>
                    </div>
                    <h3 className="font-heading font-semibold text-[18px] text-gray-900 line-clamp-1" title={proj.name}>{proj.name}</h3>
                    
                    <div className="flex items-center gap-2 font-sans font-normal text-[13px] text-[#6B7280] pt-1">
                      <svg className="shrink-0 text-gray-400" width="15" height="17" viewBox="0 0 15 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M4.42285 0C4.10746 0 3.8457 0.261761 3.8457 0.577148V1.17871C1.39505 1.38897 0 2.96789 0 5.57715V12.1152C0 14.9229 1.61522 16.538 4.42285 16.5381H10.5771C13.3847 16.538 15 14.9229 15 12.1152V5.57715C15 2.96794 13.6049 1.38901 11.1543 1.17871V0.577148C11.1543 0.261782 10.8925 3.47543e-05 10.5771 0C10.2618 0 10 0.261761 10 0.577148V1.15332H5V0.577148C5 0.261793 4.7382 5.25452e-05 4.42285 0ZM13.8457 12.1152C13.8457 14.3152 12.777 15.3847 10.5771 15.3848H4.42285C2.22293 15.3847 1.15332 14.3152 1.15332 12.1152V6.60742H13.8457V12.1152ZM10.4844 11.4082C10.1998 11.2852 9.86186 11.3541 9.64648 11.5693C9.61572 11.6078 9.57679 11.6461 9.55371 11.6846C9.52294 11.7307 9.49976 11.7771 9.48438 11.8232C9.46134 11.8693 9.44616 11.9159 9.43848 11.9697C9.43082 12.0157 9.42288 12.0693 9.42285 12.1152C9.42285 12.3152 9.50802 12.516 9.64648 12.6621C9.7926 12.8003 9.99256 12.8848 10.1924 12.8848C10.2923 12.8848 10.3922 12.8616 10.4844 12.8232C10.5765 12.7848 10.6615 12.7312 10.7383 12.6621C10.8075 12.5852 10.8619 12.5081 10.9004 12.4082C10.9389 12.3159 10.9619 12.2152 10.9619 12.1152C10.9618 11.9153 10.8767 11.7154 10.7383 11.5693C10.6614 11.5001 10.5766 11.4466 10.4844 11.4082ZM10.0381 8.66895C9.99208 8.67665 9.94639 8.69283 9.90039 8.71582C9.85434 8.73117 9.80777 8.75352 9.76172 8.78418C9.72332 8.8149 9.68489 8.84623 9.64648 8.87695C9.61572 8.9154 9.57679 8.95374 9.55371 8.99219C9.52294 9.03834 9.49976 9.08471 9.48438 9.13086C9.46134 9.17696 9.44616 9.22343 9.43848 9.26953C9.43081 9.32318 9.42288 9.3692 9.42285 9.42285C9.42285 9.62285 9.50802 9.82357 9.64648 9.96973C9.7926 10.108 9.99256 10.1924 10.1924 10.1924C10.2923 10.1924 10.3922 10.1693 10.4844 10.1309C10.5765 10.0925 10.6614 10.0388 10.7383 9.96973C10.8075 9.89286 10.8619 9.80804 10.9004 9.71582C10.9389 9.62351 10.9619 9.52285 10.9619 9.42285C10.9618 9.22293 10.8767 9.02305 10.7383 8.87695C10.6614 8.80777 10.5766 8.75426 10.4844 8.71582C10.3459 8.65431 10.1919 8.63818 10.0381 8.66895ZM8.0459 8.87695C7.83052 8.66172 7.48485 8.59282 7.20801 8.71582C7.10806 8.75426 7.03098 8.80778 6.9541 8.87695C6.8157 9.02304 6.73055 9.22294 6.73047 9.42285C6.73047 9.4767 6.7384 9.5233 6.74609 9.57715C6.75379 9.62325 6.76894 9.66972 6.79199 9.71582C6.80733 9.76177 6.83074 9.80757 6.86133 9.85352C6.8921 9.89198 6.92333 9.93126 6.9541 9.96973C7.03091 10.0388 7.10815 10.0925 7.20801 10.1309C7.30023 10.1693 7.4001 10.1924 7.5 10.1924C7.69983 10.1924 7.89978 10.108 8.0459 9.96973C8.07667 9.93126 8.1079 9.89198 8.13867 9.85352C8.16927 9.80756 8.19266 9.76177 8.20801 9.71582C8.23106 9.66972 8.2462 9.62325 8.25391 9.57715C8.2616 9.5233 8.26953 9.4767 8.26953 9.42285C8.26949 9.32299 8.2464 9.22305 8.20801 9.13086C8.16955 9.03855 8.11513 8.95388 8.0459 8.87695ZM10 2.88477C10.0001 3.20009 10.2618 3.46191 10.5771 3.46191C10.8925 3.46188 11.1542 3.20007 11.1543 2.88477V2.33789C12.9266 2.51306 13.806 3.53533 13.8418 5.4541H1.15723C1.193 3.53528 2.07336 2.51303 3.8457 2.33789V2.88477C3.84578 3.20009 4.10751 3.46191 4.42285 3.46191C4.73815 3.46186 4.99992 3.20006 5 2.88477V2.30762H10V2.88477Z" fill="currentColor"/>
                      </svg>
                      <span className={!proj.nextDeadline ? "italic" : ""}>
                        Échéance : {formatDate(proj.nextDeadline)}
                      </span>
                    </div>
                  </div>
                  
                  <Link 
                    href={`/projects/${proj.id}`} 
                    className="mt-6 bg-[#121212] hover:bg-[#1F1F1F] text-white w-full h-[45px] rounded-[8px] font-sans font-normal text-[14px] transition-colors flex items-center justify-center shadow-sm cursor-pointer"
                  >
                    Ouvrir le projet
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODALE CRÉATION PROJET */}
      {showProjectModale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
          <form onSubmit={handleCreateProject} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button 
              type="button" 
              onClick={() => { setShowProjectModale(false); setSelectedContributors([]); }} 
              aria-label="Fermer la modale"
              className="absolute top-5 right-5 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            </button>
            <h3 id="create-project-title" className="font-heading font-semibold text-[24px] text-gray-900">Créer un projet</h3>
            
            <div className="space-y-4 mt-4">
              <div className="space-y-1">
                <label htmlFor="projectTitle" className="font-sans font-normal text-[14px] text-gray-800">Titre*</label>
                <input 
                  id="projectTitle"
                  type="text" 
                  required 
                  value={projectTitle} 
                  onChange={(e) => setProjectTitle(e.target.value)} 
                  className="w-full bg-white text-[14px] border border-gray-200 px-3 py-2.5 rounded-lg outline-none focus:border-[#D3590B]" 
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="projectDescription" className="font-sans font-normal text-[14px] text-gray-800">Description*</label>
                <textarea 
                  id="projectDescription"
                  required 
                  rows={3} 
                  value={projectDescription} 
                  onChange={(e) => setProjectDescription(e.target.value)} 
                  className="w-full bg-white text-[14px] border border-gray-200 px-3 py-2.5 rounded-lg outline-none resize-none focus:border-[#D3590B]" 
                />
              </div>

              <div className="space-y-1.5 relative">
                <label htmlFor="contributorInput" className="font-sans font-normal text-[14px] text-gray-800">Contributeurs</label>
                {selectedContributors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2" aria-live="polite">
                    {selectedContributors.map(c => (
                      <div key={c.email} className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-md pl-2 pr-1 py-0.5 text-[12px] text-orange-700">
                        <span>{c.name}</span>
                        <button 
                          type="button" 
                          aria-label={`Retirer ${c.name}`}
                          onClick={() => setSelectedContributors(selectedContributors.filter(sc => sc.email !== c.email))} 
                          className="text-orange-500 hover:bg-orange-100 rounded-full p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input 
                    id="contributorInput"
                    type="text" 
                    value={contributorInput} 
                    onChange={(e) => handleSearchUsers(e.target.value)} 
                    placeholder="Rechercher par nom ou email..." 
                    autoComplete="off"
                    aria-autocomplete="list"
                    className="w-full bg-white text-[14px] border border-gray-200 px-3 py-2.5 rounded-lg outline-none focus:border-[#D3590B]" 
                  />
                  {isSearchingUsers && <Loader2 className="w-4 h-4 animate-spin text-[#D3590B] absolute right-3 top-2.5" aria-hidden="true" />}
                </div>
                
                {userSuggestions.length > 0 && (
                  <div role="listbox" className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto z-50 divide-y divide-gray-50">
                    {userSuggestions.map(u => (
                      <button 
                        key={u.id} 
                        type="button" 
                        role="option"
                        aria-selected="false"
                        onClick={() => { setSelectedContributors([...selectedContributors, u]); setContributorInput(""); setUserSuggestions([]); }} 
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-[14px] text-gray-700 flex flex-col cursor-pointer"
                      >
                        <span className="font-semibold">{u.name}</span>
                        <span className="text-[12px] text-gray-400">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={isCreatingProject || !projectTitle.trim()} 
                aria-label={isCreatingProject ? "Création du projet en cours" : "Ajouter un projet"}
                className="bg-[#121212] hover:bg-[#1F1F1F] text-white w-[181px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-70"
              >
                {isCreatingProject ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : "Ajouter un projet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}