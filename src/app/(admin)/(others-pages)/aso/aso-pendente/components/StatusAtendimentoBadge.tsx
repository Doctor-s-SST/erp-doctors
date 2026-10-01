"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, CircleDot, HelpCircle } from "lucide-react";
import { InfoStatusAtendimento } from "../types";

interface StatusAtendimentoBadgeProps {
    info?: InfoStatusAtendimento;
    className?: string;
}

export function StatusAtendimentoBadge({ info, className = "" }: StatusAtendimentoBadgeProps) {
    if (!info) {
        return (
            <Badge
                variant="outline"
                className={`text-[10px] font-medium py-0.5 px-2 bg-slate-500/10 text-slate-400 border-slate-500/20 ${className}`}
            >
                --
            </Badge>
        );
    }

    const { statusGeral, label, corBadge, detalhesTexto } = info;

    return (
        <Badge
            variant="outline"
            className={`inline-flex items-center gap-1.5 text-[10px] font-semibold py-1 px-2.5 rounded-full transition-all cursor-help select-none ${corBadge} ${className}`}
            title={detalhesTexto || label}
        >
            {statusGeral === "FINALIZADO" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
            {statusGeral === "EM_ATENDIMENTO" && (
                <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse shrink-0" />
            )}
            {statusGeral === "AGUARDANDO" && (
                <CircleDot className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            {statusGeral === "SEM_ATENDIMENTO" && (
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className="whitespace-nowrap">{label}</span>
        </Badge>
    );
}
