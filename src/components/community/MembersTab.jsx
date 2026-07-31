import React from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const roleStyles = {
  owner: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  moderator: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  member: "bg-stone-100 text-stone-600 hover:bg-stone-100",
};

export default function MembersTab({ members }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-sm font-semibold">
              {(m.user_name || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-medium text-stone-900">{m.user_name}</p>
              <p className="text-xs text-stone-400">Joined {format(new Date(m.created_date), "MMM yyyy")}</p>
            </div>
          </div>
          <Badge className={roleStyles[m.role] || roleStyles.member}>{m.role}</Badge>
        </div>
      ))}
    </div>
  );
}