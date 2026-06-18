"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import Link from "next/link";
import Cookies from "js-cookie";

interface UserSuggestion {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  owner: any;
  contributors?: any[];
  members?: any[];
  tasks?: any[]; 
}

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // États de la modale de création de projet
  const [showProjectModale, setShowProjectModale] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [contributorInput, setContributorInput] = useState("");
  const [selectedContributors, setSelectedContributors] = useState<UserSuggestion[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  /**
   * Génère les initiales d'un utilisateur pour l'affichage des avatars.
   * Gère les formats "Prénom Nom", prénom simple, et extraction depuis l'email.
   */
  const getInitials = (userObj: any) => {
    if (!userObj) return "?";
    const fullName = userObj.name || userObj.username;
    if (fullName && fullName.trim().includes(" ")) {
      const parts = fullName.trim().split(/\s+/);
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (fullName) return fullName.substring(0, 2).toUpperCase();
    const email = userObj.email || (typeof userObj === "string" ? userObj : "");
    if (email) {
      const namePart = email.split("@")[0];
      if (namePart.includes(".")) {
        const parts = namePart.split(".");
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return namePart.substring(0, 2).toUpperCase();
    }
    return "?";
  };

  /**
   * Charge les données de la page : profil utilisateur (pour le rôle) et liste des projets.
   * Enrichit chaque projet avec ses tâches associées pour calculer la progression.
   */
  const loadData = async () => {
    const token = Cookies.get("abricot_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    const cleanToken = decodeURIComponent(token).replace(/^"|"$/g, '');

    try {
      // 1. Récupération de l'email courant pour définir qui est "Propriétaire" ou "Contributeur"
      const profileRes = await fetch("/api/auth/profile", { headers: { "Authorization": `Bearer ${cleanToken}` } });
      let currentEmail = "";
      if (profileRes.ok) {
        const prof = await profileRes.json();
        currentEmail = prof.data?.user?.email || prof.user?.email || "";
        setUserEmail(currentEmail);
      }

      // 2. Récupération des projets
      const res = await fetch("/api/projects", { headers: { "Authorization": `Bearer ${cleanToken}` } });
      if (res.ok) {
        const json = await res.json();
        const projectsArray = json.data?.projects || json.projects || json.data || json;
        
        // 3. Hydratation des projets avec leurs tâches respectives via Promise.all pour la perf
        if (Array.isArray(projectsArray)) {
          const projectsWithTasks = await Promise.all(
            projectsArray.map(async (project: any) => {
              const projId = project.id || project._id;
              try {
                const tasksRes = await fetch(`/api/projects/${projId}/tasks`, {
                  headers: { "Authorization": `Bearer ${cleanToken}` }
                });
                if (tasksRes.ok) {
                  const tasksJson = await tasksRes.json();
                  const tasks = tasksJson.data?.tasks || tasksJson.data || tasksJson || [];
                  return { ...project, id: projId, tasks: Array.isArray(tasks) ? tasks : [] };
                }
              } catch (e) {
                console.error(e);
              }
              return { ...project, id: projId, tasks: [] };
            })
          );
          setProjects(projectsWithTasks);
        }
      }
    } catch (e) {
      console.error("Erreur de chargement des projets:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Recherche dynamique d'utilisateurs pour l'invitation au projet.
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
          // Filtrer ceux qui sont déjà sélectionnés
          setUserSuggestions(arr.filter(u => !selectedContributors.some(s => s.email === u.email)));
        }
      }
    } catch (e) {
      console.error("Erreur recherche utilisateur:", e);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  /**
   * Soumission du formulaire de création d'un projet.
   */
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
        loadData(); 
      }
    } catch (error) {
      console.error("Erreur création de projet:", error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 min-h-[50vh]" aria-live="polite" aria-busy="true">
        <Loader2 className="w-5 h-5 animate-spin text-[#D3590B]" aria-hidden="true" />
        <span className="font-sans font-normal text-[14px] text-gray-500">Chargement de vos projets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full mx-auto pb-20">
      
      {/* HEADER DE LA PAGE PROJETS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-semibold text-[24px] text-gray-900">Mes projets</h1>
          <p className="font-sans font-normal text-[18px] text-black mt-1">Gérez vos projets</p>
        </div>
        <button 
          onClick={() => setShowProjectModale(true)} 
          aria-haspopup="dialog"
          className="bg-[#121212] hover:bg-black text-white w-[181px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors shadow-sm flex items-center justify-center gap-1.5"
        >
          + Créer un projet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          // Détermination du rôle de l'utilisateur courant sur ce projet
          const ownerEmail = typeof project.owner === "object" ? project.owner?.email : project.owner;
          const isOwner = ownerEmail?.toLowerCase() === userEmail?.toLowerCase();
          const roleLabel = isOwner ? "Propriétaire" : "Contributeur";

          // Aplatissement et déduplication des contributeurs pour l'affichage de l'équipe
          let rawContributors: any[] = [];
          if (Array.isArray(project.contributors)) {
            rawContributors = project.contributors;
          } else if (Array.isArray(project.members)) {
            rawContributors = project.members.filter(m => m.role !== "OWNER").map(m => m.user || m);
          }
          
          const uniqueContributors = rawContributors.reduce((acc, current) => {
            const email = current.email || (typeof current === "string" ? current : "");
            if (email && !acc.find((item: any) => (item.email || item) === email)) {
              acc.push(current);
            }
            return acc;
          }, []);

          // Statistiques du projet
          const teamSize = 1 + uniqueContributors.length; // +1 inclut le owner
          const totalTasks = project.tasks?.length || 0;
          const completedTasks = project.tasks?.filter(t => 
            t.status?.toLowerCase() === "done" || 
            t.status?.toLowerCase() === "terminée" || 
            t.status?.toLowerCase() === "completed"
          ).length || 0;
          const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return (
            <Link 
              href={`/projects/${project.id}`} 
              key={project.id} 
              aria-label={`Ouvrir le projet ${project.name}`}
              className="bg-white border border-gray-100 rounded-[10px] p-6 shadow-sm flex flex-col justify-between min-h-[260px] transition-all hover:border-gray-200 group cursor-pointer text-left"
            >
              <div className="space-y-2">
                <h3 className="font-heading font-semibold text-[18px] text-gray-900 group-hover:text-black transition-colors line-clamp-1" title={project.name}>
                  {project.name}
                </h3>
                <p className="font-sans font-normal text-[14px] text-[#6B7280] leading-[21px] h-[42px] line-clamp-2">
                  {project.description || "Aucune description renseignée."}
                </p>
              </div>

              {/* SECTION PROGRESSION avec rôles d'accessibilité (progressbar) */}
              <div className="space-y-1.5 mt-6 mb-4">
                <div className="flex items-center justify-between font-sans font-normal text-[12px] text-[#6B7280] mb-1">
                  <span>Progression</span>
                  <span className="font-semibold text-gray-800">{progressPercent}%</span>
                </div>
                <div 
                  className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="bg-[#D3590B] h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="font-sans font-normal text-[10px] text-[#6B7280] pt-1">
                  {completedTasks}/{totalTasks} tâches terminées
                </div>
              </div>

              <div className="space-y-3 mt-auto pt-4 border-t border-gray-50">
                <div className="font-sans font-normal text-[10px] text-[#6B7280] flex items-center gap-1.5">
                  <span className="text-gray-400">
                    <svg width="12" height="11" viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M7.52637 6.94727C9.78424 6.94727 11.579 8.74215 11.5791 11H3.47363C3.47372 8.74222 5.2686 6.94738 7.52637 6.94727ZM3.87891 5.21094C4.11047 5.73187 4.45811 6.19468 4.86328 6.54199C3.99485 7.06305 3.2998 7.81614 2.89453 8.68457H0C0 6.77405 1.56313 5.21099 3.47363 5.21094H3.87891ZM7.52637 0.579102C9.12507 0.579102 10.4208 1.87494 10.4209 3.47363C10.4209 5.07238 9.12511 6.36816 7.52637 6.36816C5.92769 6.36809 4.63184 5.07233 4.63184 3.47363C4.63189 1.87499 5.92772 0.579177 7.52637 0.579102ZM3.47363 0C3.99467 0 4.45802 0.173434 4.86328 0.462891C3.99488 1.15761 3.47367 2.25787 3.47363 3.47363C3.47363 3.8789 3.53167 4.28446 3.64746 4.63184H3.47363C2.19994 4.63182 1.1582 3.58913 1.1582 2.31543C1.15843 1.04192 2.20008 1.19457e-05 3.47363 0Z" fill="currentColor"/>
                    </svg>
                  </span> 
                  Équipe ({teamSize})
                </div>
                
                <div className="flex items-center gap-2">
                  <div aria-hidden="true" className={`h-7 w-7 rounded-full font-sans font-normal text-[10px] text-black flex items-center justify-center uppercase shrink-0 ${isOwner ? 'bg-[#FFE8D9]' : 'bg-[#E5E7EB]'}`}>
                    {getInitials(project.owner || ownerEmail)}
                  </div>
                  
                  <span className={`w-[109px] h-[25px] flex items-center justify-center rounded-[50px] font-sans font-normal text-[14px] shrink-0 ${isOwner ? 'bg-[#FFE8D9] text-[#D3590B]' : 'bg-[#E5E7EB] text-[#6B7280]'}`}>
                    {roleLabel}
                  </span>
                  
                  <div className="flex items-center -space-x-2 ml-1">
                    {uniqueContributors.slice(0, 3).map((contrib: any, idx: number) => {
                      const isMe = contrib.email?.toLowerCase() === userEmail?.toLowerCase();
                      return (
                        <div 
                          key={idx} 
                          className={`h-7 w-7 rounded-full border-2 border-white flex items-center justify-center font-sans font-normal text-[10px] text-black uppercase relative z-10 ${isMe ? 'bg-[#FFE8D9]' : 'bg-[#E5E7EB]'}`} 
                          title={typeof contrib === "string" ? contrib : contrib.email}
                        >
                          {getInitials(contrib)}
                        </div>
                      )
                    })}
                    {uniqueContributors.length > 3 && (
                      <div aria-label={`+ ${uniqueContributors.length - 3} autres contributeurs`} className="h-7 w-7 rounded-full bg-gray-50 text-gray-400 font-sans font-normal text-[10px] flex items-center justify-center border-2 border-white relative z-10">
                        +{uniqueContributors.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* MODALE CRÉATION PROJET */}
      {showProjectModale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="modal-project-title">
          <form onSubmit={handleCreateProject} className="bg-white rounded-[10px] max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button 
              type="button" 
              onClick={() => { setShowProjectModale(false); setSelectedContributors([]); }} 
              aria-label="Fermer la fenêtre de création"
              className="absolute top-5 right-5 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5 stroke-[1.5]" aria-hidden="true" />
            </button>
            <h3 id="modal-project-title" className="font-heading font-semibold text-[24px] text-gray-900">Créer un projet</h3>
            
            <div className="space-y-4 mt-4">
              <div className="space-y-1">
                <label htmlFor="projectTitle" className="font-sans font-normal text-[14px] text-gray-800">Titre*</label>
                <input 
                  id="projectTitle"
                  type="text" 
                  required 
                  value={projectTitle} 
                  onChange={(e) => setProjectTitle(e.target.value)} 
                  className="w-full bg-white text-[14px] border border-gray-200 px-3 py-2.5 rounded-lg outline-none focus:border-orange-300" 
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
                  className="w-full bg-white text-[14px] border border-gray-200 px-3 py-2.5 rounded-lg outline-none resize-none focus:border-orange-300" 
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
                          aria-label={`Retirer ${c.name} des contributeurs`}
                          onClick={() => setSelectedContributors(selectedContributors.filter(sc => sc.email !== c.email))} 
                          className="text-orange-500 hover:bg-orange-100 rounded-full p-0.5"
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
                    className="w-full bg-white text-[14px] border border-gray-200 px-3 py-2.5 rounded-lg outline-none focus:border-orange-300" 
                  />
                  {isSearchingUsers && <Loader2 className="w-4 h-4 animate-spin text-orange-500 absolute right-3 top-2.5" aria-hidden="true" />}
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
                className="bg-[#121212] hover:bg-black text-white w-[181px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-70"
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