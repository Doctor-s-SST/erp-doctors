"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  CalenderIcon,
  ChevronDownIcon,
  HorizontaLDots,
  UserCircleIcon,
} from "../icons/index";
import { ChartPie, FileText, House, LayoutDashboard, MonitorCog, Settings } from 'lucide-react';
import { supabase } from "@/lib/supabase";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  roles?: string[];
  subItems?: {
    name: string;
    path: string;
    roles?: string[];
  }[];
};

const navItems: NavItem[] = [
  // {
  //   icon: <House className="w-5 h-5" />,
  //   name: "Home",
  //   path: "/",
  //   roles: ["admin", "recepcao", "especialista", "painel"],
  // },
  {
    name: "Dashboard",
    icon: <ChartPie className="w-5 h-5" />,
    roles: ["admin"],
    path: "/dashboards/atendimento/"
  },
  {
    name: "Gestão de Filas",
    icon: <MonitorCog className="w-5 h-5" />,
    roles: ["admin", "recepcao", "especialista", "painel"],
    subItems: [
      { name: "Chamada de Senhas", path: "/sistema-filas/senhas-recepcao", roles: ["admin", "recepcao", "painel", "especialista"] },
      { name: "Filas", path: "/sistema-filas/filas", roles: ["admin", "recepcao", "especialista", "painel"] },
      { name: "Painel TV", path: "/painel-senhas", roles: ["admin", "painel"] },
      { name: "Relatórios", path: "/sistema-filas/relatorios", roles: ["admin", "painel", "recepcao"] },
      { name: "Kanban", path: "/sistema-filas/kanban", roles: ["admin"] },
    ],
  },
  {
    name: "Relatórios",
    icon: <FileText className="w-5 h-5" />,
    roles: ["admin", "painel", "recepcao"],
    subItems: [
      { name: "Geral", path: "/sistema-filas/relatorios/geral", roles: ["admin", "painel", "recepcao"] },
      { name: "Pendências de Exames", path: "/sistema-filas/relatorios/geral", roles: ["admin", "painel", "recepcao"] },
      { name: "Especialidades", path: "/sistema-filas/relatorios/geral", roles: ["admin", "painel", "recepcao"] },
    ],
  },
  {
    name: "Configurações",
    icon: <Settings className="w-5 h-5" />,
    roles: ["admin"],
    subItems: [
      { name: "Usuários", path: "/configuracoes/users", roles: ["admin"] },
      { name: "Salas e Profissionais", path: "/configuracoes/salas-profissionais", roles: ["admin"] },
      { name: "Unidade", path: "/configuracoes/unidade", roles: ["admin"] },
    ],
  },
  // {
  //   icon: <CalenderIcon />,
  //   name: "Agenda",
  //   path: "/calendar",
  //   roles: ["admin", "especialista"],
  // },
  // {
  //   icon: <UserCircleIcon />,
  //   name: "Perfil",
  //   path: "/profile",
  // },
];

const AppSidebar: React.FC = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const [openSubmenu, setOpenSubmenu] = useState<{ index: number } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [unidadeLogo, setUnidadeLogo] = useState<string>("");
  const [unidadeIcone, setUnidadeIcone] = useState<string>("");
  const [unidadeNome, setUnidadeNome] = useState<string>("");


  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  // Busca o Role do Banco de Dados
  useEffect(() => {
    async function getRole() {

      // =========================
      // USUÁRIO
      // =========================
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, unidade_id')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          setUserRole(data.role);

          // =========================
          // UNIDADE
          // =========================
          const { data: unidade, error: unidadeError } = await supabase
            .from('unidades')
            .select('nome, logo_url, logo_icone_url')
            .eq('id', data.unidade_id)
            .single();

          if (unidade && !unidadeError) {
            setUnidadeLogo(unidade.logo_url || "");
            setUnidadeIcone(unidade.logo_icone_url || "");
            setUnidadeNome(unidade.nome || "");
          }
        } else {
          setUserRole("user");
        }
      }
    }

    getRole();
  }, []);

  // useMemo evita que a lista seja recriada a cada render, matando o loop infinito
  const filteredNavItems = useMemo(() => {
    return navItems
      .filter((item) => !item.roles || (userRole && item.roles.includes(userRole)))
      .map((item) => ({
        ...item,
        subItems: item.subItems?.filter(
          (sub) => !sub.roles || (userRole && sub.roles.includes(userRole))
        ),
      }))
      .filter((item) => (item.path || (item.subItems && item.subItems.length > 0)));
  }, [userRole]); // Só recalcula se o userRole mudar

  // Efeito para abrir o submenu automaticamente baseado na rota
  useEffect(() => {
    let submenuMatched = false;
    filteredNavItems.forEach((nav, index) => {
      if (nav.subItems?.some(sub => isActive(sub.path))) {
        setOpenSubmenu({ index });
        submenuMatched = true;
      }
    });
    if (!submenuMatched) setOpenSubmenu(null);
  }, [pathname, isActive, filteredNavItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `main-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu((prev) => (prev?.index === index ? null : { index }));
  };

  return (
    <aside className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-2 left-0 bg-white dark:bg-gray-900 text-gray-900 h-screen transition-all duration-300 z-50 border-r border-gray-200 dark:border-gray-800 
      ${isExpanded || isMobileOpen || isHovered ? "w-[250px]" : "w-[50px]"} 
      ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="py-3 my-1 flex justify-center items-center min-h-[70px]">
        <Link href="/" className="flex items-center justify-center">

          {isExpanded || isHovered || isMobileOpen ? (

            unidadeLogo ? (
              <div className="relative w-[200px] h-[100px]">
                <Image
                  src={unidadeLogo}
                  alt={unidadeNome || "Logo"}
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            ) : (
              <div className="h-10 px-4 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black text-sm uppercase">
                {unidadeNome || "UNIDADE"}
              </div>
            )

          ) : (

            unidadeIcone ? (
              <div className="relative w-10 h-10">
                <Image
                  src={unidadeIcone}
                  alt="Ícone"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black">
                {unidadeNome?.charAt(0) || "U"}
              </div>
            )

          )}

        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto no-scrollbar">
        <nav className="mb-6">
          <h2 className={`mb-2 text-xs uppercase text-gray-400 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
            {isExpanded || isHovered || isMobileOpen ? "Menu Principal" : <HorizontaLDots />}
          </h2>

          <ul className="flex flex-col gap-2">
            {filteredNavItems.map((nav, index) => (
              <li key={nav.name}>
                {nav.subItems ? (
                  <>
                    <button
                      onClick={() => handleSubmenuToggle(index)}
                      className={`menu-item group ${openSubmenu?.index === index ? "menu-item-active" : "menu-item-inactive"} cursor-pointer ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
                    >
                      <span className={openSubmenu?.index === index ? "menu-item-icon-active" : "menu-item-icon-inactive"}>{nav.icon}</span>
                      {(isExpanded || isHovered || isMobileOpen) && (
                        <>
                          <span className="menu-item-text">{nav.name}</span>
                          <ChevronDownIcon className={`ml-auto w-5 h-5 transition-transform ${openSubmenu?.index === index ? "rotate-180 text-brand-500" : ""}`} />
                        </>
                      )}
                    </button>
                    <div
                      ref={(el) => { subMenuRefs.current[`main-${index}`] = el; }}
                      className="overflow-hidden transition-all duration-300"
                      style={{ height: openSubmenu?.index === index && (isExpanded || isHovered || isMobileOpen) ? `${subMenuHeight[`main-${index}`]}px` : "0px" }}
                    >
                      <ul className="mt-2 space-y-1 ml-9">
                        {nav.subItems.map((subItem) => (
                          <li key={subItem.name}>
                            <Link href={subItem.path} className={`menu-dropdown-item ${isActive(subItem.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"}`}>
                              {subItem.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  nav.path && (
                    <Link href={nav.path} className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"} ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}>
                      <span className={isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}>{nav.icon}</span>
                      {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
                    </Link>
                  )
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;