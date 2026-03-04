import { Outlet, Link, useLocation, useParams, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  BarChart3,
  Settings,
  Menu,
  X,
  CalendarDays,
  MonitorPlay,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabaseClient";

type GlobalRole = "owner" | "admin" | "scanner";

export default function AdminLayout() {
  const location = useLocation();
  const { eventId } = useParams();
  const nav = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [role, setRole] = useState<GlobalRole>("admin");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();

      if (!prof?.role) return;
        setRole(prof.role as GlobalRole);
    })();
  }, []);

  const baseEventPath = useMemo(() => {
    return eventId ? `/admin/event/${eventId}` : null;
  }, [eventId]);

  const navigation = useMemo(() => {
    const items: { name: string; href: string; icon: any }[] = [];

    // OWNER: bisa lihat list semua events
    if (role === "owner") {
      items.push({ name: "Events", href: "/admin/events", icon: CalendarDays });
    }

    if (baseEventPath && eventId) {
      items.push(
        { name: "Dashboard", href: `${baseEventPath}/dashboard`, icon: LayoutDashboard },
        { name: "Guest List", href: `${baseEventPath}/guests`, icon: Users },
        { name: "Scanner (Admin)", href: `${baseEventPath}/scanner`, icon: ScanLine },

        // big screen
        { name: "Screen", href: `/screen/${eventId}`, icon: MonitorPlay },

        { name: "Analytics", href: `${baseEventPath}/analytics`, icon: BarChart3 },

        { name: "Staff", href: `${baseEventPath}/staff`, icon: Users } // atau icon lain 
      );

      // OWNER: settings event
      if (role === "owner") {
        items.push({ name: "Settings", href: `${baseEventPath}/settings`, icon: Settings });
      }
    }

    return items;
  }, [baseEventPath, eventId, role]);

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href);
  };

  async function logout() {
    await supabase.auth.signOut();
    nav("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-[#0F1C2E] text-white z-40 transform transition-transform duration-300
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="block">
            <img src="/Invitara white.png" alt="Invitara" className="h-auto w-50" />
            <p className="text-sm text-gray-400 mt-1">Smart Event Invitation System</p>
          </Link>
        </div>

        <nav className="p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                  ${
                    active
                      ? "bg-[#D6C6A5]/10 text-[#D6C6A5] border border-[#D6C6A5]/20"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/10 space-y-3">
          <div className="text-xs text-gray-400">
            <p className="truncate">Role: {role}</p>
            {eventId ? <p className="truncate">Selected Event: {eventId}</p> : <p>Select an event to manage</p>}
          </div>

          <Button
            variant="outline"
            className="w-full border-white/20 text-black hover:bg-white/30"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}