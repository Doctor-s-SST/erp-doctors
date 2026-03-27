"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User, Settings, LifeBuoy, LogOut, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function UserDropdown() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/signin");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-12 flex items-center justify-end gap-3 px-2 hover:bg-transparent">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src="/images/user/owner.jpg" alt="User" />
            <AvatarFallback>GC</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left">
            <p className="text-sm font-medium leading-none">Gabriel Carvalho</p>
            <p className="text-xs leading-none text-muted-foreground mt-1">gabriel@doctors.com</p>
          </div>
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-56 mt-5" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Minha Conta</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LifeBuoy className="mr-2 h-4 w-4" />
          <span>Suporte</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}