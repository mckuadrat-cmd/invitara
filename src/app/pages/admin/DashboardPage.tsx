import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { Users, UserCheck, CheckCircle, TrendingUp, Activity, ScanLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabaseClient";

type GuestAgg = {
  status: "registered" | "confirmed" | "checked_in";
  checkin_time: string | null;
  organization: string | null;
};

import { mockAnalytics, mockActivities } from '../../lib/mockData';


type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  location: string | null;
};

type GuestMini = {
  id: string;
  full_name: string;
  organization: string | null;
  unique_code: string;
  status: "registered" | "confirmed" | "checked_in";
  checkin_time: string | null;
  created_at?: string | null;
};

export default function DashboardPage() {
  const { eventId } = useParams();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventRow | null>(null);

  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalConfirmed, setTotalConfirmed] = useState(0);
  const [totalCheckedIn, setTotalCheckedIn] = useState(0);

  const [hourly, setHourly] = useState<{ hour: string; count: number }[]>([]);
  const [peakTime, setPeakTime] = useState<string>("—");

  const [activities, setActivities] = useState<
    { id: string; type: "check-in" | "confirm"; message: string; time: string }[]
  >([]);

  const checkinRate = useMemo(() => {
    const denom = Math.max(totalConfirmed, 1);
    return Math.round((totalCheckedIn / denom) * 100);
  }, [totalCheckedIn, totalConfirmed]);

  async function loadEvent() {
    if (!eventId) return;
    const { data, error } = await supabase
      .from("events")
      .select("id,name,event_date,location")
      .eq("id", eventId)
      .single();

    if (!error && data) setEvent(data as EventRow);
  }

  async function loadStats() {
    if (!eventId) return;

    // registered: all guests rows
    const reg = await supabase
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    // confirmed
    const conf = await supabase
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("status", ["confirmed", "checked_in"]);

    // checked in
    const chk = await supabase
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "checked_in");

    setTotalRegistered(reg.count ?? 0);
    setTotalConfirmed(conf.count ?? 0);
    setTotalCheckedIn(chk.count ?? 0);
  }

  async function loadRecentActivity() {
    if (!eventId) return;

    // 10 check-in terbaru
    const { data } = await supabase
      .from("guests")
      .select("id,full_name,organization,checkin_time,status")
      .eq("event_id", eventId)
      .eq("status", "checked_in")
      .order("checkin_time", { ascending: false })
      .limit(10);

    const list = (data ?? []).map((g: any) => {
      const t = g.checkin_time ? new Date(g.checkin_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";
      return {
        id: g.id,
        type: "check-in" as const,
        message: `${g.full_name}${g.organization ? ` (${g.organization})` : ""} checked in`,
        time: t,
      };
    });

    setActivities(list);
  }

    async function loadAggData() {
      if (!eventId) return;
  
      // Ambil field minimum, lalu agregasi di client.
      // Untuk event kecil/menengah ini aman.
      const { data, error } = await supabase
        .from("guests")
        .select("status,checkin_time,organization")
        .eq("event_id", eventId)
        .limit(10000);
  
      if (error) return;
  
      const rows = (data ?? []) as GuestAgg[];
  
      // hourly checkins
      const hm = new Map<string, number>();
      for (const r of rows) {
        if (r.status === "checked_in" && r.checkin_time) {
          const d = new Date(r.checkin_time);
          const hour = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).slice(0, 2) + ":00";
          hm.set(hour, (hm.get(hour) ?? 0) + 1);
        }
      }
  
      const hourlyArr = Array.from(hm.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour));
  
      setHourly(hourlyArr);
  
      // peak time
      if (hourlyArr.length) {
        const peak = hourlyArr.reduce((p, c) => (c.count > p.count ? c : p), hourlyArr[0]);
        setPeakTime(peak.hour);
      } else {
        setPeakTime("—");
      }
    }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadEvent(), loadStats(), loadRecentActivity(), loadAggData()]); 
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Realtime update: kalau ada UPDATE guest status jadi checked_in, refresh stats + activity
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`dash-${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const newRow: any = payload.new;
          if (newRow?.status === "checked_in") {
            loadStats();
            loadRecentActivity();
            loadAggData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const stats = [
    {
      title: "Total Registered",
      value: totalRegistered,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Confirmed",
      value: totalConfirmed,
      icon: UserCheck,
      color: "text-[#D6C6A5]",
      bgColor: "bg-[#D6C6A5]/10",
    },
    {
      title: "Total Checked In",
      value: totalCheckedIn,
      icon: CheckCircle,
      color: "text-[#22C55E]",
      bgColor: "bg-[#22C55E]/10",
    },
    {
      title: "Check-in Rate",
      value: `${checkinRate}%`,
      icon: TrendingUp,
      color: "text-[#F59E0B]",
      bgColor: "bg-[#F59E0B]/10",
    },
  ];

  if (!eventId) return <div className="p-4">Missing eventId in route.</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-[#0F1C2E] mb-2">Dashboard Overview</h1>
        <p className="text-gray-600">
          {event ? (
            <>
              <span className="font-medium text-[#0F1C2E]">{event.name}</span>
              {event.location ? <> • {event.location}</> : null}
              {event.event_date ? <> • {new Date(event.event_date).toLocaleString("id-ID")}</> : null}
            </>
          ) : (
            "Loading event..."
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">{stat.title}</p>
                    <p className="text-3xl text-[#0F1C2E]">{loading ? "…" : stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} ${stat.color} p-3 rounded-xl`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Feed and Quick Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Real-time Activity Feed */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
              <Activity className="w-5 h-5 text-[#D6C6A5]" />
              Real-time Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 bg-[#F5F7FA] rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className={`
                    w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                    ${activity.type === 'check-in' ? 'bg-[#22C55E]' : 'bg-[#D6C6A5]'}
                  `} />                  
                  <div className="flex-1"> 
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#0F1C2E]">{activity.message}</span>
                    <span className="text-sm text-gray-500 ">{activity.time}</span>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Peak Time Card */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
              <TrendingUp className="w-5 h-5 text-[#D6C6A5]" />
              Check-in Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-[#0F1C2E] to-[#0F1C2E]/80 p-6 rounded-xl text-white">
                <p className="text-sm text-[#D6C6A5] mb-2">Peak Arrival Time</p>
                <p className="text-3xl">{peakTime}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-3">Hourly Check-ins</p>
                <div className="space-y-3">
                  {hourly.slice(0, 4).map((item) => (
                    <div key={item.hour}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.hour}</span>
                        <span className="text-[#0F1C2E]">{item.count} guests</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#D6C6A5] to-[#D6C6A5]/70 rounded-full"
                          style={{ width: `${(item.count / 45) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-none shadow-lg mt-6">
        <CardHeader>
          <CardTitle className="text-[#0F1C2E]">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to={`/admin/event/${eventId}/guests`} className="p-4 bg-[#0F1C2E] text-white rounded-xl hover:bg-[#0F1C2E]/90 transition-colors text-left">
            <button>
              <Users className="w-6 h-6 mb-2 text-[#D6C6A5]" />
              <p className="text-sm">View All Guests</p>
            </button>
            </Link>
            <Link to={`/admin/event/${eventId}/scanner`}  className="p-4 bg-[#D6C6A5] text-[#0F1C2E] rounded-xl hover:bg-[#D6C6A5]/50 transition-colors text-left">
            <button>
              <CheckCircle className="w-6 h-6 mb-2" />
              <p className="text-sm">Start Check-in</p>
            </button>
            </Link>
            <Link to={`/admin/event/${eventId}/analytics`}  className="p-4 bg-[#F5F7FA] text-[#0F1C2E] rounded-xl hover:bg-gray-200 transition-colors text-left">
            <button>
              <TrendingUp className="w-6 h-6 mb-2 text-[#D6C6A5]" />
              <p className="text-sm">View Analytics</p>
            </button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}