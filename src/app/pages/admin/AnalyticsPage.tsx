import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { TrendingUp, Users, Building, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "../../lib/supabaseClient";

type GuestAgg = {
  status: "registered" | "confirmed" | "checked_in";
  checkin_time: string | null;
  organization: string | null;
};

export default function AnalyticsPage() {
  const { eventId } = useParams();

  const [loading, setLoading] = useState(true);

  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalConfirmed, setTotalConfirmed] = useState(0);
  const [totalCheckedIn, setTotalCheckedIn] = useState(0);

  const [hourly, setHourly] = useState<{ hour: string; count: number }[]>([]);
  const [topOrgs, setTopOrgs] = useState<{ name: string; count: number }[]>([]);
  const [peakTime, setPeakTime] = useState<string>("—");

  const checkinRate = useMemo(() => {
    const denom = Math.max(totalConfirmed, 1);
    return Math.round((totalCheckedIn / denom) * 100);
  }, [totalCheckedIn, totalConfirmed]);

  async function loadStatsFast() {
    if (!eventId) return;

    const reg = await supabase
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    const conf = await supabase
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("status", ["confirmed", "checked_in"]);

    const chk = await supabase
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "checked_in");

    setTotalRegistered(reg.count ?? 0);
    setTotalConfirmed(conf.count ?? 0);
    setTotalCheckedIn(chk.count ?? 0);
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

    // top orgs (by checked_in)
    const orgm = new Map<string, number>();
    for (const r of rows) {
      if (r.status === "checked_in") {
        const name = (r.organization ?? "Unknown").trim() || "Unknown";
        orgm.set(name, (orgm.get(name) ?? 0) + 1);
      }
    }

    const orgArr = Array.from(orgm.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    setTopOrgs(orgArr);
  }

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadStatsFast(), loadAggData()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // realtime refresh (optional)
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`analytics-${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const n: any = payload.new;
          if (n?.status === "checked_in") {
            loadStatsFast();
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

  if (!eventId) return <div className="p-4">Missing eventId in route.</div>;

  const attendanceData = [
    { name: "Registered", value: totalRegistered, color: "#0F1C2E" },
    { name: "Confirmed", value: totalConfirmed, color: "#D6C6A5" },
    { name: "Checked In", value: totalCheckedIn, color: "#22C55E" },
  ];

  const pieData = [
    { name: "Checked In", value: totalCheckedIn, color: "#22C55E" },
    { name: "Not Yet", value: Math.max(totalConfirmed - totalCheckedIn, 0), color: "#F59E0B" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-[#0F1C2E] mb-2">Analytics</h1>
        <p className="text-gray-600">Per-event insights (live)</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Attendance Rate</p>
                <p className="text-3xl text-[#0F1C2E]">{loading ? "…" : `${checkinRate}%`}</p>
              </div>
              <div className="bg-[#22C55E]/10 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6 text-[#22C55E]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Attendees</p>
                <p className="text-3xl text-[#0F1C2E]">{loading ? "…" : totalCheckedIn}</p>
              </div>
              <div className="bg-[#D6C6A5]/10 p-3 rounded-xl">
                <Users className="w-6 h-6 text-[#D6C6A5]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Organizations</p>
                <p className="text-3xl text-[#0F1C2E]">{loading ? "…" : `${topOrgs.length}+`}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Peak Time</p>
                <p className="text-2xl text-[#0F1C2E]">{loading ? "…" : peakTime}</p>
              </div>
              <div className="bg-[#F59E0B]/10 p-3 rounded-xl">
                <Clock className="w-6 h-6 text-[#F59E0B]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-[#0F1C2E]">Hourly Check-in Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hour" stroke="#6b7280" style={{ fontSize: "12px" }} />
                <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                />
                <Bar dataKey="count" fill="#D6C6A5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-[#0F1C2E]">Attendance Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {pieData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Orgs */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
            <Building className="w-5 h-5 text-[#D6C6A5]" />
            Top Organizations by Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topOrgs.length === 0 ? (
            <div className="text-sm text-gray-600">No check-ins yet.</div>
          ) : (
            <div className="space-y-4">
              {topOrgs.map((org, index) => (
                <div key={org.name} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[#0F1C2E] text-[#D6C6A5] rounded-lg flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#0F1C2E]">{org.name}</span>
                      <span className="text-sm text-gray-600">{org.count} attendees</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D6C6A5] to-[#D6C6A5]/70 rounded-full"
                        style={{ width: `${Math.min((org.count / Math.max(topOrgs[0]?.count ?? 1, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <Card className="border-none shadow-lg bg-gradient-to-br from-[#0F1C2E] to-[#0F1C2E]/90 text-white">
          <CardContent className="p-6">
            <h3 className="text-lg mb-2 text-[#D6C6A5]">Total Registered</h3>
            <p className="text-4xl mb-1">{totalRegistered}</p>
            <p className="text-sm text-gray-300">All-time registrations</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-[#D6C6A5] to-[#D6C6A5]/80 text-[#0F1C2E]">
          <CardContent className="p-6">
            <h3 className="text-lg mb-2">Confirmed</h3>
            <p className="text-4xl mb-1">{totalConfirmed}</p>
            <p className="text-sm opacity-80">Ready to attend</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-[#22C55E] to-[#22C55E]/80 text-white">
          <CardContent className="p-6">
            <h3 className="text-lg mb-2">Checked In</h3>
            <p className="text-4xl mb-1">{totalCheckedIn}</p>
            <p className="text-sm opacity-90">Currently at event</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}