"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function ProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // États liés aux informations d'identité
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // États liés à la sécurité (modification du mot de passe)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // États pour la visibilité (UI) des champs de mot de passe
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /**
   * Récupération des données du profil au montage.
   * Parse le nom complet stocké en base pour pré-remplir les champs prénom/nom distincts.
   */
  useEffect(() => {
    const fetchProfile = async () => {
      const token = Cookies.get("abricot_token");
      if (!token) {
        setIsLoading(false);
        return;
      }
      const cleanToken = decodeURIComponent(token).replace(/^"|"$/g, '');

      try {
        const res = await fetch("/api/auth/profile", {
          headers: { "Authorization": `Bearer ${cleanToken}` }
        });
        if (res.ok) {
          const json = await res.json();
          const user = json.data?.user || json.user || {};
          
          const fullName = user.name || user.username || "";
          const parts = fullName.trim().split(/\s+/);
          
          setFirstName(user.firstName || parts[0] || "");
          setLastName(user.lastName || parts.slice(1).join(" ") || "");
          setEmail(user.email || "");
        }
      } catch (e) {
        console.error("Erreur de récupération du profil:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  /**
   * Orchestration de la mise à jour du profil.
   * Gère deux flux distincts : la mise à jour des infos générales, et conditionnellement la mise à jour du mot de passe.
   */
  const handleUpdateProfile: React.SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    const token = Cookies.get("abricot_token");
    const cleanToken = decodeURIComponent(token || "").replace(/^"|"$/g, '');

    try {
      // 1️⃣ MISE À JOUR DU PROFIL (Informations générales)
      const profilePayload = {
        name: `${firstName} ${lastName}`.trim(),
        email: email
      };

      const profileRes = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${cleanToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profilePayload)
      });

      if (!profileRes.ok) {
        throw new Error("Erreur lors de la mise à jour des informations.");
      }

      // 2️⃣ MISE À JOUR DU MOT DE PASSE (Déclenchée uniquement si un champ est rempli)
      if (currentPassword || newPassword || confirmPassword) {
        if (!currentPassword || !newPassword || !confirmPassword) {
          setMessage({ text: "Veuillez remplir l'ancien mot de passe, le nouveau, et la confirmation.", type: "error" });
          setIsSaving(false);
          return;
        }

        if (newPassword !== confirmPassword) {
          setMessage({ text: "Les nouveaux mots de passe ne correspondent pas.", type: "error" });
          setIsSaving(false);
          return;
        }

        const passwordRes = await fetch("/api/auth/password", {
          method: "PUT",
          headers: { 
            "Authorization": `Bearer ${cleanToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            currentPassword: currentPassword,
            newPassword: newPassword
          })
        });

        if (!passwordRes.ok) {
          const errorData = await passwordRes.json();
          setMessage({ text: errorData.message || "Ancien mot de passe incorrect.", type: "error" });
          setIsSaving(false);
          return;
        }
      }

      // 3️⃣ SUCCÈS GLOBAL (Validation finale)
      setMessage({ text: "Vos informations ont été mises à jour avec succès.", type: "success" });
      setCurrentPassword(""); 
      setNewPassword(""); 
      setConfirmPassword(""); 
      
      setTimeout(() => {
        window.location.reload(); 
      }, 1500);

    } catch (e: any) {
      console.error(e);
      setMessage({ text: e.message || "Une erreur est survenue.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center min-h-[50vh] items-center"><Loader2 className="w-5 h-5 animate-spin text-[#D3590B]" aria-hidden="true" /></div>;

  return (
    <div className="w-full mx-auto">
      <div className="bg-white border border-gray-100 rounded-[10px] p-8 md:p-10 shadow-sm w-full">
        
        <h1 className="font-heading font-semibold text-[18px] text-gray-900">Mon compte</h1>
        <p className="font-sans font-normal text-[14px] text-gray-500 mt-1">
          {firstName} {lastName}
        </p>

        <form onSubmit={handleUpdateProfile} className="mt-10 space-y-6 max-w-3xl">
          
          <div className="flex flex-col gap-1">
            <label htmlFor="lastName" className="font-sans font-normal text-[14px] text-gray-800">Nom</label>
            <input 
              id="lastName"
              type="text" 
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-white text-[14px] border border-gray-200 px-4 py-3 rounded-[10px] outline-none focus:border-[#D3590B] transition-colors" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="firstName" className="font-sans font-normal text-[14px] text-gray-800">Prénom</label>
            <input 
              id="firstName"
              type="text" 
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-white text-[14px] border border-gray-200 px-4 py-3 rounded-[10px] outline-none focus:border-[#D3590B] transition-colors" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="font-sans font-normal text-[14px] text-gray-800">Email</label>
            <input 
              id="email"
              type="email" 
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white text-[14px] border border-gray-200 px-4 py-3 rounded-[10px] outline-none focus:border-[#D3590B] transition-colors" 
            />
          </div>

          {/* SECTION MOT DE PASSE */}
          <div className="pt-6 border-t border-gray-100 space-y-6">
            <h3 className="font-sans font-normal text-[16px] text-gray-800">Modifier le mot de passe</h3>
            
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <label htmlFor="currentPassword" className="font-sans font-normal text-[14px] text-gray-800">Ancien mot de passe</label>
                <div className="relative">
                  <input 
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"} 
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white text-[14px] border border-gray-200 px-4 py-3 pr-10 rounded-[10px] outline-none focus:border-[#D3590B] transition-colors" 
                  />
                  <button 
                    type="button"
                    aria-label={showCurrent ? "Masquer l'ancien mot de passe" : "Afficher l'ancien mot de passe"}
                    onMouseDown={() => setShowCurrent(true)}
                    onMouseUp={() => setShowCurrent(false)}
                    onMouseLeave={() => setShowCurrent(false)}
                    onTouchStart={() => setShowCurrent(true)}
                    onTouchEnd={() => setShowCurrent(false)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showCurrent ? <Eye aria-hidden="true" className="w-4 h-4" /> : <EyeOff aria-hidden="true" className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                  <label htmlFor="newPassword" className="font-sans font-normal text-[14px] text-gray-800">Nouveau mot de passe</label>
                  <div className="relative">
                    <input 
                      id="newPassword"
                      type={showNew ? "text" : "password"} 
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-white text-[14px] border border-gray-200 px-4 py-3 pr-10 rounded-[10px] outline-none focus:border-[#D3590B] transition-colors" 
                    />
                    <button 
                      type="button"
                      aria-label={showNew ? "Masquer le nouveau mot de passe" : "Afficher le nouveau mot de passe"}
                      onMouseDown={() => setShowNew(true)}
                      onMouseUp={() => setShowNew(false)}
                      onMouseLeave={() => setShowNew(false)}
                      onTouchStart={() => setShowNew(true)}
                      onTouchEnd={() => setShowNew(false)}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showNew ? <Eye aria-hidden="true" className="w-4 h-4" /> : <EyeOff aria-hidden="true" className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="confirmPassword" className="font-sans font-normal text-[14px] text-gray-800">Confirmer le nouveau mot de passe</label>
                  <div className="relative">
                    <input 
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"} 
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-white text-[14px] border border-gray-200 px-4 py-3 pr-10 rounded-[10px] outline-none focus:border-[#D3590B] transition-colors" 
                    />
                    <button 
                      type="button"
                      aria-label={showConfirm ? "Masquer la confirmation du mot de passe" : "Afficher la confirmation du mot de passe"}
                      onMouseDown={() => setShowConfirm(true)}
                      onMouseUp={() => setShowConfirm(false)}
                      onMouseLeave={() => setShowConfirm(false)}
                      onTouchStart={() => setShowConfirm(true)}
                      onTouchEnd={() => setShowConfirm(false)}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirm ? <Eye aria-hidden="true" className="w-4 h-4" /> : <EyeOff aria-hidden="true" className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <button 
              type="submit" 
              disabled={isSaving}
              aria-label={isSaving ? "Sauvegarde en cours" : "Modifier les informations du profil"}
              className="bg-[#121212] hover:bg-black text-white w-[242px] h-[50px] rounded-[10px] font-sans font-normal text-[16px] transition-colors shadow-sm flex items-center justify-center shrink-0 disabled:opacity-70"
            >
              {isSaving ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> : "Modifier les informations"}
            </button>
            
            {message && (
              <span 
                role="alert" 
                aria-live="polite" 
                className={`text-[14px] font-sans font-normal ${message.type === "success" ? "text-green-600" : "text-red-500"}`}
              >
                {message.text}
              </span>
            )}
          </div>
          
        </form>
      </div>
    </div>
  );
}