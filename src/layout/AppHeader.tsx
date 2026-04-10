"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSidebar } from "@/context/SidebarContext";
import { supabase } from "@/lib/supabase";
import { Hospital, MenuIcon, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

type ProfileType = {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);

  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [unidadeNome, setUnidadeNome] = useState<string>("");
  const [profileData, setProfileData] = useState<ProfileType>({
    email: "",
    first_name: "",
    last_name: "",
    role: ''
  });
  const [listaUnidades, setListaUnidades] = useState<{ id: string, nome: string }[]>([]);

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  useEffect(() => {
    const fetchUserContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select(`email, first_name, last_name, role, unidade_id, unidades (nome)`)
          .eq('id', user.id)
          .single();

        if (profile) {
          setProfileData({
            email: profile.email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            role: profile.role
          });

          // 1. Se for admin, busca TODAS as unidades (independente de ter salvo no local)
          if (profile.role === 'admin') {
            const { data: unidades } = await supabase.from('unidades').select('id, nome');
            if (unidades) {
              setListaUnidades(unidades);

              // 2. Tenta recuperar a unidade do storage, se não existir, usa a do perfil
              const salvaLocal = localStorage.getItem('unidade_ativa_id');
              const idParaUsar = salvaLocal || profile.unidade_id;

              setUnidadeId(idParaUsar);

              const atual = unidades.find(u => u.id === idParaUsar);
              setUnidadeNome(atual?.nome || (profile.unidades as any)?.nome || "");
            }
          } else {
            // Se não for admin, segue o fluxo normal
            setUnidadeId(profile.unidade_id);
            setUnidadeNome((profile.unidades as any)?.nome || "");
          }
        }
      }
    };

    fetchUserContext();
  }, []);

  const handleTrocarUnidade = (novaUnidadeId: string) => {
    const unidadeSelecionada = listaUnidades.find(u => u.id === novaUnidadeId);
    setUnidadeId(novaUnidadeId);
    setUnidadeNome(unidadeSelecionada?.nome || "");
    localStorage.setItem('unidade_ativa_id', novaUnidadeId);

    toast.success(`Unidade alterada para ${unidadeSelecionada?.nome}`);

    window.location.reload();
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };
  // const inputRef = useRef<HTMLInputElement>(null);

  // useEffect(() => {
  //   const handleKeyDown = (event: KeyboardEvent) => {
  //     if ((event.metaKey || event.ctrlKey) && event.key === "k") {
  //       event.preventDefault();
  //       inputRef.current?.focus();
  //     }
  //   };

  //   document.addEventListener("keydown", handleKeyDown);

  //   return () => {
  //     document.removeEventListener("keydown", handleKeyDown);
  //   };
  // }, []);

  return (
    <header className="sticky top-0 flex w-full h-[50px] bg-white border-gray-200 z-50 dark:border-gray-800 dark:bg-gray-900 lg:border-b">
      {/* Adicionamos "relative" aqui para que o absolute do texto se baseie no header inteiro */}
      <div className="relative flex flex-col items-center justify-between grow lg:flex-row lg:px-6 w-full">

        {/* LADO ESQUERDA: Botão de Menu */}
        <div className="flex items-center justify-between w-full gap-2 px-3 border-b border-gray-200 dark:border-gray-800 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
          <button
            className="items-center justify-center w-8 h-8 text-gray-500 border-gray-200 rounded-lg z-50 dark:border-gray-800 lg:flex dark:text-gray-400 lg:h-9 lg:w-9 lg:border"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            <MenuIcon className="lg:w-5 lg:h-5" />
          </button>

          {/* Botão para Mobile (Aparece apenas em telas pequenas) */}
          <button
            onClick={toggleApplicationMenu}
            className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg z-50 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* CENTRO: Nome da Unidade (Sempre centralizado) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          {profileData.role === 'admin' ? (
            <div className="flex flex-col items-center gap-1">
              {/* Se for admin, o Select já serve como o "Título" */}
              <Select value={unidadeId || ""} onValueChange={handleTrocarUnidade}>
                <SelectTrigger className="h-8 border-none bg-transparent font-bold text-lg focus:ring-0 shadow-none pointer-events-auto">
                  <Hospital className="w-4 h-4 mr-2 text-emerald-500" />
                  <SelectValue placeholder="Trocar Unidade" />
                </SelectTrigger>
                <SelectContent>
                  {listaUnidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>

                  ))}
                </SelectContent>
              </Select>
            </div>

          ) : (
            <p className="text-sm lg:text-2xl font-bold text-gray-800 dark:text-white">
              {unidadeNome}
            </p>
          )}
        </div>
        {/* LADO DIREITO: User Dropdown e Tema */}
        <div
          className={`${isApplicationMenuOpen ? "flex" : "hidden"} items-center justify-between w-full gap-4 px-5 lg:flex shadow-theme-md lg:justify-end lg:px-0 lg:shadow-none bg-white dark:bg-black lg:bg-transparent`}
        >
          <div className="flex items-center gap-2 2xsm:gap-3">
            <ThemeToggleButton />
          </div>
          <UserDropdown profile={profileData} />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
