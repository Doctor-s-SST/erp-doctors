"use client";

import UserAddressCard from "@/components/user-profile/UserAddressCard";
import UserInfoCard from "@/components/user-profile/UserInfoCard";
import UserMetaCard from "@/components/user/user-profile/UserMetaCard";
import { supabase } from "@/lib/supabase";
import React, { useEffect } from "react";


type ProfileType = {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  especialidade: { nome: string }
};

export default function Profile() {
  const [profileData, setProfileData] = React.useState<ProfileType>({
    email: "",
    first_name: "",
    last_name: "",
    role: "",
    especialidade: { nome: "" }
  });

  useEffect(() => {
    const fetchUserContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select(`email, first_name, last_name, role, especialidade_id`)
          .eq('id', user.id)
          .single();

        let nomeEspecialidade = "";

        if (profile?.especialidade_id) {
          const { data: esp } = await supabase
            .from("especialidades")
            .select("nome")
            .eq("id", profile.especialidade_id)
            .single();

          nomeEspecialidade = esp?.nome || "";
        }
        console.log("Profile: ", profile);

        if (profile) {
          setProfileData({
            email: profile.email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            role: profile.role,
            especialidade: { nome: nomeEspecialidade }
          });

        }
      }
    };

    fetchUserContext();
  }, []);

  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Perfil
        </h3>
        <div className="space-y-6">
          <UserMetaCard profile={profileData} />
          {/* <UserInfoCard />
          <UserAddressCard /> */}
        </div>
      </div>
    </div>
  );
}
